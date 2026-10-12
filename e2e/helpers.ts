import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export const PASSWORD = 'Passw0rd-e2e'

let counter = 0

/** Email único por ejecución: los specs no se pisan entre sí ni entre corridas. */
export function uniqueEmail(tag: string): string {
  counter += 1
  const stamp = `${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`
  return `${tag}-${stamp}@e2e.test`
}

/** Rellena el registro y espera la sesión inmediata (confirmación de email desactivada en local). */
export async function fillRegister(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirmar contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
}

export async function signUp(page: Page, email: string) {
  await page.goto('/register')
  await fillRegister(page, email)
  await expect(page).toHaveURL(/\/dashboard$/)
  // El contexto (organización y workspace personales) ya cargó.
  await expect(page.getByRole('banner')).toContainText('Personal')
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export async function signOut(page: Page) {
  // El avatar es el único botón del header con la inicial del email.
  await page.getByRole('banner').getByRole('button').last().click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()
  await expect(page).not.toHaveURL(/\/(dashboard|tasks|projects|organization)/)
}

/** Elige una opción de un Select de shadcn (Radix) por la etiqueta de su trigger. */
export async function chooseOption(page: Page, triggerName: string, optionName: string) {
  await page.getByRole('combobox', { name: triggerName }).click()
  await page.getByRole('option', { name: optionName, exact: true }).click()
}

/** Crea una tarea desde /tasks con el proyecto por defecto o el indicado. */
export async function createTask(page: Page, title: string, project?: string) {
  await page.goto('/tasks')
  await page.getByRole('button', { name: /Nueva tarea/ }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nueva tarea' })
  await dialog.getByLabel('Título').fill(title)
  if (project) {
    await dialog.getByRole('combobox').first().click()
    await page.getByRole('option', { name: project, exact: true }).click()
  }
  await dialog.getByRole('button', { name: 'Crear tarea' }).click()
  await expect(page.getByRole('dialog', { name: 'Nueva tarea' })).toBeHidden()
}

/** Crea un proyecto desde /projects. */
export async function createProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: /Nuevo proyecto/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo proyecto' })
  await dialog.getByLabel('Nombre').fill(name)
  await dialog.getByRole('button', { name: 'Crear proyecto' }).click()
  await expect(page.getByRole('dialog', { name: 'Nuevo proyecto' })).toBeHidden()
}

// ---------------------------------------------------------------------------
// Apoyo para billing: simula lo que haría el servidor (webhook de Stripe) con
// la service_role del stack LOCAL. Nunca contra producción.
// ---------------------------------------------------------------------------
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function admin(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  })
  if (!response.ok) throw new Error(`admin ${path}: ${response.status} ${await response.text()}`)
  return response.json() as Promise<any>
}

/** Organización personal de un usuario de prueba. */
export async function personalOrganizationId(email: string): Promise<string> {
  const rows = await admin(`organizations?select=id&name=eq.${encodeURIComponent(`Personal de ${email}`)}`)
  return rows[0].id
}

export async function userIdByEmail(email: string): Promise<string> {
  const orgId = await personalOrganizationId(email)
  const rows = await admin(`organizations?select=owner_id&id=eq.${orgId}`)
  return rows[0].owner_id
}

/** Agrega un usuario como miembro de una organización (sin pasar por invitaciones). */
export async function addMember(organizationId: string, userId: string, role: 'member' | 'admin' = 'member') {
  await admin('memberships', {
    method: 'POST',
    body: JSON.stringify({ organization_id: organizationId, user_id: userId, role }),
  })
}

/** Garantiza que el plan Pro tenga un price id (en local viene vacío) y lo devuelve. */
async function ensureProPrice(): Promise<string> {
  const rows = await admin('plans?select=stripe_price_id&code=eq.pro')
  if (rows[0].stripe_price_id) return rows[0].stripe_price_id
  await admin('plans?code=eq.pro', { method: 'PATCH', body: JSON.stringify({ stripe_price_id: 'price_e2e_pro' }) })
  return 'price_e2e_pro'
}

/** Configura el price id para que la UI ofrezca "Actualizar a Pro". */
export async function configureProPrice() {
  await ensureProPrice()
}

/** Aplica un evento de suscripción como lo haría el webhook validado. */
export async function applySubscription(
  organizationId: string,
  status: 'active' | 'past_due' | 'canceled',
  subscriptionId = `sub_e2e_${organizationId.slice(0, 8)}`,
) {
  const price = await ensureProPrice()
  const result = await admin('rpc/billing_apply_subscription', {
    method: 'POST',
    body: JSON.stringify({
      p_event_id: `evt_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      p_event_type: 'customer.subscription.updated',
      p_event_created: new Date().toISOString(),
      p_organization: organizationId,
      p_stripe_subscription: subscriptionId,
      p_status: status,
      p_price_id: price,
      p_current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      p_cancel_at_period_end: false,
    }),
  })
  if (result !== 'applied') throw new Error(`evento no aplicado: ${result}`)
}
