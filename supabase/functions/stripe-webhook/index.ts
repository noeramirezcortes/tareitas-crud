// Webhook de Stripe. Lo llama Stripe (no un navegador), por eso NO usa JWT:
// su autenticidad la garantiza la firma (STRIPE_WEBHOOK_SECRET), validada
// sobre el cuerpo crudo antes de procesar nada. Ver [functions.stripe-webhook]
// en supabase/config.toml.
import { createWebhookHandler } from '../_shared/webhook.ts'
import { createWebhookDeps } from '../_shared/runtime.ts'

declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void }

let handler: ((request: Request) => Promise<Response>) | undefined

Deno.serve(async (request) => {
  try {
    handler ??= createWebhookHandler(createWebhookDeps())
    return await handler(request)
  } catch (error) {
    // Configuración incompleta o fallo inesperado: 500 hace que Stripe reintente.
    console.error('stripe-webhook:', error instanceof Error ? error.message : error)
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
