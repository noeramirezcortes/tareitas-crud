// Pruebas de las Edge Functions de billing (pnpm test:functions).
//
// La firma del webhook se prueba con el SDK REAL de Stripe: los payloads se
// firman con `generateTestHeaderString` y se validan con
// `constructEventAsync`, igual que en producción (cambia solo el proveedor
// de criptografía). Las dependencias de base de datos y de Stripe API son
// dobles en memoria.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Stripe from 'stripe'

import { createCheckoutHandler, createPortalHandler } from './actions.ts'
import type { ActionDeps } from './actions.ts'
import { createWebhookHandler, toApplyArgs } from './webhook.ts'
import type { ApplyResult, ApplySubscriptionArgs, StripeEventLike, WebhookDeps } from './webhook.ts'

const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests'
const ORG = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const SITE = 'https://app.tareitas.test'
const stripe = new Stripe('sk_test_unit_tests_only')

// --- Webhook -----------------------------------------------------------------

function subscriptionEvent(overrides: Record<string, unknown> = {}, type = 'customer.subscription.updated') {
  return {
    id: 'evt_test_1',
    object: 'event',
    type,
    created: 1_790_000_000,
    data: {
      object: {
        id: 'sub_123',
        object: 'subscription',
        customer: 'cus_123',
        status: 'active',
        cancel_at_period_end: false,
        metadata: { organization_id: ORG },
        items: { data: [{ price: { id: 'price_pro' }, current_period_end: 1_792_592_000 }] },
        ...overrides,
      },
    },
  }
}

function sign(payload: string, secret = WEBHOOK_SECRET, timestamp?: number): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp })
}

function webhookRequest(body: string, signature: string | null, method = 'POST'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature !== null) headers['stripe-signature'] = signature
  return new Request('https://project.supabase.co/functions/v1/stripe-webhook', {
    method,
    headers,
    body: method === 'POST' ? body : undefined,
  })
}

function webhookHarness(overrides: Partial<WebhookDeps> = {}) {
  const calls = { apply: [] as ApplySubscriptionArgs[], link: [] as Array<[string, string]> }
  const deps: WebhookDeps = {
    // Verificación REAL de Stripe con el secreto de prueba.
    verifyEvent: async (payload, signature) =>
      (await stripe.webhooks.constructEventAsync(payload, signature, WEBHOOK_SECRET)) as unknown as StripeEventLike,
    findOrganizationByCustomer: async (customer) => (customer === 'cus_123' ? ORG : null),
    linkCustomer: async (organizationId, customerId) => {
      calls.link.push([organizationId, customerId])
    },
    applySubscription: async (args): Promise<ApplyResult> => {
      calls.apply.push(args)
      return 'applied'
    },
    ...overrides,
  }
  return { handle: createWebhookHandler(deps), calls }
}

describe('stripe-webhook: firma', () => {
  it('rechaza peticiones sin cabecera stripe-signature (400)', async () => {
    const { handle, calls } = webhookHarness()
    const response = await handle(webhookRequest(JSON.stringify(subscriptionEvent()), null))
    assert.equal(response.status, 400)
    assert.equal(calls.apply.length, 0)
  })

  it('rechaza una firma inválida (400) y no aplica nada', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent())
    const response = await handle(webhookRequest(body, 't=1790000000,v1=deadbeef'))
    assert.equal(response.status, 400)
    assert.equal(calls.apply.length, 0)
  })

  it('rechaza un evento firmado con otro secreto (400)', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent())
    const response = await handle(webhookRequest(body, sign(body, 'whsec_otro_secreto')))
    assert.equal(response.status, 400)
    assert.equal(calls.apply.length, 0)
  })

  it('rechaza un cuerpo alterado después de firmar (400)', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent())
    const signature = sign(body)
    const tampered = body.replace('"active"', '"trialing"')
    const response = await handle(webhookRequest(tampered, signature))
    assert.equal(response.status, 400)
    assert.equal(calls.apply.length, 0)
  })

  it('rechaza un cuerpo re-serializado (la firma es sobre el cuerpo crudo)', async () => {
    const { handle } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent())
    const signature = sign(body)
    const reformatted = JSON.stringify(JSON.parse(body), null, 2)
    const response = await handle(webhookRequest(reformatted, signature))
    assert.equal(response.status, 400)
  })

  it('rechaza una firma fuera de la tolerancia de tiempo (repetición, 400)', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent())
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 10 * 60
    const response = await handle(webhookRequest(body, sign(body, WEBHOOK_SECRET, tenMinutesAgo)))
    assert.equal(response.status, 400)
    assert.equal(calls.apply.length, 0)
  })

  it('no acepta métodos distintos de POST (405)', async () => {
    const { handle } = webhookHarness()
    const response = await handle(webhookRequest('', null, 'GET'))
    assert.equal(response.status, 405)
  })
})

