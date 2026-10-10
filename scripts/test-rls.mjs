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
const pA = (await one('insert into public.projects (user_id, name) values ($1, $2) returning id', [uA, 'Proyecto A'])).id
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

await expectRows('proyectos conservados', () => scalar('select count(*) n from public.projects'), 2)
await expectRows('proyectos con workspace_id', () => scalar('select count(*) n from public.projects where workspace_id is not null'), 2)
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
  await expectRows('member ve los proyectos de orgA (2 = el suyo + el de A)', () =>
    scalar('select count(*) n from public.projects'), 2)
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
  await expectRows('C (member) ve el proyecto de orgA y ningún otro', () => scalar('select count(*) n from public.projects'), 1)
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
console.log(`\n${passes} comprobaciones correctas, ${failures} fallidas`)
process.exit(failures === 0 ? 0 : 1)
