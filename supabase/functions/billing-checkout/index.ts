// POST { organization_id, plan_code? } → { url } de Stripe Checkout.
// Requiere sesión (verify_jwt) y que quien llama sea owner de la organización.
import { createCheckoutHandler } from '../_shared/actions.ts'
import { createActionDeps } from '../_shared/runtime.ts'

declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void }

let handler: ((request: Request) => Promise<Response>) | undefined

Deno.serve(async (request) => {
  try {
    handler ??= createCheckoutHandler(createActionDeps())
    return await handler(request)
  } catch (error) {
    console.error('billing-checkout:', error instanceof Error ? error.message : error)
    return new Response(JSON.stringify({ error: 'Error interno del servicio de pagos' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
