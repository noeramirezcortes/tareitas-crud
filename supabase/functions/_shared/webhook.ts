// Lógica del webhook de Stripe, separada del runtime para poder probarla.
//
// Reglas (Fase 4):
//  - Stripe es la fuente de verdad: el estado de la suscripción se toma de los
//    eventos customer.subscription.*, nunca de la redirección del navegador.
//  - La firma se valida sobre el CUERPO CRUDO antes de leer nada del evento.
//  - Un fallo de proceso devuelve 500 para que Stripe reintente; un evento
//    inválido devuelve 400; un evento irrelevante o ya procesado, 200.
import { json } from './http.ts'

export interface StripeSubscriptionLike {
  id: string
  customer: string | { id: string }
  status: string
  cancel_at_period_end?: boolean
  cancel_at?: number | null
  current_period_end?: number
  metadata?: Record<string, string> | null
  items?: { data?: Array<{ price?: { id: string } | null; current_period_end?: number }> }
}

export interface StripeCheckoutSessionLike {
  mode?: string
  customer?: string | { id: string } | null
  client_reference_id?: string | null
}

export interface StripeEventLike {
  id: string
  type: string
  created: number
  data: { object: unknown }
}

/** Argumentos de la función SQL billing_apply_subscription (nombres exactos). */
export interface ApplySubscriptionArgs {
  p_event_id: string
  p_event_type: string
  p_event_created: string
  p_organization: string
  p_stripe_subscription: string
  p_status: string
  p_price_id: string | null
  p_current_period_end: string | null
  p_cancel_at_period_end: boolean
}

export type ApplyResult = 'applied' | 'duplicate' | 'stale' | 'ignored'

export interface WebhookDeps {
  /** Valida la firma y devuelve el evento; debe lanzar si no es auténtico. */
  verifyEvent(payload: string, signature: string): Promise<StripeEventLike>
  findOrganizationByCustomer(customerId: string): Promise<string | null>
  linkCustomer(organizationId: string, customerId: string): Promise<void>
  applySubscription(args: ApplySubscriptionArgs): Promise<ApplyResult>
  log?(message: string, data?: Record<string, unknown>): void
}

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

function isoFromSeconds(seconds: number | undefined | null): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null
}

/** Traduce una suscripción de Stripe a los argumentos de la función SQL. */
export function toApplyArgs(
  event: StripeEventLike,
  subscription: StripeSubscriptionLike,
  organizationId: string,
): ApplySubscriptionArgs {
  const item = subscription.items?.data?.[0]
  return {
    p_event_id: event.id,
    p_event_type: event.type,
    p_event_created: new Date(event.created * 1000).toISOString(),
    p_organization: organizationId,
    p_stripe_subscription: subscription.id,
    p_status: subscription.status,
    p_price_id: item?.price?.id ?? null,
    // Versiones recientes de la API mueven el fin de periodo a cada item.
    p_current_period_end: isoFromSeconds(subscription.current_period_end ?? item?.current_period_end),
    p_cancel_at_period_end: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
  }
}

export function createWebhookHandler(deps: WebhookDeps) {
  const log = deps.log ?? (() => {})

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json(405, { error: 'Método no permitido' })
    }

    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      return json(400, { error: 'Falta la firma de Stripe' })
    }

    // Cuerpo crudo: cualquier re-serialización invalidaría la firma.
    const payload = await request.text()

    let event: StripeEventLike
    try {
      event = await deps.verifyEvent(payload, signature)
    } catch {
      log('webhook: firma inválida')
      return json(400, { error: 'Firma inválida' })
    }

    try {
      if (SUBSCRIPTION_EVENTS.has(event.type)) {
        const subscription = event.data.object as StripeSubscriptionLike
        const customerId = idOf(subscription.customer)

        // Fuente principal: el Customer que NOSOTROS creamos para la organización.
        // La metadata es solo respaldo.
        let organizationId = customerId ? await deps.findOrganizationByCustomer(customerId) : null
        organizationId ??= subscription.metadata?.organization_id ?? null

        if (!organizationId) {
          log('webhook: suscripción sin organización conocida', { event: event.id, customer: customerId })
          return json(200, { received: true, result: 'ignored' })
        }

        const result = await deps.applySubscription(toApplyArgs(event, subscription, organizationId))
        log('webhook: evento procesado', { event: event.id, type: event.type, result })
        return json(200, { received: true, result })
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as StripeCheckoutSessionLike
        const customerId = idOf(session.customer)
        // El estado llega por customer.subscription.*; aquí solo se asegura el vínculo.
        if (session.mode === 'subscription' && customerId && session.client_reference_id) {
          await deps.linkCustomer(session.client_reference_id, customerId)
        }
        return json(200, { received: true, result: 'linked' })
      }

      return json(200, { received: true, result: 'ignored' })
    } catch (error) {
      // 500 → Stripe reintenta con backoff; el evento no queda marcado como procesado.
      log('webhook: error procesando evento', {
        event: event.id,
        message: error instanceof Error ? error.message : String(error),
      })
      return json(500, { error: 'Error procesando el evento' })
    }
  }
}