describe('stripe-webhook: eventos de suscripción', () => {
  it('aplica el estado de Stripe a la organización vinculada al Customer', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent())
    const response = await handle(webhookRequest(body, sign(body)))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { received: true, result: 'applied' })
    assert.equal(calls.apply.length, 1)
    assert.deepEqual(calls.apply[0], {
      p_event_id: 'evt_test_1',
      p_event_type: 'customer.subscription.updated',
      p_event_created: new Date(1_790_000_000 * 1000).toISOString(),
      p_organization: ORG,
      p_stripe_subscription: 'sub_123',
      p_status: 'active',
      p_price_id: 'price_pro',
      p_current_period_end: new Date(1_792_592_000 * 1000).toISOString(),
      p_cancel_at_period_end: false,
    })
  })

  it('usa los nombres exactos de los parámetros de billing_apply_subscription', () => {
    const args = toApplyArgs(
      { id: 'e', type: 't', created: 1, data: { object: {} } },
      { id: 's', customer: 'c', status: 'active' },
      ORG,
    )
    assert.deepEqual(Object.keys(args).sort(), [
      'p_cancel_at_period_end',
      'p_current_period_end',
      'p_event_created',
      'p_event_id',
      'p_event_type',
      'p_organization',
      'p_price_id',
      'p_status',
      'p_stripe_subscription',
    ])
  })

  it('lee el fin de periodo del nivel de la suscripción cuando existe', () => {
    const args = toApplyArgs(
      { id: 'e', type: 't', created: 1, data: { object: {} } },
      { id: 's', customer: 'c', status: 'active', current_period_end: 2_000_000_000, items: { data: [] } },
      ORG,
    )
    assert.equal(args.p_current_period_end, new Date(2_000_000_000 * 1000).toISOString())
    assert.equal(args.p_price_id, null)
  })

  it('marca cancel_at_period_end cuando Stripe programa la cancelación', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent({ cancel_at_period_end: true }))
    await handle(webhookRequest(body, sign(body)))
    assert.equal(calls.apply[0].p_cancel_at_period_end, true)
  })

  it('traslada customer.subscription.deleted con estado canceled', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent({ status: 'canceled' }, 'customer.subscription.deleted'))
    const response = await handle(webhookRequest(body, sign(body)))
    assert.equal(response.status, 200)
    assert.equal(calls.apply[0].p_status, 'canceled')
    assert.equal(calls.apply[0].p_event_type, 'customer.subscription.deleted')
  })

  it('usa la metadata como respaldo si el Customer no está vinculado', async () => {
    const { handle, calls } = webhookHarness({ findOrganizationByCustomer: async () => null })
    const body = JSON.stringify(subscriptionEvent({ customer: 'cus_desconocido' }))
    await handle(webhookRequest(body, sign(body)))
    assert.equal(calls.apply[0].p_organization, ORG)
  })

  it('la vinculación de Customer prevalece sobre la metadata', async () => {
    const OTHER = '33333333-3333-4333-8333-333333333333'
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify(subscriptionEvent({ metadata: { organization_id: OTHER } }))
    await handle(webhookRequest(body, sign(body)))
    assert.equal(calls.apply[0].p_organization, ORG)
  })

  it('ignora (200) una suscripción de una organización desconocida', async () => {
    const { handle, calls } = webhookHarness({ findOrganizationByCustomer: async () => null })
    const body = JSON.stringify(subscriptionEvent({ customer: 'cus_x', metadata: {} }))
    const response = await handle(webhookRequest(body, sign(body)))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { received: true, result: 'ignored' })
    assert.equal(calls.apply.length, 0)
  })

  it('un evento duplicado responde 200 con el resultado de la base', async () => {
    const { handle } = webhookHarness({ applySubscription: async () => 'duplicate' })
    const body = JSON.stringify(subscriptionEvent())
    const response = await handle(webhookRequest(body, sign(body)))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { received: true, result: 'duplicate' })
  })

  it('si la base falla responde 500 para que Stripe reintente', async () => {
    const { handle } = webhookHarness({
      applySubscription: async () => {
        throw new Error('db caída')
      },
    })
    const body = JSON.stringify(subscriptionEvent())
    const response = await handle(webhookRequest(body, sign(body)))
    assert.equal(response.status, 500)
    // No filtra el motivo interno.
    assert.deepEqual(await response.json(), { error: 'Error procesando el evento' })
  })

  it('checkout.session.completed vincula el Customer a la organización', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify({
      id: 'evt_co',
      object: 'event',
      type: 'checkout.session.completed',
      created: 1_790_000_100,
      data: {
        object: { id: 'cs_1', mode: 'subscription', customer: 'cus_123', client_reference_id: ORG },
      },
    })
    const response = await handle(webhookRequest(body, sign(body)))
    assert.equal(response.status, 200)
    assert.deepEqual(calls.link, [[ORG, 'cus_123']])
    assert.equal(calls.apply.length, 0)
  })

  it('los eventos que no usa responden 200 sin tocar nada', async () => {
    const { handle, calls } = webhookHarness()
    const body = JSON.stringify({
      id: 'evt_x',
      object: 'event',
      type: 'invoice.paid',
      created: 1_790_000_100,
      data: { object: {} },
    })
    const response = await handle(webhookRequest(body, sign(body)))
    assert.equal(response.status, 200)
    assert.equal(calls.apply.length, 0)
    assert.equal(calls.link.length, 0)
  })
})

