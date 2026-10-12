import { expect, test } from '@playwright/test'

import { PASSWORD, fillRegister, signIn, signOut, signUp, uniqueEmail } from './helpers.ts'

test.describe('Autenticación y onboarding', () => {
  test('un usuario nuevo se registra y recibe su organización y workspace personales', async ({ page }) => {
    const email = uniqueEmail('alta')
    await signUp(page, email)

    const header = page.getByRole('banner')
    await expect(header).toContainText(`Personal de ${email}`)
    await expect(header).toContainText('Personal')

    // Su workspace nace con el proyecto "General" por defecto.
    await page.goto('/projects')
    const general = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'General' }) })
    await expect(general).toContainText('Por defecto')
    await expect(general).toContainText('0 tareas')
  })

  test('cierra sesión y vuelve a entrar', async ({ page }) => {
    const email = uniqueEmail('sesion')
    await signUp(page, email)
    await signOut(page)

    await signIn(page, email)
    await expect(page.getByRole('banner')).toContainText(`Personal de ${email}`)
  })

  test('las rutas protegidas redirigen a /login', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('Iniciar sesión').first()).toBeVisible()
  })

  test('credenciales incorrectas muestran un error y no dan acceso', async ({ page }) => {
    const email = uniqueEmail('mala')
    await signUp(page, email)
    await signOut(page)

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(`${PASSWORD}-mal`)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('No se pudo iniciar sesión. Revisa tus credenciales.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('el registro valida que las contraseñas coincidan', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Email').fill(uniqueEmail('valida'))
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirmar contraseña').fill(`${PASSWORD}-otra`)
    await page.getByRole('button', { name: 'Crear cuenta' }).click()

    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test('no se puede registrar dos veces el mismo email', async ({ page }) => {
    const email = uniqueEmail('dup')
    await signUp(page, email)
    await signOut(page)

    await page.goto('/register')
    await fillRegister(page, email)
    // Supabase no revela si el email existe; lo importante es no obtener sesión.
    await expect(page).not.toHaveURL(/\/dashboard$/)
  })
})
