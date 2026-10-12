/**
 * Destino al que volver tras autenticarse. ProtectedRoute lo guarda en
 * `location.state.from`; solo se acepta una ruta interna (empieza por una
 * sola "/") para no depender de lo que traiga el estado del historial.
 */
export function getRedirectFrom(state: unknown): string | undefined {
  const pathname = (state as { from?: { pathname?: unknown } } | null)?.from?.pathname

  if (typeof pathname !== 'string') return undefined
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return undefined
  return pathname
}
