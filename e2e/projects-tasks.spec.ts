import { expect, test } from '@playwright/test'

import { chooseOption, createProject, createTask, signUp, uniqueEmail } from './helpers.ts'

// Un único usuario recorre el ciclo completo; los pasos dependen del anterior.
test.describe.serial('Proyecto General por defecto', () => {
  let page: import('@playwright/test').Page

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage()
    await signUp(page, uniqueEmail('general'))
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('General existe, está marcado por defecto y no se puede eliminar', async () => {
    await page.goto('/projects')
    const general = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'General' }) })
    await expect(general).toContainText('Por defecto')
    await expect(page.getByRole('button', { name: 'Editar General' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Eliminar General' })).toHaveCount(0)
  })

  test('una tarea nueva cae en General sin elegir proyecto', async () => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: /Nueva tarea/ }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Nueva tarea' })
    // El selector de proyecto ya viene con General y no ofrece "Sin proyecto".
    await expect(dialog.getByRole('combobox').first()).toHaveText('General')
    await dialog.getByRole('combobox').first().click()
    await expect(page.getByRole('option', { name: 'Sin proyecto' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await dialog.getByLabel('Título').fill('Tarea en General')
    await dialog.getByRole('button', { name: 'Crear tarea' }).click()

    const item = page.getByRole('listitem').filter({ hasText: 'Tarea en General' })
    await expect(item).toContainText('General')
  })

  test('el filtro de proyecto no ofrece "Sin proyecto"', async () => {
    await page.goto('/tasks')
    await page.getByRole('combobox', { name: 'Filtrar por proyecto' }).click()
    await expect(page.getByRole('option', { name: 'Todos los proyectos' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'General' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Sin proyecto' })).toHaveCount(0)
    await page.keyboard.press('Escape')
  })

  test('crear un proyecto y una tarea dentro de él', async () => {
    await createProject(page, 'Marketing')
    const marketing = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Marketing' }) })
    await expect(marketing).toContainText('0 tareas')

    await createTask(page, 'Campaña de otoño', 'Marketing')
    await expect(page.getByRole('listitem').filter({ hasText: 'Campaña de otoño' })).toContainText('Marketing')

    await page.goto('/projects')
    await expect(marketing).toContainText('1 tarea')
  })

  test('borrar un proyecto mueve sus tareas a General y avisa', async () => {
    await page.goto('/projects')
    await page.getByRole('button', { name: 'Eliminar Marketing' }).click()

    const dialog = page.getByRole('dialog', { name: '¿Eliminar este proyecto?' })
    await expect(dialog).toContainText('Sus 1 tarea se moverán a General')
    await dialog.getByRole('button', { name: 'Eliminar' }).click()

    await expect(page.getByText('Proyecto eliminado. 1 tarea se movió a General.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Marketing' })).toHaveCount(0)

    // La tarea sigue visible y ahora pertenece a General.
    const general = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'General' }) })
    await expect(general).toContainText('2 tareas')

    await page.goto('/tasks')
    const moved = page.getByRole('listitem').filter({ hasText: 'Campaña de otoño' })
    await expect(moved).toBeVisible()
    await expect(moved).toContainText('General')
    await expect(moved).not.toContainText('Marketing')
  })

  test('filtrar por General lista las tareas movidas', async () => {
    await page.goto('/tasks')
    await chooseOption(page, 'Filtrar por proyecto', 'General')
    await expect(page.getByText('2 resultados')).toBeVisible()
  })
})
