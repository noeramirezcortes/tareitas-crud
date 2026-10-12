# Fase 3 — Pendientes para terminar

> **Para:** el agente que corrige (p. ej. commandcode).
> **Estado base:** commit `2901115` en `main`, sincronizado con `origin/main`.
> Fase 3 funciona en las pruebas manuales. Este documento lista lo que falta
> para considerarla **cerrada y robusta**, en orden de prioridad.

---

## Estado al 2026-10-11

| Ítem | Estado |
|---|---|
| 1.1 + 2.1 `create_invitation` | ✅ `fcd95a9` |
| 1.2 último owner | ✅ `2f308c7` |
| 1.3 salir de la organización | ✅ `2d9f956` |
| 1.4 eliminar workspace/org | ✅ migraciones `…03`–`…05` (+ fix de `RETURNING` en `workspaces_select`) |
| 1.5 registro desde invitación | ✅ `from` + `emailRedirectTo` (requiere Redirect URLs, ver `guia-supabase-setup.md`) |
| 3.2 code splitting | ✅ `React.lazy` en las páginas de la app |
| 3.3 / 3.4 imports y lint | ✅ (quedan 2 warnings de shadcn, aceptados) |
| 3.5 CI | ✅ `.github/workflows/ci.yml` (falta verlo en verde en GitHub) |
| 3.1 tipos generados | ⏳ requiere Supabase CLI vinculada (`pnpm db:types`) |
| 3.6 pruebas de UI | ⏳ deuda |
| 3.7 probar migraciones en Supabase real | ⏳ requiere CLI/proyecto de prueba |

**Decisiones abiertas detectadas al cerrar (no estaban en este documento):**

1. **Tareas sin proyecto.** `tasks.project_id` es `on delete set null`, pero la
   RLS de `tasks` exige un proyecto y `user_id` ya no existe: una tarea con
   `project_id = null` es inaccesible para todos. Opciones: (a) `on delete
   cascade` (se borran de verdad, sin filas huérfanas), (b) un proyecto
   "Bandeja" por workspace al que migran, (c) dejarlo como está.
2. **El formulario de tareas ofrece "Sin proyecto" (valor por defecto)**, pero
   `tasks_insert` rechaza `project_id` nulo: crear una tarea sin elegir
   proyecto falla. Hay que exigir proyecto en el formulario o implementar (b).

---

## 0. Cómo trabajar (reglas)

1. **Un commit por ítem** (o por grupo lógico). Mensaje en el estilo del repo:
   `fix(db): …`, `feat(ui): …`, `chore: …`.
2. **Antes de cada commit** correr:
   ```bash
   pnpm typecheck && pnpm lint && pnpm build && pnpm test:rls
   ```
   No se commitea con errores de typecheck, build o `test:rls`.
3. **Cambios de base de datos = migración nueva.** No editar
   `20261010…` ni `20261011…` (ya están aplicadas en producción).
   Nombre: `supabase/migrations/20261012000000_<tema>.sql`, envuelta en `begin; … commit;`.
4. **Cada regla de BD nueva necesita un caso en `scripts/test-rls.mjs`** antes
   de darla por buena. Un bloqueo esperado debe fallar por la razón correcta
   (mensaje de RLS o excepción de la función), no por un error del script.
5. **No hacer `git push` sin confirmación del usuario.** Al terminar, reportar
   los commits y preguntar.
6. Los detalles de la base de datos están en la sección 1; no cambiar nombres
   de tablas ni columnas existentes.

### Modelo de datos de referencia (Fase 3)

| Tabla | Clave | Notas |
|---|---|---|
| `organizations` | `owner_id` | Dueño "de origen". **Puede divergir** de `memberships.role='owner'`. |
| `workspaces` | `organization_id` | `on delete cascade` desde org. |
| `memberships` | `(user_id, organization_id)` | `role` ∈ owner/admin/member. |
| `invitations` | `token` (uuid) | `expires_at` = +7 días. `accepted_at` marca uso. |
| `projects` / `tags` | `workspace_id` | `on delete cascade` desde workspace. |
| `tasks` | `project_id` | `on delete set null` (la tarea sobrevive sin proyecto). |

