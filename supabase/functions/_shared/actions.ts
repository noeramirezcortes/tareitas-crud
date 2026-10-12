// Acciones de billing iniciadas por el usuario: abrir Checkout y el Customer
// Portal. Lógica separada del runtime para poder probarla.
//
// Reglas (Fase 4):
//  - Solo un owner de la organización puede pagar o administrar la suscripción.
//  - El plan y su precio salen de la base de datos, NUNCA del cuerpo de la
//    petición: el cliente solo elige un código de plan.
//  - Las claves de Stripe solo existen en este entorno servidor.
import { corsHeaders, isUuid, json } from './http.ts'

export interface AuthUser {
  id: string
  email: string | null
}

export interface PurchasablePlan {
  code: string
  name: string
  stripe_price_id: string
}

export interface ActionDeps {
  /** URL pública de la app (SITE_URL): destino de las redirecciones y CORS. */
  siteUrl: string
  /** Valida el JWT del usuario y devuelve su identidad. */
  authenticate(request: Request): Promise<AuthUser | null>
  isOrganizationOwner(userId: string, organizationId: string): Promise<boolean>
  getOrganizationName(organizationId: string): Promise<string | null>
  /** Plan público con precio configurado, o null. */
  getPurchasablePlan(code: string): Promise<PurchasablePlan | null>
  /** ¿Ya hay una suscripción vigente (activa, en prueba o con pago pendiente)? */
  hasLiveSubscription(organizationId: string): Promise<boolean>
  getCustomerId(organizationId: string): Promise<string | null>
  /** Crea el Customer en Stripe, lo vincula a la organización y devuelve su id. */
  createCustomer(input: { organizationId: string; email: string | null; name: string }): Promise<string>
  createCheckoutSession(input: {
    customerId: string
    priceId: string
    organizationId: string
    successUrl: string
    cancelUrl: string
  }): Promise<string>
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<string>
}

async function guard(
  request: Request,
  deps: ActionDeps,
  cors: Record<string, string>,
): Promise<{ response: Response } | { user: AuthUser; body: Record<string, unknown>; organizationId: string }> {
  const user = await deps.authenticate(request)
  if (!user) return { response: json(401, { error: 'Debes iniciar sesión' }, cors) }

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (typeof parsed !== 'object' || parsed === null) throw new Error('cuerpo no es un objeto')
    body = parsed as Record<string, unknown>
  } catch {
    return { response: json(400, { error: 'Petición inválida' }, cors) }
  }

  if (!isUuid(body.organization_id)) {
    return { response: json(400, { error: 'organization_id inválido' }, cors) }
  }
  const organizationId = body.organization_id

  if (!(await deps.isOrganizationOwner(user.id, organizationId))) {
    return {
      response: json(403, { error: 'Solo un owner de la organización puede gestionar el plan' }, cors),
    }
  }

  return { user, body, organizationId }
}

function methodGate(request: Request, cors: Record<string, string>): Response | null {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido' }, cors)
  return null
}

/** Crea una sesión de Stripe Checkout para suscribir la organización a un plan. */
export function createCheckoutHandler(deps: ActionDeps) {
  const cors = corsHeaders(new URL(deps.siteUrl).origin)

  return async function handle(request: Request): Promise<Response> {
    const gate = methodGate(request, cors)
    if (gate) return gate

    const checked = await guard(request, deps, cors)
    if ('response' in checked) return checked.response
    const { user, body, organizationId } = checked

    const planCode = typeof body.plan_code === 'string' ? body.plan_code : 'pro'
    const plan = await deps.getPurchasablePlan(planCode)
    if (!plan) {
      return json(400, { error: 'Ese plan no está disponible para contratar' }, cors)
    }

    if (await deps.hasLiveSubscription(organizationId)) {
      return json(
        409,
        { error: 'La organización ya tiene una suscripción. Adminístrala desde el portal.' },
        cors,
      )
    }

    const name = (await deps.getOrganizationName(organizationId)) ?? 'Organización'
    const customerId =
      (await deps.getCustomerId(organizationId)) ??
      (await deps.createCustomer({ organizationId, email: user.email, name }))

    const base = deps.siteUrl.replace(/\/+$/, '')
    const url = await deps.createCheckoutSession({
      customerId,
      priceId: plan.stripe_price_id,
      organizationId,
      successUrl: `${base}/billing?checkout=success`,
      cancelUrl: `${base}/billing?checkout=cancel`,
    })

    return json(200, { url }, cors)
  }
}

/** Crea una sesión del Customer Portal (método de pago, facturas, cancelar). */
export function createPortalHandler(deps: ActionDeps) {
  const cors = corsHeaders(new URL(deps.siteUrl).origin)

  return async function handle(request: Request): Promise<Response> {
    const gate = methodGate(request, cors)
    if (gate) return gate

    const checked = await guard(request, deps, cors)
    if ('response' in checked) return checked.response
    const { organizationId } = checked

    const customerId = await deps.getCustomerId(organizationId)
    if (!customerId) {
      return json(404, { error: 'La organización todavía no tiene suscripción que administrar' }, cors)
    }

    const base = deps.siteUrl.replace(/\/+$/, '')
    const url = await deps.createPortalSession({ customerId, returnUrl: `${base}/billing` })
    return json(200, { url }, cors)
  }
}
