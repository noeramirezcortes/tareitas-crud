// Prueba de integración de las Edge Functions de billing contra el stack LOCAL:
// runtime Deno real + Auth + PostgREST + base con las migraciones.
//
// Requiere (ver doc/guia-stripe.md):
//   supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor
//   supabase functions serve --env-file supabase/functions/.env
// Uso: pnpm test:billing-local
//
// No necesita claves reales de Stripe: los eventos del webhook se FIRMAN aquí
// con el STRIPE_WEBHOOK_SECRET del .env local. Checkout y Portal llegan hasta
// la llamada a Stripe; con una clave real devuelven la URL, con una de relleno
// devuelven 500 (se informa cuál ocurrió).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import Stripe from 'stripe'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) {
  throw new Error(`Esta prueba crea datos: la URL debe ser local (recibido: ${BASE})`)
}

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

function readEnvFile(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

const env = readEnvFile(join(ROOT, 'supabase', 'functions', '.env'))
const WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET
if (!WEBHOOK_SECRET) throw new Error('Falta STRIPE_WEBHOOK_SECRET en supabase/functions/.env')

const stripe = new Stripe('sk_test_signing_only')
let failures = 0
const check = (label, cond, extra = '') => {
  console.log(`  ${cond ? '✔' : '✘'} ${label}${cond ? '' : `  → ${extra}`}`)
  if (!cond) failures++
}

const admin = (path, init = {}) =>
  fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers },
  })

async function signUp(tag) {
  const email = `${tag}-${Date.now().toString(36)}@e2e.test`
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Passw0rd-e2e' }),
  })
  const body = await r.json()
  const org = (await (await admin(`organizations?select=id&name=eq.${encodeURIComponent(`Personal de ${email}`)}`)).json())[0].id
  return { email, token: body.access_token, org }
}