Funciones de autorización (SECURITY DEFINER, `search_path = ''`):
`user_has_workspace_access`, `user_is_org_admin`, `user_is_org_owner`.
RPCs: `create_organization`, `accept_invitation`, `list_org_members`.

---

## 1. Pendientes de base de datos e integridad (prioridad alta)

### 1.1 Una invitación expirada bloquea reinvitar al mismo email

**Problema.** El índice único parcial es:
```sql
create unique index invitations_email_org_pending_idx
  on public.invitations (email, organization_id)
  where accepted_at is null;
```
Solo excluye las **aceptadas**. Una invitación **expirada** y no aceptada
sigue ocupando el par `(email, org)`. El admin ve "Ya hay una invitación
pendiente" aunque ya no sea válida y tiene que cancelarla a mano.

**Por qué no basta con cambiar el índice.** PostgreSQL no admite `now()` en
el predicado de un índice parcial (no es inmutable).

**Solución propuesta.** Mover la creación a una RPC:
- `create_invitation(p_org uuid, p_email text, p_role org_role) returns uuid`
  (SECURITY DEFINER):
  1. Verifica que `auth.uid()` sea admin de `p_org` (y owner si `p_role='owner'`).
  2. Normaliza el email (`lower(trim(...))`).
  3. Borra las invitaciones **expiradas y no aceptadas** de ese email/org.
  4. Inserta la nueva con `invited_by = auth.uid()`.
  5. Devuelve el `id`.
- Quitar el `insert` directo desde el cliente (o dejarlo, pero la UI usa la RPC).
- Mantener el índice único: ahora sí protege invitaciones vigentes duplicadas.

**Archivos.**
- `supabase/migrations/20261012…_invitation_rpc.sql` (nuevo)
- `src/features/invitations/api.ts` → `createInvitation` llama `supabase.rpc('create_invitation', …)`
- `src/lib/supabase/database.types.ts` → añadir `create_invitation` en `Functions`
- `src/features/invitations/hooks/useInvitationMutations.ts` (mensaje de error sin cambios)

**Criterios de aceptación.**
- [ ] Invitar a X, dejar expirar (en el test, con `expires_at` en el pasado), reinvitar a X → funciona.
- [ ] Invitar a X dos veces con la primera vigente → error de duplicado.
- [ ] Un member no puede llamar la RPC (error).
- [ ] Un admin no puede crear invitación `owner` (error).
- [ ] `invited_by` no puede suplantarse (la RPC lo toma de `auth.uid()`).

**Tests a añadir en `test-rls.mjs`:** los cinco criterios anteriores.

---

### 1.2 El último owner puede desaparecer (la organización queda sin owner)

**Problema.** Nada impide que el único `owner` se degrade a `admin`/`member`
o se elimine de `memberships`. Entonces nadie puede gestionar owners ni
eliminar la organización. (Las políticas de `memberships` no comprueban el
recuento.)

**Solución propuesta.** Un **trigger** `BEFORE UPDATE OR DELETE ON memberships`
que, al dejar una organización sin owners, lance excepción:
```sql
create or replace function public.prevent_last_owner_removal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Caso UPDATE: el owner deja de serlo
  if tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner' then
    if (select count(*) from public.memberships
        where organization_id = old.organization_id and role = 'owner') <= 1 then
      raise exception 'La organización debe tener al menos un owner' using errcode = '23514';
    end if;
  end if;
  -- Caso DELETE
  if tg_op = 'DELETE' and old.role = 'owner' then
    if (select count(*) from public.memberships
        where organization_id = old.organization_id and role = 'owner') <= 1 then
      raise exception 'La organización debe tener al menos un owner' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger memberships_keep_one_owner
  before update or delete on public.memberships
  for each row execute function public.prevent_last_owner_removal();
```
Con el trigger, el `delete` de la cascada de `auth.users` (usuario borrado)
también se bloquea si es el último owner. **Decidir y documentar** ese caso:
o se permite borrar la cuenta y la org queda sin owner, o se bloquea. Lo más
seguro es bloquear y pedir transferir ownership primero (ver 1.3).

**Archivos.** `supabase/migrations/20261012…_last_owner.sql` (nuevo).
UI: en `MembersPanel`, si el rol a cambiar es el único owner, mostrar el error
del servidor (ya se muestra con `toast.error(error.message)`).

