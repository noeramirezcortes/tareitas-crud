// Pruebas de aislamiento multi-tenant y de reglas de autorización.
//
// Ejecuta las migraciones reales de supabase/migrations sobre PostgreSQL en
// memoria (PGlite) con un esquema `auth` simulado (auth.users, auth.uid()).
// Uso: pnpm test:rls
//
// Limitación: simula Supabase, no lo reemplaza. Antes de dar por buena una
// migración en producción conviene aplicarla también en un proyecto de prueba.

import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')
// Primera migración de la Fase 3: antes de ella se siembran datos de la Fase 2.
const FASE3_FIRST = '20261010000000_fase3_multitenant.sql'

// Lo que Supabase provee de forma automática y las migraciones usan.
const PRELUDE = `
create schema if not exists auth;
create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json->>'sub')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`

const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
const before = files.filter((f) => f < FASE3_FIRST)
const after = files.filter((f) => f >= FASE3_FIRST)

const db = new PGlite()
let passes = 0
let failures = 0
let inTx = false

const ok = (name) => {
  passes++
  console.log(`  ✔ ${name}`)
}
const fail = (name, detail) => {
  failures++
  console.log(`  ✘ ${name}\n      ${detail}`)
}

// Dentro de una transacción de prueba, cada comprobación va en un SAVEPOINT
// para que un error esperado (RLS, excepción) no aborte el resto.
async function guarded(fn) {
  if (inTx) await db.exec('savepoint sp')
  try {
    return await fn()
  } finally {
    if (inTx) await db.exec('rollback to savepoint sp')
  }
}

async function expectRows(label, fn, expected) {
  try {
    const n = await guarded(fn)
    if (n === expected) ok(`${label} = ${expected}`)
    else fail(label, `esperado ${expected}, obtuvo ${n}`)
  } catch (e) {
    fail(label, e.message)
  }
}

async function expectError(label, fn) {
  try {
    await guarded(fn)
    fail(label, 'debió fallar y no falló')
  } catch (e) {
    ok(`${label} → bloqueado: ${e.message.split('\n')[0]}`)
  }
}

// Como expectError, pero además exige que el bloqueo se deba a la razón
// esperada (mensaje de RLS o excepción de la función), no a un error ajeno.
async function expectBlock(label, fn, reason) {
  try {
    await guarded(fn)
    fail(label, 'debió fallar y no falló')
  } catch (e) {
    const firstLine = e.message.split('\n')[0]
    if (reason && !e.message.includes(reason)) {
      fail(label, `falló por otra razón: ${firstLine}`)
    } else {
      ok(`${label} → bloqueado: ${firstLine}`)
    }
  }
}

// Usuario autenticado dentro de una transacción que SIEMPRE se revierte.
// Sirve para comprobar permisos sin dejar datos de prueba.
async function asUserTx(uid, fn) {
  await db.exec('begin')
  inTx = true
  try {
    await db.exec('set local role authenticated')
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: 'authenticated' }),
    ])
    await fn()
  } finally {
    inTx = false
    await db.exec('rollback')
  }
}

// Usuario autenticado a nivel de sesión, SIN transacción: los cambios persisten.
// Sirve para flujos reales como aceptar una invitación.
async function asUserSession(uid, fn) {
  await db.exec('set role authenticated')
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ])
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claims', '', false)")
  }
}

const scalar = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].n)
const rowsOf = async (sql, params = []) => (await db.query(sql, params)).rows.length
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]

// ------------------------------------------------------------
console.log('== 1. Migraciones de fases 1–2, datos existentes ==')
await db.exec(PRELUDE)
for (const f of before) {
  await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  ok(`aplicada ${f}`)
}