async function postWebhook(payload, signature) {
  const headers = { 'Content-Type': 'application/json' }
  if (signature) headers['stripe-signature'] = signature
  const r = await fetch(`${BASE}/functions/v1/stripe-webhook`, { method: 'POST', headers, body: payload })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

const signed = (payload, secret = WEBHOOK_SECRET) =>
  stripe.webhooks.generateTestHeaderString({ payload, secret })

let seq = 0
function subscriptionEvent({ customer, subscription, status, price, type = 'customer.subscription.updated', metadata = {} }) {
  seq += 1
  return JSON.stringify({
    id: `evt_it_${Date.now()}_${seq}`,
    object: 'event',
    type,
    created: Math.floor(Date.now() / 1000) + seq,
    data: {
      object: {
        id: subscription,
        object: 'subscription',
        customer,
        status,
        cancel_at_period_end: false,
        metadata,
        items: { data: [{ price: { id: price }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
      },
    },
  })
}

async function billingStatus(token, org) {
  const r = await fetch(`${BASE}/rest/v1/rpc/get_billing_status`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_org: org }),
  })
  return r.json()
}

// --- preparación ------------------------------------------------------------
const planRows = await (await admin('plans?select=stripe_price_id&code=eq.pro')).json()
let PRICE = planRows[0].stripe_price_id
if (!PRICE) {
  PRICE = 'price_integration_test'
  await admin('plans?code=eq.pro', { method: 'PATCH', body: JSON.stringify({ stripe_price_id: PRICE }) })
}

const owner = await signUp('it-owner')
const stranger = await signUp('it-stranger')
const CUSTOMER = `cus_it_${Date.now().toString(36)}`
const SUB = `sub_it_${Date.now().toString(36)}`
await admin('billing_customers', {
  method: 'POST',
  body: JSON.stringify({ organization_id: owner.org, stripe_customer_id: CUSTOMER }),
})

// --- webhook ----------------------------------------------------------------
console.log('== stripe-webhook (runtime Deno real) ==')
{
  const payload = subscriptionEvent({ customer: CUSTOMER, subscription: SUB, status: 'active', price: PRICE })

  let r = await postWebhook(payload, null)
  check('sin firma → 400', r.status === 400, JSON.stringify(r))

  r = await postWebhook(payload, 't=1790000000,v1=00ff')
  check('firma falsa → 400', r.status === 400, JSON.stringify(r))

  r = await postWebhook(payload, signed(payload, 'whsec_de_otro_endpoint'))
  check('firmado con otro secreto → 400', r.status === 400, JSON.stringify(r))

  r = await postWebhook(payload.replace('"active"', '"trialing"'), signed(payload))
  check('cuerpo alterado → 400', r.status === 400, JSON.stringify(r))

  const before = await billingStatus(owner.token, owner.org)
  check('antes de los eventos válidos la organización es Free', before.plan?.code === 'free', JSON.stringify(before.plan))

  r = await postWebhook(payload, signed(payload))
  check('evento firmado customer.subscription.updated → 200 applied', r.status === 200 && r.body.result === 'applied', JSON.stringify(r))

  const after = await billingStatus(owner.token, owner.org)
  check('la base queda en Pro/active (visible para el owner)', after.plan?.code === 'pro' && after.subscription?.status === 'active', JSON.stringify(after.plan))

  r = await postWebhook(payload, signed(payload))
  check('reintento del mismo evento → 200 duplicate (idempotente)', r.status === 200 && r.body.result === 'duplicate', JSON.stringify(r))

  const canceled = subscriptionEvent({ customer: CUSTOMER, subscription: SUB, status: 'canceled', price: PRICE, type: 'customer.subscription.deleted' })
  r = await postWebhook(canceled, signed(canceled))
  check('customer.subscription.deleted → 200 applied', r.status === 200 && r.body.result === 'applied', JSON.stringify(r))
  const free = await billingStatus(owner.token, owner.org)
  check('tras cancelar vuelve a Free', free.plan?.code === 'free' && free.subscription?.status === 'canceled', JSON.stringify(free.plan))

  const unknown = subscriptionEvent({ customer: 'cus_no_existe', subscription: 'sub_x', status: 'active', price: PRICE })
  r = await postWebhook(unknown, signed(unknown))
  check('Customer desconocido sin metadata → 200 ignored', r.status === 200 && r.body.result === 'ignored', JSON.stringify(r))

  const badPrice = subscriptionEvent({ customer: 'cus_no_existe', subscription: 'sub_y', status: 'active', price: 'price_que_no_existe', metadata: { organization_id: owner.org } })
  r = await postWebhook(badPrice, signed(badPrice))
  check('precio desconocido para una organización sin suscripción vigente → 5xx (Stripe reintenta)', r.status === 500, JSON.stringify(r))
}

// --- checkout y portal --------------------------------------------------------
console.log('== billing-checkout / billing-portal ==')
{
  const call = (fn, token, body) =>
    fetch(`${BASE}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))

  let r = await call('billing-checkout', null, { organization_id: owner.org })
  check('checkout sin sesión → 401', r.status === 401, JSON.stringify(r))

  r = await call('billing-checkout', ANON, { organization_id: owner.org })
  check('checkout con la anon key (no es un usuario) → 401', r.status === 401, JSON.stringify(r))

  r = await call('billing-checkout', stranger.token, { organization_id: owner.org })
  check('checkout de un no-miembro sobre la organización ajena → 403', r.status === 403, JSON.stringify(r))

  r = await call('billing-checkout', owner.token, { organization_id: 'no-uuid' })
  check('organization_id inválido → 400', r.status === 400, JSON.stringify(r))

  r = await call('billing-checkout', owner.token, { organization_id: owner.org, plan_code: 'free' })
  check('plan no contratable → 400', r.status === 400, JSON.stringify(r))

  r = await call('billing-checkout', owner.token, { organization_id: owner.org })
  const reachedStripe = r.status === 200 ? r.body.url?.startsWith('https://checkout.stripe.com') : r.status === 500
  check(
    `owner → llega a Stripe (${r.status === 200 ? 'URL de Checkout recibida: clave real' : '500: clave de relleno, esperado'})`,
    reachedStripe,
    JSON.stringify(r),
  )

  r = await call('billing-portal', stranger.token, { organization_id: stranger.org })
  check('portal sin suscripción que administrar → 404', r.status === 404, JSON.stringify(r))

  r = await call('billing-portal', stranger.token, { organization_id: owner.org })
  check('portal de una organización ajena → 403', r.status === 403, JSON.stringify(r))
}

console.log(failures === 0 ? '\nOK' : `\n${failures} fallos`)
process.exit(failures === 0 ? 0 : 1)