**Criterios de aceptación.**
- [ ] Con un único owner, `update … set role='admin'` falla con el mensaje.
- [ ] Con dos owners, degradar uno funciona.
- [ ] Con un único owner, `delete` de su membresía falla.
- [ ] Mensaje en español visible en la UI.

**Tests:** los tres casos anteriores en `test-rls.mjs`.

---

### 1.3 Un miembro no puede salir de la organización por sí mismo

**Problema.** La política `memberships_delete` solo permite a admins/owners
expulsar. Un `member` que quiere irse no tiene forma de hacerlo.

**Solución propuesta.** Nueva política:
```sql
create policy "memberships_delete_self" on public.memberships
  for delete using (user_id = auth.uid());
```
(El trigger de 1.2 impide que el último owner salga.)

Además, **antes de salir siendo owner**, la UI debe avisar. Y considerar
`organizations.owner_id`: si el owner de origen se va, esa columna queda
apuntando a alguien sin membresía. Decidir una de estas opciones y documentarla:
- (a) Al salir, si `owner_id = auth.uid()`, reasignarlo a otro owner en la misma transacción (RPC `leave_organization`).
- (b) Dejar `owner_id` como "creador histórico" y no usarlo para autorizar (ya no se usa en RLS salvo `organizations_insert`/`organizations_delete`).

Recomendación: **(b)** y cambiar `organizations_delete` para que solo lo use un owner
actual (`user_is_org_owner`), no `owner_id`. Así `owner_id` deja de ser una fuente de autorización.

**Archivos.** Migración `20261012…`; `src/features/memberships/api.ts`
(`leaveOrganization`); `src/features/memberships/components/MembersPanel.tsx`
(botón "Salir de la organización" para la propia fila); `OrganizationPage`
(tras salir, `selectOrganization` a la primera disponible y `refresh()`).

**Criterios de aceptación.**
- [ ] Un member se elimina a sí mismo → funciona y pierde acceso a sus proyectos.
- [ ] Un owner único no puede salir (lo bloquea 1.2).
- [ ] Tras salir, la UI cambia de organización sin errores.

**Tests:** member sale; después no ve proyectos de esa org.

---

### 1.4 Eliminar organizaciones y workspaces no tiene interfaz

**Problema.** Las políticas `organizations_delete` y `workspaces_delete` existen,
pero no hay botón. La organización solo se puede borrar si no tiene workspaces
(regla de la política). Un usuario no puede limpiar nada desde la app.

**Consecuencias que hay que mostrar en el diálogo de confirmación** (son reales):
- Borrar un **workspace** borra en cascada sus **proyectos** y **etiquetas**
  (`on delete cascade`). Las **tareas** sobreviven con `project_id = null`.
- Borrar una **organización** exige que no tenga workspaces (la política lo
  impide). Hay que borrar los workspaces primero.

**Solución propuesta.**
- Sección "Zona de peligro" en `OrganizationPage` (solo owner):
  - "Eliminar workspace" por cada workspace (no el último: ver abajo), con `ConfirmDialog destructive` que liste cuántos proyectos y etiquetas se borrarán.
  - "Eliminar organización" (solo si no tiene workspaces; si tiene, deshabilitado con explicación).
- **No permitir borrar el último workspace** de una org: cada org debe tener al menos uno. Validar en la RPC o en un trigger `before delete on workspaces`.
- Hooks: `useDeleteWorkspace` (ya no existe: se eliminó en la reescritura; recrearlo en `features/workspaces/hooks/useWorkspaceMutations.ts`) y `useDeleteOrganization` en `features/organizations/hooks/useOrganizationMutations.ts` (también eliminado; recrear).
- Tras borrar, `selectOrganization`/`selectWorkspace` a un id vigente (el contexto ya cae al primero disponible).

**Archivos.** `OrganizationPage.tsx`, `features/workspaces/api.ts`
(`deleteWorkspace`), `features/organizations/api.ts` (`deleteOrganization`),
hooks correspondientes, migración `20261012…` (trigger de último workspace).

**Criterios de aceptación.**
- [ ] Owner borra un workspace con proyectos → aparece el aviso con el conteo; tras confirmar, los proyectos desaparecen y las tareas quedan sin proyecto.
- [ ] No se puede borrar el último workspace (mensaje claro).
- [ ] No se puede borrar una organización con workspaces (botón deshabilitado + texto).
- [ ] Un admin no ve la zona de peligro.

