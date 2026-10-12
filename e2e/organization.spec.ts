import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

import { chooseOption, createTask, fillRegister, signUp, uniqueEmail } from './helpers.ts'

/**
 * Flujo multiusuario: un owner crea una organización, invita a otra persona
 * (que se registra desde el enlace), cambian roles, el owner sale, y el nuevo
 * owner borra un workspace y la organización. Cada paso depende del anterior.
 */
test.describe.serial('Organizaciones, invitaciones y roles', () => {
  const ownerEmail = uniqueEmail('owner')
  const memberEmail = uniqueEmail('miembro')
  const strangerEmail = uniqueEmail('otro')
  const ORG = `Acme ${Date.now().toString(36)}`

  let ownerCtx: BrowserContext
  let memberCtx: BrowserContext
  let owner: Page
  let member: Page

  test.beforeAll(async ({ browser }) => {
    ownerCtx = await browser.newContext()
    await ownerCtx.grantPermissions(['clipboard-read', 'clipboard-write'])
    memberCtx = await browser.newContext()
    owner = await ownerCtx.newPage()
    member = await memberCtx.newPage()
  })

  test.afterAll(async () => {
    await ownerCtx.close()
    await memberCtx.close()
  })

  /** Pulsa "Copiar enlace" de una invitación pendiente y devuelve la URL copiada. */
  async function copyInvitationLink(email: string): Promise<string> {
    const row = owner.getByRole('listitem').filter({ hasText: email })
    await row.getByRole('button', { name: 'Copiar enlace' }).click()
    await expect(owner.getByText('Enlace copiado')).toBeVisible()
    return owner.evaluate(() => navigator.clipboard.readText())
  }

  async function invite(email: string, roleLabel?: string) {
    await owner.getByLabel('Email').fill(email)
    if (roleLabel) await chooseOption(owner, 'Rol de la invitación', roleLabel)
    await owner.getByRole('button', { name: 'Invitar' }).click()
    await expect(owner.getByText('Invitación creada. Copia el enlace para compartirlo.')).toBeVisible()
  }

  test('el owner crea una organización y queda como Owner', async () => {
    await signUp(owner, ownerEmail)

    await owner.getByRole('banner').getByRole('button').filter({ hasText: 'Personal de' }).click()
    await owner.getByRole('menuitem', { name: 'Nueva organización' }).click()
    const dialog = owner.getByRole('dialog', { name: 'Nueva organización' })
    await dialog.getByLabel('Nombre').fill(ORG)
    await dialog.getByRole('button', { name: 'Crear organización' }).click()

    await expect(owner.getByText('Organización creada')).toBeVisible()
    await expect(owner.getByRole('banner')).toContainText(ORG)

    await owner.goto('/organization')
    await expect(owner.getByRole('heading', { name: ORG, level: 1 })).toBeVisible()
    await expect(owner.getByText('Tu rol: Owner')).toBeVisible()
  })

  test('el owner invita por email y obtiene un enlace', async () => {
    await invite(memberEmail)

    const row = owner.getByRole('listitem').filter({ hasText: memberEmail })
    await expect(row).toContainText('Pendiente')
    const link = await copyInvitationLink(memberEmail)
    expect(link).toMatch(/\/invite\/[0-9a-f-]{36}$/)
  })

  test('el invitado se registra desde el enlace y se une a la organización', async () => {
    const link = await copyInvitationLink(memberEmail)

    // Sin sesión: va a /login, desde ahí a registrarse, y vuelve al enlace.
    await member.goto(link)
    await expect(member).toHaveURL(/\/login$/)
    await member.getByRole('link', { name: 'Regístrate' }).click()
    await expect(member).toHaveURL(/\/register$/)
    await fillRegister(member, memberEmail)

    await expect(member).toHaveURL(/\/invite\/[0-9a-f-]{36}$/)
    await member.getByRole('button', { name: 'Aceptar invitación' }).click()

    await expect(member).toHaveURL(/\/dashboard$/)
    await expect(member.getByRole('banner')).toContainText(ORG)
  })

  test('un miembro ve la organización sin controles de administración', async () => {
    await member.goto('/organization')
    await expect(member.getByText('Tu rol: Miembro')).toBeVisible()
    await expect(member.getByRole('heading', { name: 'Invitaciones' })).toHaveCount(0)
    await expect(member.getByRole('heading', { name: 'Zona de peligro' })).toHaveCount(0)
    await expect(member.getByText('Sólo owners y admins pueden invitar personas.')).toBeVisible()
    // No puede crear workspaces ni expulsar a nadie.
    await expect(member.getByRole('button', { name: 'Nuevo' })).toHaveCount(0)
    await expect(member.getByRole('button', { name: /Expulsar a/ })).toHaveCount(0)
  })

  test('la invitación queda aceptada y el owner promueve al miembro a Admin', async () => {
    await owner.goto('/organization')
    const invitation = owner.getByRole('listitem').filter({ hasText: memberEmail }).last()
    await expect(invitation).toContainText('Aceptada')

    await chooseOption(owner, `Rol de ${memberEmail}`, 'Admin')
    await expect(owner.getByText('Rol actualizado')).toBeVisible()

    await member.reload()
    await expect(member.getByText('Tu rol: Admin')).toBeVisible()
    await expect(member.getByRole('heading', { name: 'Invitaciones' })).toBeVisible()
    await expect(member.getByRole('heading', { name: 'Zona de peligro' })).toHaveCount(0)
  })

  test('un admin no puede cambiar el rol del owner ni expulsarlo', async () => {
    const ownerRow = member.getByRole('listitem').filter({ hasText: ownerEmail })
    await expect(ownerRow).toContainText('Owner')
    await expect(ownerRow.getByRole('combobox')).toHaveCount(0)
    await expect(ownerRow.getByRole('button', { name: /Expulsar a/ })).toHaveCount(0)
  })

  test('un enlace de invitación solo sirve para el email invitado', async () => {
    await owner.reload()
    await invite(strangerEmail)
    const link = await copyInvitationLink(strangerEmail)

    // El miembro (otro email) intenta usarlo.
    await member.goto(link)
    await member.getByRole('button', { name: 'Aceptar invitación' }).click()
    await expect(member.getByRole('alert')).toContainText('Esta invitación fue enviada a otro email')
  })

  test('el último owner no puede salir de la organización', async () => {
    await owner.goto('/organization')
    const myRow = owner.getByRole('listitem').filter({ hasText: '(tú)' })
    await myRow.getByRole('button', { name: 'Salir' }).click()
    await owner.getByRole('dialog', { name: 'Salir de la organización' }).getByRole('button', { name: 'Salir' }).click()

    await expect(owner.getByText('La organización debe tener al menos un owner')).toBeVisible()
    // Sigue siendo owner de la organización.
    await owner.reload()
    await expect(owner.getByText('Tu rol: Owner')).toBeVisible()
  })

  test('tras promover a otro owner, el primero puede salir', async () => {
    await chooseOption(owner, `Rol de ${memberEmail}`, 'Owner')
    await expect(owner.getByText('Rol actualizado')).toBeVisible()

    const myRow = owner.getByRole('listitem').filter({ hasText: '(tú)' })
    await myRow.getByRole('button', { name: 'Salir' }).click()
    await owner.getByRole('dialog', { name: 'Salir de la organización' }).getByRole('button', { name: 'Salir' }).click()

    await expect(owner.getByText('Has salido de la organización')).toBeVisible()
    await expect(owner).toHaveURL(/\/dashboard$/)
    // Vuelve a su organización personal y ya no tiene acceso a la otra.
    await expect(owner.getByRole('banner')).toContainText(`Personal de ${ownerEmail}`)
    await owner.getByRole('banner').getByRole('button').filter({ hasText: 'Personal de' }).click()
    await expect(owner.getByRole('menuitem', { name: ORG })).toHaveCount(0)
  })

  test('el nuevo owner borra un workspace con sus tareas', async () => {
    await member.goto('/organization')
    await expect(member.getByText('Tu rol: Owner')).toBeVisible()

    // Un segundo workspace, con una tarea dentro.
    await member.getByRole('button', { name: 'Nuevo' }).click()
    const wsDialog = member.getByRole('dialog', { name: 'Nuevo workspace' })
    await wsDialog.getByLabel('Nombre').fill('Marketing')
    await wsDialog.getByRole('button', { name: /Crear/ }).click()
    await expect(member.getByText('Workspace creado')).toBeVisible()

    await createTask(member, 'Se borra con el workspace')
    await expect(member.getByRole('listitem').filter({ hasText: 'Se borra con el workspace' })).toBeVisible()

    await member.goto('/organization')
    const dangerRow = member
      .getByRole('heading', { name: 'Zona de peligro' })
      .locator('xpath=following::li[.//span[normalize-space()="Marketing"]][1]')
    await dangerRow.getByRole('button', { name: 'Eliminar' }).click()

    const confirm = member.getByRole('dialog', { name: 'Eliminar workspace "Marketing"' })
    await expect(confirm).toContainText('Se eliminarán 0 proyectos, 0 etiquetas y 1 tarea.')
    await confirm.getByRole('button', { name: 'Eliminar workspace' }).click()

    await expect(member.getByText('Workspace eliminado')).toBeVisible()
    // Queda un único workspace y ya no se ofrece borrarlo.
    await expect(member.getByText('Último workspace: no se puede borrar')).toBeVisible()
  })

  test('el owner elimina la organización completa', async () => {
    await member.getByRole('button', { name: 'Eliminar organización' }).click()
    const confirm = member.getByRole('dialog', { name: `Eliminar organización "${ORG}"` })
    await expect(confirm).toContainText('tareas, miembros e invitaciones')
    await confirm.getByRole('button', { name: 'Eliminar definitivamente' }).click()

    await expect(member.getByText('Organización eliminada')).toBeVisible()
    await expect(member).toHaveURL(/\/dashboard$/)
    await expect(member.getByRole('banner')).toContainText(`Personal de ${memberEmail}`)
  })
})
