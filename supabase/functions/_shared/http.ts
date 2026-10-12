// Utilidades HTTP compartidas por las Edge Functions de billing.
// Sin dependencias externas: se ejecutan igual en Deno (Supabase) y en Node (pruebas).

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

/**
 * CORS solo para el origen de la app (SITE_URL). El webhook no lo usa: lo
 * llama Stripe desde su servidor, no un navegador.
 */
export function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** Origen (esquema + host) de una URL, sin barra final ni path. */
export function originOf(url: string): string {
  return new URL(url).origin
}