**Tests:** trigger de último workspace; borrado de workspace deja tareas con `project_id null`.

---

### 1.5 Registro desde un enlace de invitación no vuelve al enlace

**Problema verificado.** `LoginForm` ya usa `from` y vuelve a `/invite/:token`
tras entrar. `RegisterForm` navega fijo a `/dashboard` o `/login`
(`src/features/auth/components/RegisterForm.tsx`, líneas ~32 y ~36). Una
persona sin cuenta, invitada, pierde el enlace.

**Solución propuesta (elegir una):**
- (a) Pasar el `from` de `RegisterPage` a `RegisterForm` y, tras el registro con sesión inmediata, navegar a `from`. Si hay confirmación de email, guardar el destino y mostrarlo en `/login`.
- (b) Al registrar, enviar `emailRedirectTo: window.location.origin + from` en `supabase.auth.signUp(...)` para que el correo de confirmación lleve de vuelta a `/invite/:token`. **Requiere** añadir esa URL a "Redirect URLs" en el dashboard de Supabase (Authentication → URL Configuration). Documentar el paso.

Recomendación: **(a) + (b)**. (a) cubre el caso sin confirmación; (b) el caso con confirmación.

**Archivos.** `src/features/auth/components/RegisterForm.tsx`, `src/pages/RegisterPage.tsx`, `src/features/auth/api.ts` (`signUp` acepta `redirectTo`).

**Criterios de aceptación.**
- [ ] Sin confirmación: invitado nuevo se registra y termina en `/invite/:token` listo para aceptar.
- [ ] Con confirmación: el correo lleva a la invitación (requiere el paso manual en Supabase, documentado).

---

## 2. Pendientes de integridad menores (prioridad media)

### 2.1 Invitar a alguien que ya es miembro

**Problema.** Se puede invitar a un email que ya está en la org. Al aceptar,
`on conflict do nothing` no cambia nada: si la invitación era `admin` y la
persona es `member`, **no se le sube el rol**, y la invitación se marca como
aceptada igual. Confuso.

**Solución.** En la RPC de 1.1 (`create_invitation`), rechazar si ya existe una
membresía con ese email. Requiere resolver email → user_id (`auth.users`,
solo en SECURITY DEFINER). En `accept_invitation`, si ya es miembro, o subir
el rol si la invitación es de mayor rango, o devolver un mensaje claro.

**Criterios.** Invitar a un miembro existente → error claro. Aceptar con rol mayor → rol actualizado (o error explícito, según la decisión que se tome).

### 2.2 Invitación "owner" a un miembro existente

Relacionado con 2.1: no debe permitir degradar por invitación. Cubierto si se
implementa 2.1.

### 2.3 Expulsar miembros con tareas asignadas

No hay "asignación de tareas" en el modelo, así que no hay impacto de datos hoy.
**Solo tomar nota**: si en una fase futura se añade `assignee_id`, revisar esto.

---

## 3. Pendientes técnicos (prioridad media-baja)

### 3.1 Tipos de la base de datos escritos a mano
`src/lib/supabase/database.types.ts` se mantiene a mano y ya tiene
`Functions` tipadas (create_organization, accept_invitation, list_org_members).
- Con la CLI vinculada: `supabase link` y luego `pnpm db:types`.
- Comparar el resultado con el archivo actual y **conservar** los tipos que el
  generador omita (p. ej. el orden de `Relationships`). Hacer un commit solo de
  tipos.
- Pendiente de tipar: `create_invitation` (cuando exista, ítem 1.1).

### 3.2 Bundle de 898 kB sin code splitting
- Aviso de Vite: `Some chunks are larger than 500 kB`.
- Solución: `React.lazy` + `Suspense` para `OrganizationPage`, `ProjectsPage`,
  `TasksPage`, `DashboardPage`, `AcceptInvitationPage` en `src/routes/index.tsx`.
- Criterio: el bundle inicial baja y `pnpm build` no avisa de chunk > 500 kB
  (o el aviso baja a un solo chunk de la app).