// --- Checkout y Portal ---------------------------------------------------------

function actionHarness(overrides: Partial<ActionDeps> = {}) {
  const calls = {
    customersCreated: [] as Array<{ organizationId: string; email: string | null; name: string }>,
    checkout: [] as Array<Record<string, string>>,
    portal: [] as Array<Record<string, string>>,
  }
  const deps: ActionDeps = {
    siteUrl: SITE,
    authenticate: async (request) =>
      request.headers.get('Authorization') === 'Bearer valid' ? { id: USER, email: 'owner@tareitas.test' } : null,
    isOrganizationOwner: async (userId, organizationId) => userId === USER && organizationId === ORG,
    getOrganizationName: async () => 'Acme',
    getPurchasablePlan: async (code) =>
      code === 'pro' ? { code: 'pro', name: 'Pro', stripe_price_id: 'price_pro' } : null,
    hasLiveSubscription: async () => false,
    getCustomerId: async () => null,
    createCustomer: async (input) => {
      calls.customersCreated.push(input)
      return 'cus_new'
    },
    createCheckoutSession: async (input) => {
      calls.checkout.push(input)
      return 'https://checkout.stripe.com/c/pay/cs_test_123'
    },
    createPortalSession: async (input) => {
      calls.portal.push(input)
      return 'https://billing.stripe.com/p/session/test_123'
    },
    ...overrides,
  }
  return { checkout: createCheckoutHandler(deps), portal: createPortalHandler(deps), calls }
}

function actionRequest(body: unknown, token: string | null = 'valid', method = 'POST'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request('https://project.supabase.co/functions/v1/billing-checkout', {
    method,
    headers,
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  })
}

