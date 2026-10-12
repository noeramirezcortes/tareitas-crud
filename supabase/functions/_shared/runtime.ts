// Cableado con el runtime de Supabase Edge Functions (Deno).
//
// Aquí vive todo lo que toca servicios reales: Stripe y la base de datos con
// service_role. La lógica de negocio está en actions.ts / webhook.ts (puras y
// probadas en Node); este archivo solo las conecta.
//
// Secretos (nunca en el repo; ver doc/guia-stripe.md):
//   STRIPE_SECRET_KEY       clave del servidor (preferible una restringida rk_)
//   STRIPE_WEBHOOK_SECRET   whsec_... del endpoint de webhook
//   SITE_URL                URL pública de la app (redirecciones y CORS)
// Inyectadas por Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import Stripe from 'npm:stripe@23.0.0'

import type { ActionDeps } from './actions.ts'
import type { ApplyResult, StripeEventLike, WebhookDeps } from './webhook.ts'

declare const Deno: { env: { get(name: string): string | undefined } }

/**
 * Etiqueta de esta integración en el Dashboard de Stripe (comparar flujos de
 * Checkout). El sufijo aleatorio la distingue de otras integraciones.
 */
const INTEGRATION_IDENTIFIER = 'tareitas-subscription-checkout-kqzvmwxj'

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

export function adminClient() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function stripeClient(secretKey: string) {
  return new Stripe(secretKey, { appInfo: { name: 'tareitas', version: '1.0.0' } })
}

/** Dependencias de billing-checkout y billing-portal. */
export function createActionDeps(): ActionDeps {
  const admin = adminClient()
  const stripe = stripeClient(requiredEnv('STRIPE_SECRET_KEY'))
  const siteUrl = requiredEnv('SITE_URL')

  const getCustomerId = async (organizationId: string): Promise<string | null> => {
    const { data, error } = await admin
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (error) throw error
    return data?.stripe_customer_id ?? null
  }

  return {
    siteUrl,

    async authenticate(request) {
      const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (!token) return null
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user) return null
      return { id: data.user.id, email: data.user.email ?? null }
    },

    async isOrganizationOwner(userId, organizationId) {
      const { data, error } = await admin
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .maybeSingle()
      if (error) throw error
      return data?.role === 'owner'
    },

    async getOrganizationName(organizationId) {
      const { data, error } = await admin.from('organizations').select('name').eq('id', organizationId).maybeSingle()
      if (error) throw error
      return data?.name ?? null
    },

    async getPurchasablePlan(code) {
      const { data, error } = await admin
        .from('plans')
        .select('code, name, stripe_price_id')
        .eq('code', code)
        .eq('is_public', true)
        .not('stripe_price_id', 'is', null)
        .maybeSingle()
      if (error) throw error
      return data && data.stripe_price_id
        ? { code: data.code, name: data.name, stripe_price_id: data.stripe_price_id }
        : null
    },

    async hasLiveSubscription(organizationId) {
      const { data, error } = await admin
        .from('subscriptions')
        .select('status')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing', 'past_due'])
        .maybeSingle()
      if (error) throw error
      return data !== null
    },

    getCustomerId,

    async createCustomer({ organizationId, email, name }) {
      const customer = await stripe.customers.create(
        { email: email ?? undefined, name, metadata: { organization_id: organizationId } },
        { idempotencyKey: `tareitas-customer-${organizationId}` },
      )
      const { error } = await admin
        .from('billing_customers')
        .upsert(
          { organization_id: organizationId, stripe_customer_id: customer.id },
          { onConflict: 'organization_id', ignoreDuplicates: true },
        )
      if (error) throw error
      // Si dos peticiones compitieron, vale el cliente que quedó guardado.
      return (await getCustomerId(organizationId)) ?? customer.id
    },

    async createCheckoutSession({ customerId, priceId, organizationId, successUrl, cancelUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: organizationId,
        metadata: { organization_id: organizationId },
        subscription_data: { metadata: { organization_id: organizationId } },
        allow_promotion_codes: true,
        integration_identifier: INTEGRATION_IDENTIFIER,
      })
      if (!session.url) throw new Error('Stripe no devolvió la URL de Checkout')
      return session.url
    },

    async createPortalSession({ customerId, returnUrl }) {
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
      return session.url
    },
  }
}

/** Dependencias del webhook. No necesita la clave secreta para validar firmas. */
export function createWebhookDeps(): WebhookDeps {
  const admin = adminClient()
  const stripe = stripeClient(Deno.env.get('STRIPE_SECRET_KEY') ?? 'sk_unused_by_webhook')
  const webhookSecret = requiredEnv('STRIPE_WEBHOOK_SECRET')
  // Deno no tiene el módulo crypto de Node: se firma con Web Crypto.
  const cryptoProvider = Stripe.createSubtleCryptoProvider()

  return {
    async verifyEvent(payload, signature) {
      const event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret, undefined, cryptoProvider)
      return event as unknown as StripeEventLike
    },

    async findOrganizationByCustomer(customerId) {
      const { data, error } = await admin
        .from('billing_customers')
        .select('organization_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()
      if (error) throw error
      return data?.organization_id ?? null
    },

    async linkCustomer(organizationId, customerId) {
      const { error } = await admin
        .from('billing_customers')
        .upsert(
          { organization_id: organizationId, stripe_customer_id: customerId },
          { onConflict: 'organization_id', ignoreDuplicates: true },
        )
      if (error) throw error
    },

    async applySubscription(args) {
      const { data, error } = await admin.rpc('billing_apply_subscription', args)
      if (error) throw error
      return data as ApplyResult
    },

    log(message, data) {
      console.log(JSON.stringify({ message, ...data }))
    },
  }
}