### 3.3 Import dinámico ineficaz (aviso de build)
`src/features/tasks/api.ts` líneas ~85 y ~106:
```ts
const { setTaskTags } = await import('@/features/tags/api')
```
Build avisa `INEFFECTIVE_DYNAMIC_IMPORT` porque `tags/api` ya se importa
estáticamente. **Cambiar a import estático** arriba del archivo.

### 3.4 Warnings de lint (3)
- `src/features/workspaces/WorkspaceContext.tsx` (`only-export-components`):
  el archivo exporta `WorkspaceProvider` **y** `useWorkspace`. Mover
  `useWorkspace` a `src/features/workspaces/useWorkspace.ts`, o aceptar el warning.
- `src/components/ui/button.tsx` y `badge.tsx`: código generado por shadcn.
  **No tocar**; documentado como aceptado.
- Criterio: `pnpm lint` sin warnings propios.

### 3.5 Sin CI
No hay verificación automática. Crear `.github/workflows/ci.yml` con:
- `pnpm install --frozen-lockfile`
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:rls`
- Disparar en `push` y `pull_request` a `main`.
- Criterio: el workflow pasa en GitHub en el commit de `main`.

### 3.6 Pruebas de interfaz inexistentes
Solo hay pruebas de base de datos (`test:rls`). Opciones:
- Playwright (E2E) con dos usuarios de prueba: flujo de invitación completo.
- Esto **no** es urgente; priorizar después de 1.1–1.5.

### 3.7 Pruebas de base de datos sobre PGlite, no sobre Supabase real
`test:rls` simula `auth.uid()` y los roles. Antes de producción, correr las
mismas migraciones en un **proyecto Supabase de prueba** (rama/proyecto aparte)
y repetir las pruebas manuales de la guía de Fase 3.

---

## 4. Limpieza del repositorio

- `.commandcode/` está **sin rastrear** en la raíz. Es herramienta local, no de
  la app: añadirla a `.gitignore` (no commitearla).
- `doc/FASE3.md` está **sin rastrear**. Es el prompt de la fase; decidir si se
  versiona (recomendado, igual que `FASE1.md` y `FASE2.md`) y commitearlo.
- `doc/arquitectura.md`: actualizar la sección de Fase 3 cuando se cierre este
  documento (estado "cerrada" y migraciones 1.x aplicadas).

---

## 5. Orden de trabajo sugerido

| # | Ítem | Tipo | Commit sugerido |
|---|---|---|---|
| 1 | 1.2 último owner (trigger) + tests | BD | `fix(db): impedir dejar una organización sin owner` |
| 2 | 1.3 salir de la organización | BD + UI | `feat: permitir salir de una organización` |
| 3 | 1.1 + 2.1 RPC `create_invitation` | BD + UI | `fix(db): reinvitar tras expiración y evitar duplicados` |
| 4 | 1.4 eliminar workspace/org + trigger último workspace | BD + UI | `feat: eliminar workspaces y organizaciones` |
| 5 | 1.5 redirección en registro | UI | `fix(auth): volver a la invitación tras registrarse` |
| 6 | 3.3 + 3.4 limpieza de lint/build | código | `chore: imports estáticos y warnings de lint` |
| 7 | 3.2 code splitting | código | `perf: carga diferida de páginas` |
| 8 | 3.1 tipos generados | código | `chore(types): regenerar tipos de la base` |
| 9 | 3.5 CI | infra | `ci: typecheck, lint, build y test:rls en GitHub Actions` |
| 10 | 4 limpieza | repo | `chore: ignorar .commandcode y versionar FASE3` |

Después de cada commit: `pnpm typecheck && pnpm lint && pnpm build && pnpm test:rls`.
Al terminar todos, **preguntar al usuario antes de hacer push**.

---

## 6. Definición de "Fase 3 cerrada"

- [ ] Ítems 1.1 a 1.5 implementados, con tests en `test:rls`.
- [ ] Ítems 3.3 y 3.4 resueltos (sin warnings propios ni avisos de import).
- [ ] Ítem 3.5 (CI) en verde en `main`.
- [ ] Pruebas manuales de la guía de Fase 3 repetidas tras los cambios.
- [ ] `doc/arquitectura.md` actualizado.
- [ ] Pendientes restantes (3.2, 3.6, 3.7) registrados como deuda, no olvidados.