describe('billing-checkout', () => {
  it('crea el Customer y la sesión de Checkout para el owner', async () => {
    const { checkout, calls } = actionHarness()
    const response = await checkout(actionRequest({ organization_id: ORG, plan_code: 'pro' }))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { url: 'https://checkout.stripe.com/c/pay/cs_test_123' })
    assert.deepEqual(calls.customersCreated, [
      { organizationId: ORG, email: 'owner@tareitas.test', name: 'Acme' },
    ])
    assert.deepEqual(calls.checkout, [
      {
        customerId: 'cus_new',
        priceId: 'price_pro',
        organizationId: ORG,
        successUrl: `${SITE}/billing?checkout=success`,
        cancelUrl: `${SITE}/billing?checkout=cancel`,
      },
    ])
  })

  it('reutiliza el Customer existente en vez de crear otro', async () => {
    const { checkout, calls } = actionHarness({ getCustomerId: async () => 'cus_existing' })
    await checkout(actionRequest({ organization_id: ORG }))
    assert.equal(calls.customersCreated.length, 0)
    assert.equal(calls.checkout[0].customerId, 'cus_existing')
  })

  it('el precio sale de la base, no de la petición', async () => {
    const { checkout, calls } = actionHarness()
    await checkout(actionRequest({ organization_id: ORG, plan_code: 'pro', price_id: 'price_barato', amount: 1 }))
    assert.equal(calls.checkout[0].priceId, 'price_pro')
  })

  it('exige sesión (401)', async () => {
    const { checkout, calls } = actionHarness()
    const response = await checkout(actionRequest({ organization_id: ORG }, null))
    assert.equal(response.status, 401)
    assert.equal(calls.checkout.length, 0)
  })

  it('un token inválido es 401', async () => {
    const { checkout } = actionHarness()
    const response = await checkout(actionRequest({ organization_id: ORG }, 'forged'))
    assert.equal(response.status, 401)
  })

  it('solo un owner puede pagar (403 para admin o miembro)', async () => {
    const { checkout, calls } = actionHarness({ isOrganizationOwner: async () => false })
    const response = await checkout(actionRequest({ organization_id: ORG }))
    assert.equal(response.status, 403)
    assert.equal(calls.checkout.length, 0)
    assert.equal(calls.customersCreated.length, 0)
  })

  it('valida el organization_id (400)', async () => {
    const { checkout } = actionHarness()
    assert.equal((await checkout(actionRequest({ organization_id: 'no-es-uuid' }))).status, 400)
    assert.equal((await checkout(actionRequest({}))).status, 400)
    assert.equal((await checkout(actionRequest('{no es json'))).status, 400)
  })

  it('rechaza un plan que no se puede contratar (400)', async () => {
    const { checkout, calls } = actionHarness()
    const response = await checkout(actionRequest({ organization_id: ORG, plan_code: 'free' }))
    assert.equal(response.status, 400)
    assert.equal(calls.checkout.length, 0)
  })

  it('no crea otra suscripción si ya hay una vigente (409)', async () => {
    const { checkout, calls } = actionHarness({ hasLiveSubscription: async () => true })
    const response = await checkout(actionRequest({ organization_id: ORG }))
    assert.equal(response.status, 409)
    assert.equal(calls.checkout.length, 0)
  })

  it('responde el preflight CORS solo para el origen de la app', async () => {
    const { checkout } = actionHarness()
    const response = await checkout(actionRequest(null, null, 'OPTIONS'))
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), SITE)
  })

  it('las respuestas de error también llevan CORS', async () => {
    const { checkout } = actionHarness()
    const response = await checkout(actionRequest({ organization_id: ORG }, null))
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), SITE)
  })
})

describe('billing-portal', () => {
  it('abre el portal del Customer de la organización', async () => {
    const { portal, calls } = actionHarness({ getCustomerId: async () => 'cus_existing' })
    const response = await portal(actionRequest({ organization_id: ORG }))
    assert.equal(response.status, 200)
    assert.deepEqual(calls.portal, [{ customerId: 'cus_existing', returnUrl: `${SITE}/billing` }])
  })

  it('404 si la organización nunca contrató nada', async () => {
    const { portal, calls } = actionHarness()
    const response = await portal(actionRequest({ organization_id: ORG }))
    assert.equal(response.status, 404)
    assert.equal(calls.portal.length, 0)
  })

  it('solo un owner puede abrir el portal (403)', async () => {
    const { portal } = actionHarness({ isOrganizationOwner: async () => false, getCustomerId: async () => 'cus_1' })
    const response = await portal(actionRequest({ organization_id: ORG }))
    assert.equal(response.status, 403)
  })

  it('exige sesión (401)', async () => {
    const { portal } = actionHarness({ getCustomerId: async () => 'cus_1' })
    const response = await portal(actionRequest({ organization_id: ORG }, null))
    assert.equal(response.status, 401)
  })
})
