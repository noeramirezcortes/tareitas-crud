import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  ANON_KEY,
  SUPABASE_URL,
  addMember,
  applySubscription,
  configureProPrice,
  createProject,
  personalOrganizationId,
  signUp,
  uniqueEmail,
  userIdByEmail,
} from './helpers.ts'

// Un único owner recorre el ciclo de vida del plan: Free → límites → Pro.
// El pago real con Stripe no se prueba aquí: se simula el resultado que
// dejaría el webhook validado (ver doc/guia-stripe.md para la prueba real).
test.describe.serial('Plan y facturación', () => {
  const ownerEmail = uniqueEmail('billing')
  let page: Page
  let orgId: string

  test.beforeAll(async ({ browser }) => {
    await configureProPrice()
    page = await (await browser.newContext()).newPage()
    await signUp(page, ownerEmail)
    orgId = await personalOrganizationId(ownerEmail)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('una organización nueva está en Free y muestra su consumo y límites', async () => {
    await page.goto('/billing')
    await expect(page.getByRole('heading', { name: 'Plan y facturación' })).toBeVisible()
    await expect(page.getByText('Plan Free', { exact: true })).toBeVisible()

    await expect(page.getByRole('progressbar', { name: 'Workspaces: 1 de 2' })).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Proyectos: 0 de 5' })).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Miembros: 1 de 3' })).toBeVisible()

    // Catálogo: el plan actual y la opción de actualizar (solo owner).
    await expect(page.getByText('Plan actual')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Actualizar a Pro' })).toBeVisible()
    // Sin suscripción no hay nada que administrar en el portal.
    await expect(page.getByRole('button', { name: 'Administrar suscripción' })).toHaveCount(0)
  })

  test('las etiquetas son una función Pro: el Free ve el aviso en vez del formulario', async () => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: /Etiquetas/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Etiquetas' })
    await expect(dialog.getByText('Crear etiquetas es una función del plan Pro.')).toBeVisible()
    await expect(dialog.getByPlaceholder('Nueva etiqueta…')).toHaveCount(0)
    await page.keyboard.press('Escape')
  })

  test('al llegar al límite de proyectos la UI lo explica y bloquea crear', async () => {
    for (let i = 1; i <= 5; i++) {
      await createProject(page, `Proyecto ${i}`)
    }
    await page.goto('/projects')
    await expect(page.getByText('Alcanzaste el límite de 5 proyectos del plan Free.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Nuevo proyecto/ })).toBeDisabled()

    await page.goto('/billing')
    // General no cuenta: 5 de 5 aunque la lista tenga 6 proyectos.
    await expect(page.getByRole('progressbar', { name: 'Proyectos: 5 de 5' })).toBeVisible()
  })

  test('el servidor rechaza con HTTP 402 aunque se esquive la UI', async () => {
    const token = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
      return key ? (JSON.parse(localStorage.getItem(key) as string).access_token as string) : null
    })
    expect(token).toBeTruthy()
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const workspaces = await page.request.get(`${SUPABASE_URL}/rest/v1/workspaces?select=id`, { headers })
    const workspaceId = (await workspaces.json())[0].id

    const response = await page.request.post(`${SUPABASE_URL}/rest/v1/projects`, {
      headers,
      data: { workspace_id: workspaceId, name: 'Colado' },
    })
    expect(response.status()).toBe(402)
    const body = await response.json()
    expect(body.code).toBe('PT402')
    expect(body.hint).toBe('projects')
  })

  test('el cliente no puede subirse de plan escribiendo en la base', async () => {
    const token = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
      return key ? (JSON.parse(localStorage.getItem(key) as string).access_token as string) : null
    })
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const insert = await page.request.post(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      headers,
      data: {
        organization_id: orgId,
        plan_code: 'pro',
        status: 'active',
        stripe_subscription_id: 'sub_hack',
        last_event_at: new Date().toISOString(),
      },
    })
    expect([401, 403]).toContain(insert.status())

    const fn = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/billing_apply_subscription`, {
      headers,
      data: {
        p_event_id: 'evt_hack',
        p_event_type: 'x',
        p_event_created: new Date().toISOString(),
        p_organization: orgId,
        p_stripe_subscription: 'sub_hack',
        p_status: 'active',
        p_price_id: 'price_x',
        p_current_period_end: null,
        p_cancel_at_period_end: false,
      },
    })
    expect([401, 403, 404]).toContain(fn.status())

    await page.goto('/billing')
    await expect(page.getByText('Plan Free', { exact: true })).toBeVisible()
  })

  test('tras el pago (evento del webhook) la UI pasa a Pro sin límites', async () => {
    await applySubscription(orgId, 'active')

    await page.goto('/billing')
    await expect(page.getByText('Plan Pro', { exact: true })).toBeVisible()
    await expect(page.getByText('Activa')).toBeVisible()
    await expect(page.getByText(/Se renueva el/)).toBeVisible()
    await expect(page.getByText('6 · ilimitado').or(page.getByText('5 · ilimitado'))).toBeVisible()
    await expect(page.getByRole('button', { name: 'Administrar suscripción' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Actualizar a Pro' })).toHaveCount(0)

    // Ya se puede crear más allá del límite del Free.
    await createProject(page, 'Proyecto 6')
    await expect(page.getByRole('link', { name: 'Proyecto 6' })).toBeVisible()

    // Y las etiquetas están disponibles.
    await page.goto('/tasks')
    await page.getByRole('button', { name: /Etiquetas/ }).click()
    await expect(page.getByPlaceholder('Nueva etiqueta…')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('un pago fallido avisa y conserva Pro durante los 7 días de gracia', async () => {
    await applySubscription(orgId, 'past_due')
    await page.goto('/billing')
    await expect(page.getByRole('alert')).toContainText('No pudimos cobrar tu última factura')
    // Dentro de los 7 días de gracia conserva Pro.
    await expect(page.getByText('Plan Pro', { exact: true })).toBeVisible()
  })

  test('al cancelar vuelve a Free: se conserva lo creado pero no se puede crear más', async () => {
    await applySubscription(orgId, 'canceled')
    await page.goto('/billing')
    await expect(page.getByText('Plan Free', { exact: true })).toBeVisible()
    await expect(page.getByText(/Tu suscripción anterior terminó/)).toBeVisible()

    await page.goto('/projects')
    // 6 proyectos de usuario > límite 5: no se pierde ninguno.
    await expect(page.getByRole('link', { name: 'Proyecto 6' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Nuevo proyecto/ })).toBeDisabled()
  })
})

test.describe('Billing: vista de un miembro', () => {
  test('un miembro ve el plan pero no puede gestionarlo', async ({ browser }) => {
    const ownerEmail = uniqueEmail('dueno')
    const memberEmail = uniqueEmail('miembro')

    const ownerCtx = await browser.newContext()
    const ownerPage = await ownerCtx.newPage()
    await signUp(ownerPage, ownerEmail)
    const orgId = await personalOrganizationId(ownerEmail)

    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    await signUp(memberPage, memberEmail)
    await addMember(orgId, await userIdByEmail(memberEmail))

    // El miembro cambia a la organización del owner desde el selector.
    await memberPage.reload()
    await memberPage.getByRole('banner').getByRole('button').filter({ hasText: 'Personal de' }).click()
    await memberPage.getByRole('menuitem', { name: `Personal de ${ownerEmail}` }).click()
    await memberPage.goto('/billing')

    await expect(memberPage.getByText('Plan Free', { exact: true })).toBeVisible()
    await expect(memberPage.getByText('Solo un owner de la organización puede cambiar el plan')).toBeVisible()
    await expect(memberPage.getByRole('button', { name: /Actualizar a/ })).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: 'Administrar suscripción' })).toHaveCount(0)
    // Ve el consumo de la organización: 2 miembros.
    await expect(memberPage.getByRole('progressbar', { name: 'Miembros: 2 de 3' })).toBeVisible()

    await ownerCtx.close()
    await memberCtx.close()
  })
})
