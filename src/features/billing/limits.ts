import { toast } from 'sonner'

import type { BillingStatus, LimitedResource } from './types'

/** Nombres de las funciones premium (claves de plans.features). */
export const FEATURE_LABELS: Record<string, string> = {
  tags: 'Crear etiquetas',
}

export const RESOURCE_LABELS: Record<LimitedResource, string> = {
  workspaces: 'Workspaces',
  projects: 'Proyectos',
  members: 'Miembros',
}

/**
 * ¿Ya no se puede crear más de este recurso? Es solo para la UX: el
 * servidor aplica el límite de todos modos (trigger → HTTP 402).
 * Los miembros incluyen las invitaciones pendientes (reservan un puesto).
 */
export function isAtLimit(status: BillingStatus | undefined, resource: LimitedResource): boolean {
  if (!status) return false
  const limit = status.limits[resource]
  if (limit === null) return false
  const used =
    resource === 'members' ? status.usage.members + status.usage.pending_invitations : status.usage[resource]
  return used >= limit
}

/** Texto "3 de 5" o "3 (sin límite)". */
export function formatUsage(used: number, limit: number | null): string {
  return limit === null ? `${used} (sin límite)` : `${used} de ${limit}`
}

/** El servidor responde HTTP 402 / SQLSTATE PT402 cuando el plan no permite la acción. */
export function isPlanLimitError(error: unknown): error is { code: string; message: string; hint?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'PT402'
  )
}

/**
 * Si el error es de límite de plan, muestra el motivo con acceso a los
 * planes y devuelve true; si no, devuelve false para que el llamador
 * muestre su mensaje genérico.
 */
export function notifyPlanLimit(error: unknown): boolean {
  if (!isPlanLimitError(error)) return false
  toast.error(error.message, {
    duration: 8000,
    action: { label: 'Ver planes', onClick: () => window.location.assign('/billing') },
  })
  return true
}
