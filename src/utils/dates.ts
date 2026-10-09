/**
 * Helpers de fechas para tareas (due_date es una columna DATE: 'yyyy-mm-dd').
 * Se comparan como strings ISO para evitar líos de zona horaria.
 */

/** Hoy en formato 'yyyy-mm-dd' (hora local). */
export function todayISODate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Fecha dentro de `days` días desde hoy, 'yyyy-mm-dd'. */
export function isoDateInDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** ¿La fecha ya pasó? (estrictamente anterior a hoy) */
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate < todayISODate()
}

/** ¿Vence entre hoy y `days` días (inclusive)? */
export function isDueSoon(dueDate: string | null, days = 7): boolean {
  if (!dueDate) return false
  const today = todayISODate()
  return dueDate >= today && dueDate <= isoDateInDays(days)
}

const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })

/** '2026-10-15' → '15 oct 2026' (sin líos de zona horaria). */
export function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split('-').map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}