const uA = (await one("insert into auth.users (email) values ('a@test') returning id")).id
const uB = (await one("insert into auth.users (email) values ('b@test') returning id")).id
// El proyecto de A ya se llama "general": la migración del proyecto por
// defecto debe reutilizarlo (sin duplicar) en vez de crear otro "General".
const pA = (await one('insert into public.projects (user_id, name) values ($1, $2) returning id', [uA, 'general'])).id
await db.query('insert into public.projects (user_id, name) values ($1, $2)', [uB, 'Proyecto B'])
await db.query('insert into public.tags (user_id, name) values ($1, $2)', [uA, 'etiqueta-A'])
await db.query('insert into public.tags (user_id, name) values ($1, $2)', [uB, 'etiqueta-B'])
const tA = (await one('insert into public.tasks (user_id, title, project_id) values ($1, $2, $3) returning id', [uA, 'Tarea A', pA])).id
await db.query("insert into public.task_tags (task_id, tag_id) select $1, id from public.tags where name = 'etiqueta-A'", [tA])
ok('datos sembrados: 2 usuarios, 2 proyectos, 2 tags, 1 tarea con 1 tag')

// ------------------------------------------------------------
console.log('\n== 2. Migraciones de fase 3 y backfill ==')
for (const f of after) {
  await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  ok(`aplicada ${f}`)
}
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`)

// 2 originales + 1 "General" nuevo para B (el de A se reutiliza).
await expectRows('proyectos conservados + General nuevo', () => scalar('select count(*) n from public.projects'), 3)
await expectRows('proyectos con workspace_id', () => scalar('select count(*) n from public.projects where workspace_id is not null'), 3)
await expectRows('un único proyecto por defecto por workspace', () =>
  scalar('select count(*) n from public.projects where is_default'), 2)
await expectRows('el proyecto "general" de A se reutiliza como el de por defecto', () =>
  scalar(`select count(*) n from public.projects where id = '${pA}' and is_default`), 1)
await expectRows('B recibe un proyecto General nuevo', () =>
  scalar(`select count(*) n from public.projects where name = 'General' and is_default`), 1)
await expectRows('tags conservados', () => scalar('select count(*) n from public.tags'), 2)
await expectRows('tareas conservadas', () => scalar('select count(*) n from public.tasks'), 1)
await expectRows('vínculos task_tags conservados', () => scalar('select count(*) n from public.task_tags'), 1)
await expectRows('organizaciones personales', () => scalar('select count(*) n from public.organizations'), 2)
await expectRows('membresías owner', () => scalar("select count(*) n from public.memberships where role = 'owner'"), 2)

const personalWs = async (uid) =>
  (await one(
    `select w.id, w.organization_id from public.workspaces w
       join public.memberships m on m.organization_id = w.organization_id
      where m.user_id = $1 and w.name = 'Personal'`,
    [uid],
  ))
const wsA = await personalWs(uA)
const wsB = await personalWs(uB)
const orgA = wsA.organization_id
const orgB = wsB.organization_id

// ------------------------------------------------------------
console.log('\n== 3. Aislamiento entre dos organizaciones (A vs B) ==')
await asUserTx(uA, async () => {
  await expectRows('A ve solo sus proyectos', () => scalar('select count(*) n from public.projects'), 1)
  await expectRows('A no ve etiquetas de B', () => scalar("select count(*) n from public.tags where name = 'etiqueta-B'"), 0)
  await expectRows('A no ve tareas de B', () => scalar("select count(*) n from public.tasks where title = 'Tarea B'"), 0)
  await expectRows('A no ve workspaces de B', () => scalar(`select count(*) n from public.workspaces where id = '${wsB.id}'`), 0)
  await expectRows('A no ve la organización de B', () => scalar(`select count(*) n from public.organizations where id = '${orgB}'`), 0)
  await expectRows('A no ve membresías de B', () => scalar(`select count(*) n from public.memberships where organization_id = '${orgB}'`), 0)
  await expectError('A no puede listar miembros de B (RPC)', () =>
    db.query('select * from public.list_org_members($1)', [orgB]))
  await expectError('A inserta proyecto en workspace de B', () =>
    db.query("insert into public.projects (workspace_id, name) values ($1, 'intruso')", [wsB.id]))
  await expectRows('A actualiza proyectos de B (0 filas)', () =>
    rowsOf('update public.projects set name = $2 where workspace_id = $1 returning id', [wsB.id, 'hack']), 0)
  await expectRows('A borra proyectos de B (0 filas)', () =>
    rowsOf('delete from public.projects where workspace_id = $1 returning id', [wsB.id]), 0)
  await expectRows('A ve su propia organización', () => scalar(`select count(*) n from public.organizations where id = '${orgA}'`), 1)
})

await asUserTx(uB, async () => {
  await expectRows('B no ve tareas de A', () => scalar('select count(*) n from public.tasks'), 0)
  await expectRows('B no ve task_tags de A', () => scalar('select count(*) n from public.task_tags'), 0)
  await expectRows('B no ve workspace de A', () => scalar(`select count(*) n from public.workspaces where id = '${wsA.id}'`), 0)
})

// ------------------------------------------------------------
console.log('\n== 4. Creación de organización (RPC atómica) ==')
await asUserSession(uA, async () => {
  const newOrg = (await one('select public.create_organization($1) as id', ['Equipo A'])).id
  ok(`create_organization devuelve id ${newOrg.slice(0, 8)}…`)
  await expectRows('la org nueva tiene workspace General', () =>
    scalar(`select count(*) n from public.workspaces where organization_id = '${newOrg}' and name = 'General'`), 1)
  await expectRows('el creador es owner de la org nueva', () =>
    scalar(`select count(*) n from public.memberships where organization_id = '${newOrg}' and user_id = '${uA}' and role = 'owner'`), 1)
})
await asUserSession(uA, async () => {
  await expectError('nombre vacío rechazado', () => db.query("select public.create_organization('   ')"))
})

// ------------------------------------------------------------
console.log('\n== 5. Roles en orgA: owner, admin, member ==')
// B entra a orgA como member (simula una invitación ya aceptada).
await db.query("insert into public.memberships (user_id, organization_id, role) values ($1, $2, 'member')", [uB, orgA])

await asUserTx(uB, async () => {
  await expectRows('member ve los proyectos de orgA (3 = los 2 de su org + el de A)', () =>
    scalar('select count(*) n from public.projects'), 3)
  await expectError('member no puede invitar', () =>
    db.query(`insert into public.invitations (email, organization_id, invited_by, role) values ('x@test', $1, $2, 'member')`, [orgA, uB]))
})

// El owner A promueve a B a admin (persiste: es el setup para lo que sigue).
await asUserSession(uA, async () => {
  await expectRows('owner promueve member a admin', () =>
    rowsOf(`update public.memberships set role = 'admin' where user_id = '${uB}' and organization_id = '${orgA}' returning user_id`), 1)
})

await asUserTx(uB, async () => {
  await expectError('admin no puede invitar como owner', () =>
    db.query(`insert into public.invitations (email, organization_id, invited_by, role) values ('y@test', $1, $2, 'owner')`, [orgA, uB]))
  await expectError('admin no puede suplantar invited_by', () =>
    db.query(`insert into public.invitations (email, organization_id, invited_by, role) values ('z@test', $1, $2, 'member')`, [orgA, uA]))
  await expectRows('admin puede invitar como member', () =>
    rowsOf(`insert into public.invitations (email, organization_id, invited_by, role) values ('w@test', $1, $2, 'member') returning id`, [orgA, uB]), 1)
  await expectRows('admin no puede degradar al owner (0 filas)', () =>
    rowsOf(`update public.memberships set role = 'member' where user_id = $1 and organization_id = $2 returning user_id`, [uA, orgA]), 0)
  await expectRows('admin no puede expulsar al owner (0 filas)', () =>
    rowsOf(`delete from public.memberships where user_id = $1 and organization_id = $2 returning user_id`, [uA, orgA]), 0)
  await expectError('admin no puede ascenderse a owner', () =>
    db.query(`update public.memberships set role = 'owner' where user_id = $1 and organization_id = $2`, [uB, orgA]))
})

await asUserTx(uA, async () => {
  await expectRows('owner puede invitar como owner', () =>
    rowsOf(`insert into public.invitations (email, organization_id, invited_by, role) values ('own@test', $1, $2, 'owner') returning id`, [orgA, uA]), 1)
})

// ------------------------------------------------------------
console.log('\n== 6. Invitaciones: aceptación segura ==')
const uC = (await one("insert into auth.users (email) values ('c@test') returning id")).id
const uD = (await one("insert into auth.users (email) values ('d@test') returning id")).id
ok('usuarios C y D creados (el trigger de onboarding les crea su org personal)')
await expectRows('onboarding: C tiene org personal y membresía owner', () =>
  scalar(`select count(*) n from public.memberships m join public.organizations o on o.id = m.organization_id
          where m.user_id = '${uC}' and m.role = 'owner' and o.name like 'Personal de%'`), 1)
await expectRows('onboarding: C tiene workspace Personal', () =>
  scalar(`select count(*) n from public.workspaces w join public.memberships m on m.organization_id = w.organization_id
          where m.user_id = '${uC}' and w.name = 'Personal'`), 1)

// Invitación para C (creada por B, admin de orgA). Se crea con superusuario
// para que persista; el permiso de crearla ya se comprobó arriba.
await db.query(
  `insert into public.invitations (email, organization_id, invited_by, role) values ('c@test', $1, $2, 'member')`,
  [orgA, uB])
const tokenC = (await one(`select token from public.invitations where email = 'c@test' and organization_id = $1`, [orgA])).token

// Invitación ya vencida para D.
await db.query(
  `insert into public.invitations (email, organization_id, invited_by, role, expires_at) values ('d@test', $1, $2, 'member', now() - interval '1 day')`,
  [orgA, uB])
const tokenD = (await one(`select token from public.invitations where email = 'd@test' and organization_id = $1`, [orgA])).token

await asUserSession(uA, async () => {
  await expectError('email distinto no puede aceptar (A ≠ c@test)', () => db.query('select public.accept_invitation($1)', [tokenC]))
})
await asUserSession(uD, async () => {
  await expectError('invitación vencida rechazada', () => db.query('select public.accept_invitation($1)', [tokenD]))
})
await asUserSession(uC, async () => {
  const org = (await one('select public.accept_invitation($1) as id', [tokenC])).id
  await expectRows('C acepta y queda en orgA', () => scalar(`select count(*) n from public.memberships where user_id = '${uC}' and organization_id = '${org}'`), 1)
  await expectError('la misma invitación no se acepta dos veces', () => db.query('select public.accept_invitation($1)', [tokenC]))
  // C tiene además su propia org personal (con su General): se acota a orgA.
  await expectRows('C (member) ve el proyecto de orgA', () =>
    scalar(`select count(*) n from public.projects where workspace_id = '${wsA.id}'`), 1)
  await expectError('C (member) no puede invitar', () =>
    db.query(`insert into public.invitations (email, organization_id, invited_by, role) values ('q@test', $1, $2, 'member')`, [orgA, uC]))
})
await asUserSession(uA, async () => {
  await expectError('token inexistente rechazado', () =>
    db.query('select public.accept_invitation(gen_random_uuid())'))
})
await db.exec('set role anon')
await expectError('rol anon no puede aceptar invitaciones', () =>
  db.query('select public.accept_invitation($1)', [tokenC]))
await db.exec('reset role')

// ------------------------------------------------------------
console.log('\n== 7. Listado de miembros (RPC con email) ==')
await asUserTx(uC, async () => {
  await expectRows('miembro de orgA lista 3 miembros (A owner, B admin, C member)', () =>
    scalar('select count(*) n from public.list_org_members($1)', [orgA]), 3)
})
await asUserTx(uD, async () => {
  await expectError('no miembro no puede listar miembros de orgA', () =>
    db.query('select * from public.list_org_members($1)', [orgA]))
})

// ------------------------------------------------------------
console.log('\n== 8. Cancelar invitación ==')
// Invitación persistente creada por el superusuario (las de la sección 5 se revirtieron).
await db.query(`insert into public.invitations (email, organization_id, invited_by, role) values ('w@test', $1, $2, 'member')`, [orgA, uB])
await asUserTx(uB, async () => {
  await expectRows('admin cancela invitación pendiente', () =>
    rowsOf(`delete from public.invitations where email = 'w@test' and organization_id = $1 returning id`, [orgA]), 1)
})
await asUserTx(uC, async () => {
  await expectRows('member no puede cancelar invitaciones (0 filas)', () =>
    rowsOf(`delete from public.invitations where organization_id = $1 returning id`, [orgA]), 0)
})

// ------------------------------------------------------------
console.log('\n== 9. La organización siempre conserva un owner ==')
// orgA: A es el único owner (B admin, C member).
await asUserTx(uA, async () => {
  await expectBlock('degradar al único owner falla (trigger)', () =>
    db.query(`update public.memberships set role = 'admin' where user_id = $1 and organization_id = $2`, [uA, orgA]),
    'al menos un owner')
})
// El DELETE del caso anterior lo prueba el superusuario: con RLS el owner no
// llegaría al trigger (la policy devuelve 0 filas hasta la migración 01).
await expectBlock('borrar la membresía del único owner falla (trigger)', () =>
  db.query(`delete from public.memberships where user_id = $1 and organization_id = $2`, [uA, orgA]),
  'al menos un owner')

// Con dos owners, degradar o salir sí funciona.
await asUserSession(uA, async () => {
  await expectRows('A promueve a C a owner', () =>
    rowsOf(`update public.memberships set role = 'owner' where user_id = $1 and organization_id = $2 returning user_id`, [uC, orgA]), 1)
})
await asUserSession(uA, async () => {
  await expectRows('con dos owners, A puede degradarse', () =>
    rowsOf(`update public.memberships set role = 'admin' where user_id = $1 and organization_id = $2 returning user_id`, [uA, orgA]), 1)
  await expectRows('con dos owners, A puede salir (borra su membresía)', () =>
    rowsOf(`delete from public.memberships where user_id = $1 and organization_id = $2 returning user_id`, [uA, orgA]), 1)
})
// Restaurar el estado: C reincorpora a A como owner y vuelve a member.
await asUserSession(uC, async () => {
  await expectRows('C reincorpora a A como owner', () =>
    rowsOf(`insert into public.memberships (user_id, organization_id, role) values ($1, $2, 'owner') returning user_id`, [uA, orgA]), 1)
  await expectRows('C vuelve a member', () =>
    rowsOf(`update public.memberships set role = 'member' where user_id = $1 and organization_id = $2 returning user_id`, [uC, orgA]), 1)
})
await expectRows('estado restaurado: A vuelve a ser el único owner de orgA', () =>
  scalar(`select count(*) n from public.memberships where organization_id = '${orgA}' and role = 'owner'`), 1)

// El bloqueo también cubre el borrado en cascada desde auth.users: para
// eliminar la cuenta del último owner primero hay que transferir el ownership.
await expectError('borrar la cuenta del único owner también se bloquea', () =>
  db.query('delete from auth.users where id = $1', [uD]))

// ------------------------------------------------------------
console.log('\n== 10. Salir de la organización ==')
await asUserTx(uA, async () => {
  await expectBlock('el único owner no puede salir (lo bloquea el trigger)', () =>
    db.query(`delete from public.memberships where user_id = $1 and organization_id = $2`, [uA, orgA]),
    'al menos un owner')
})
await asUserTx(uC, async () => {
  await expectRows('un member no puede borrar la membresía de otro (0 filas)', () =>
    rowsOf(`delete from public.memberships where user_id = $1 and organization_id = $2 returning user_id`, [uB, orgA]), 0)
})
await asUserSession(uC, async () => {
  await expectRows('un member puede salir de la organización', () =>
    rowsOf(`delete from public.memberships where user_id = $1 and organization_id = $2 returning user_id`, [uC, orgA]), 1)
})
await asUserTx(uC, async () => {
  await expectRows('tras salir, C ya no ve los proyectos de orgA', () =>
    scalar(`select count(*) n from public.projects where workspace_id = '${wsA.id}'`), 0)
  await expectRows('tras salir, C ya no ve la organización', () =>
    scalar(`select count(*) n from public.organizations where id = '${orgA}'`), 0)
})
// C vuelve a entrar en orgA (como member) para las secciones siguientes.
await db.query("insert into public.memberships (user_id, organization_id, role) values ($1, $2, 'member')", [uC, orgA])

console.log('\n== 10a. El creador que sale ya no ve la organización ==')
// Org temporal creada "a mano" con owner_id = C (el trigger le da la membresía owner).
const tmpOrg = (await one(
  `insert into public.organizations (name, owner_id) values ('Org temporal', $1) returning id`, [uC])).id
await db.query("insert into public.memberships (user_id, organization_id, role) values ($1, $2, 'owner')", [uB, tmpOrg])
await asUserTx(uC, async () => {
  await expectRows('el creador ve su organización mientras es miembro', () =>
    scalar(`select count(*) n from public.organizations where id = '${tmpOrg}'`), 1)
})
await asUserSession(uC, async () => {
  await expectRows('el creador sale (hay otro owner)', () =>
    rowsOf(`delete from public.memberships where user_id = $1 and organization_id = $2 returning user_id`, [uC, tmpOrg]), 1)
})
await asUserTx(uC, async () => {
  await expectRows('tras salir, el creador (owner_id) ya no ve la organización', () =>
    scalar(`select count(*) n from public.organizations where id = '${tmpOrg}'`), 0)
})
await db.query('delete from public.organizations where id = $1', [tmpOrg])

console.log('\n== 10b. Solo un owner crea membresías owner ==')
await asUserTx(uB, async () => {
  await expectBlock('admin no puede crear membresías con rol owner', () =>
    db.query(`insert into public.memberships (user_id, organization_id, role) values ($1, $2, 'owner')`, [uD, orgA]),
    'row-level security')
  await expectRows('admin sí puede añadir members', () =>
    rowsOf(`insert into public.memberships (user_id, organization_id, role) values ($1, $2, 'member') returning user_id`, [uD, orgA]), 1)
})

// ------------------------------------------------------------
console.log('\n== 11. create_invitation: reinvitar, duplicados y miembros ==')
// E entra en orgA como member para las comprobaciones de esta sección.
const uE = (await one("insert into auth.users (email) values ('e@test') returning id")).id
await db.query("insert into public.memberships (user_id, organization_id, role) values ($1, $2, 'member')", [uE, orgA])

await asUserSession(uE, async () => {
  await expectBlock('un member no puede crear invitaciones (RPC)', () =>
    db.query(`select public.create_invitation($1, 'nuevo@test', 'member')`, [orgA]),
    'Solo owners y admins')
})
await asUserSession(uB, async () => {
  await expectBlock('un admin no puede invitar como owner (RPC)', () =>
    db.query(`select public.create_invitation($1, 'nuevo@test', 'owner')`, [orgA]),
    'Solo un owner')
})

let invId
await asUserSession(uA, async () => {
  invId = (await one(`select public.create_invitation($1, 'nuevo@test', 'member') as id`, [orgA])).id
  ok('el owner crea la invitación vía RPC')
})
await expectRows('invited_by lo fija la RPC (auth.uid), no el cliente', () =>
  scalar(`select count(*) n from public.invitations where id = '${invId}' and invited_by = '${uA}'`), 1)

await asUserSession(uA, async () => {
  await expectBlock('duplicado vigente rechazado (índice único)', () =>
    db.query(`select public.create_invitation($1, 'nuevo@test', 'member')`, [orgA]),
    'invitations_email_org_pending_idx')
})

// Si la invitación expira, reinvitar al mismo email vuelve a funcionar.
await db.query(`update public.invitations set expires_at = now() - interval '1 day' where id = $1`, [invId])
await asUserSession(uA, async () => {
  await expectRows('reinvitar tras expiración funciona', () =>
    rowsOf(`select public.create_invitation($1, 'nuevo@test', 'member')`, [orgA]), 1)
})
await expectRows('solo queda una invitación pendiente para ese email', () =>
  scalar(`select count(*) n from public.invitations where email = 'nuevo@test' and organization_id = '${orgA}' and accepted_at is null`), 1)

await asUserSession(uA, async () => {
  await expectBlock('no se puede invitar a quien ya es miembro', () =>
    db.query(`select public.create_invitation($1, 'b@test', 'member')`, [orgA]),
    'ya es miembro')
  await expectBlock('la normalización de email detecta miembros (mayúsculas/espacios)', () =>
    db.query(`select public.create_invitation($1, ' B@Test ', 'member')`, [orgA]),
    'ya es miembro')
})

console.log('\n== 11b. Aceptar siendo ya miembro: subir rol, nunca degradar ==')
// Estas invitaciones se crean con superusuario: la RPC las rechazaría
// porque E ya es miembro (cubren el caso "invitado antes de unirse").
const tokAdmin = (await one(
  `insert into public.invitations (email, organization_id, invited_by, role) values ('e@test', $1, $2, 'admin') returning token`,
  [orgA, uA])).token
await asUserSession(uE, async () => {
  await db.query('select public.accept_invitation($1)', [tokAdmin])
  ok('E acepta una invitación admin siendo member')
})
await expectRows('el rol de E sube a admin', () =>
  scalar(`select count(*) n from public.memberships where user_id = '${uE}' and organization_id = '${orgA}' and role = 'admin'`), 1)

const tokMember = (await one(
  `insert into public.invitations (email, organization_id, invited_by, role) values ('e@test', $1, $2, 'member') returning token`,
  [orgA, uA])).token
await asUserSession(uE, async () => {
  await db.query('select public.accept_invitation($1)', [tokMember])
  ok('E acepta una invitación member siendo admin')
})
await expectRows('E conserva el rol admin (no se degrada por invitación)', () =>
  scalar(`select count(*) n from public.memberships where user_id = '${uE}' and organization_id = '${orgA}' and role = 'admin'`), 1)

// ------------------------------------------------------------
console.log('\n== 12. Proyecto General por defecto ==')
// B (owner de orgB, member de orgA). Su workspace personal ya tiene General.
const defaultOf = async (workspaceId) =>
  (await one('select id from public.projects where workspace_id = $1 and is_default', [workspaceId])).id

await asUserSession(uB, async () => {
  // Un workspace nuevo crea su General (y insert ... returning funciona:
  // regresión de workspaces_select, migración …000004).
  const w2 = (await one(`insert into public.workspaces (organization_id, name) values ($1, 'Temporal') returning id`, [orgB])).id
  await expectRows('un workspace nuevo crea su proyecto General por defecto', () =>
    scalar(`select count(*) n from public.projects where workspace_id = '${w2}' and is_default and name = 'General'`), 1)
  const general = await defaultOf(w2)

  await expectError('una tarea sin proyecto no se puede crear', () =>
    db.query(`insert into public.tasks (project_id, title) values (null, 'huérfana')`))

  // Borrar un proyecto mueve sus tareas a General.
  const p1 = (await one(`insert into public.projects (workspace_id, name) values ($1, 'P1') returning id`, [w2])).id
  const t1 = (await one(`insert into public.tasks (project_id, title) values ($1, 'T1') returning id`, [p1])).id
  const t2 = (await one(`insert into public.tasks (project_id, title) values ($1, 'T2') returning id`, [p1])).id
  await expectRows('borrar un proyecto funciona', () =>
    rowsOf(`delete from public.projects where id = $1 returning id`, [p1]), 1)
  await expectRows('sus tareas se mueven a General y siguen accesibles', () =>
    scalar(`select count(*) n from public.tasks where id in ('${t1}', '${t2}') and project_id = '${general}'`), 2)

  await expectBlock('el proyecto General no se puede eliminar', () =>
    db.query(`delete from public.projects where id = $1`, [general]),
    'no se puede eliminar')
  await expectBlock('General no puede dejar de ser el de por defecto', () =>
    db.query(`update public.projects set is_default = false where id = $1`, [general]),
    'por defecto')
  const other = (await one(`insert into public.projects (workspace_id, name) values ($1, 'Otro') returning id`, [w2])).id
  await expectBlock('otro proyecto no puede pasar a ser el de por defecto', () =>
    db.query(`update public.projects set is_default = true where id = $1`, [other]),
    'por defecto')
  await expectError('no se puede crear un segundo proyecto por defecto', () =>
    db.query(`insert into public.projects (workspace_id, name, is_default) values ($1, 'Falso', true)`, [w2]))
  await expectRows('General se puede renombrar', () =>
    rowsOf(`update public.projects set name = 'Bandeja' where id = $1 returning id`, [general]), 1)

  // Borrar el workspace no tiene adónde mover: las tareas se eliminan.
  await expectRows('borrar el workspace funciona (hay otro workspace)', () =>
    rowsOf(`delete from public.workspaces where id = $1 returning id`, [w2]), 1)
  await expectRows('sus proyectos y General desaparecen', () =>
    scalar(`select count(*) n from public.projects where workspace_id = '${w2}'`), 0)
  await expectRows('sus tareas se eliminan, no quedan huérfanas', () =>
    scalar(`select count(*) n from public.tasks where id in ('${t1}', '${t2}')`), 0)
})

// ------------------------------------------------------------
console.log('\n== 13. Eliminar workspaces y organizaciones ==')
// orgB (personal de B) vuelve a tener un único workspace.
await asUserTx(uB, async () => {
  await expectBlock('no se puede borrar el último workspace', () =>
    db.query(`delete from public.workspaces where id = $1`, [wsB.id]),
    'al menos un workspace')
})

await asUserSession(uB, async () => {
  await expectBlock('un admin que no es owner no puede eliminar la organización', () =>
    db.query('select public.delete_organization($1)', [orgA]),
    'Solo un owner')
})
await asUserSession(uC, async () => {
  await expectBlock('quien ya no pertenece no puede eliminar la organización', () =>
    db.query('select public.delete_organization($1)', [orgA]),
    'Solo un owner')
})
await asUserSession(uA, async () => {
  await db.query('select public.delete_organization($1)', [orgA])
  ok('el owner elimina su organización')
})
await expectRows('la organización ya no existe', () =>
  scalar(`select count(*) n from public.organizations where id = '${orgA}'`), 0)
await expectRows('sus workspaces desaparecen', () =>
  scalar(`select count(*) n from public.workspaces where organization_id = '${orgA}'`), 0)
await expectRows('sus proyectos (incluido General) desaparecen', () =>
  scalar(`select count(*) n from public.projects where workspace_id = '${wsA.id}'`), 0)
await expectRows('sus etiquetas desaparecen', () =>
  scalar(`select count(*) n from public.tags where name = 'etiqueta-A'`), 0)
await expectRows('sus membresías e invitaciones desaparecen', () =>
  scalar(`select count(*) n from public.memberships where organization_id = '${orgA}'`), 0)
await expectRows('sus tareas se eliminan, no quedan huérfanas', () =>
  scalar(`select count(*) n from public.tasks where title = 'Tarea A'`), 0)

// ------------------------------------------------------------
console.log(`\n${passes} comprobaciones correctas, ${failures} fallidas`)
process.exit(failures === 0 ? 0 : 1)
