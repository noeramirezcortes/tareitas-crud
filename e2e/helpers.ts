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
