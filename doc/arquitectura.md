# Tareitas — Arquitectura del Proyecto

> Documento generado en la **Primera Tarea** (ver `doc/idea.md`).
> Define la arquitectura definitiva, las decisiones técnicas, los riesgos
> y la preparación previa a la Fase 1. Actualizarlo cuando una decisión
> cambie en fases futuras.

**Fecha:** 2026-10-07
**Estado:** Aprobado — Fases 0, 1 y 2 completadas

> **Fase 1 (2026-10-08):** auth completa (AuthProvider — decisión #10 realizada,
> contexto en `auth-context.ts` separado del provider por fast-refresh) + CRUD de
> `tasks` con RLS (migración `20261008000000_create_tasks.sql`).
> `database.types.ts` escrito a mano hasta vincular la CLI (`pnpm db:types`).
>
> **Fase 2 (2026-10-09):** `projects`, `tags` + `task_tags` (M2M), ampliación de
> `tasks` (`project_id`, `priority`, `due_date`, `status` — `completed` migra a
> `status='done'` y se elimina la columna: una sola fuente de verdad). Filtros
> server-side (PostgREST) con estado en la URL (`useSearchParams`). Dashboard
> con métricas reales sin librerías de gráficos. Migración
> `20261009000000_fase2_projects_tags.sql`.
>
> **Fase 3 (2026-10-09):** Arquitectura multi-tenant: `organizations`, `workspaces`,
> `memberships` (roles: owner/admin/member), `invitations`. Esquema migrado:
> `projects` → `workspace_id`, `tags` → `workspace_id`, `tasks` sin `user_id`
> (pertenencia vía project→workspace→org), `task_tags` RLS vía project→workspace.
> RLS helper functions: `user_has_workspace_access()`, `user_is_org_admin()`.
> UI: selector organización/workspace, invitaciones por email, gestión miembros/roles.
> Migración: `20261010000000_fase3_multitenant.sql` con backfill automático de
> org/workspace personal para usuarios existentes.

---

## 1. Arquitectura definitiva

**Patrón general:** SPA + BaaS. Sin servidor propio.

```
┌─────────────────────────────────────────────────────┐
│  React SPA (Vite + TypeScript strict)               │
│                                                     │
│  ┌───────────┐   ┌──────────────┐   ┌────────────┐  │
│  │ UI Layer  │──▶│ Feature Layer│──▶│ Data Layer │  │
│  │ (pages,   │   │ (hooks,      │   │ (api.ts    │  │
│  │ components│   │  lógica de   │   │  por       │  │
│  │           │   │  negocio)    │   │  feature)  │  │
│  └───────────┘   └──────────────┘   └─────┬──────┘  │
│        ▲                                  │         │
│        │ TanStack Query (cache,           ▼         │
│        │  loading/error states)     Supabase Client │
│        │                            (anon key + JWT)│
└────────┼──────────────────────────────────┼─────────┘
         │                                  │
         └────────── feedback ◀─────────────┘
                                          │
                              ┌───────────▼──────────┐
                              │  Supabase (cloud)    │
                              │  PostgreSQL + RLS    │
                              │  Auth (JWT)          │
                              └──────────────────────┘
```

### Reglas de flujo (una sola dirección)

- Los componentes **nunca** llaman a Supabase directamente; pasan por hooks del feature.
- Los hooks usan TanStack Query (`useQuery`/`useMutation`) que invoca `api.ts` del feature.
- `api.ts` es el **único** lugar que importa `lib/supabase/client`.
- Zod valida en el borde (forms con `zodResolver`, env vars al arranque).
- La **seguridad real vive en RLS**; los route guards de React son solo UX.

### Estado

- **Server state** → TanStack Query (única fuente para datos remotos).
- **Estado global pequeño** (tema, sesión) → React Context (máximo 1–2 contextos).
- **No Redux.**

---

## 2. Estructura de directorios

```
tareitas/
├── doc/                          # documentación del proyecto
├── supabase/
│   └── migrations/               # SQL reproducible, versionado
├── public/
├── src/
│   ├── main.tsx                  # providers (Query, Router)
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── ui/                   # shadcn/ui (código copiado, no dependencia)
│   │   └── common/               # LoadingSpinner, EmptyState, ErrorState,
│   │                             # ConfirmDialog…
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/            # useLogin, useSession, useLogout…
│   │   │   ├── api.ts            # único punto que toca supabase.auth
│   │   │   ├── schemas.ts        # zod: loginSchema, registerSchema
│   │   │   └── types.ts
│   │   └── tasks/                # misma forma interna
│   ├── pages/                    # componentes de ruta (ligeros, componen features)
│   ├── routes/
│   │   ├── index.tsx             # árbol de rutas
│   │   └── ProtectedRoute.tsx    # guard (UX; la seguridad real es RLS)
│   ├── hooks/                    # hooks globales reutilizables
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # singleton del client
│   │   │   └── database.types.ts # generado por Supabase CLI
│   │   └── query/
│   │       └── client.ts         # QueryClient (staleTime, retries)
│   ├── config/
│   │   └── env.ts                # validación de VITE_* con zod al arranque
│   ├── schemas/                  # zod compartido entre features (solo si aplica)
│   ├── types/                    # tipos globales
│   └── utils/
├── .env.example
├── .gitignore
├── .gitattributes
├── components.json               # shadcn/ui
├── eslint.config.js
├── package.json
├── README.md
├── tailwind (vía @tailwindcss/vite, sin tailwind.config)
├── tsconfig.json                 # strict + paths "@/*"
└── vite.config.ts
```

### Ajustes vs. la estructura sugerida en `idea.md`

1. **`supabase/migrations/` en la raíz** — el doc exige migraciones reproducibles; es la convención de Supabase CLI.
2. **`lib/supabase/database.types.ts`** — tipos generados desde la DB (`supabase gen types`), garantizan que TS y el esquema real no diverjan.
3. **`config/env.ts`** — fallar rápido al arranque si falta `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, en lugar de errores opacos en runtime.

### Regla anti-crecimiento-caótico

Cada feature expone solo su API pública; prohibido importar archivos internos de otro feature (p. ej. `features/tasks/...` desde `features/auth/...`). Lo compartido se promueve a `components/common`, `hooks/`, `utils/` o `types/`.

---

## 3. Decisiones técnicas

| # | Decisión | Por qué | Consecuencia |
|---|----------|---------|--------------|
| 1 | **Supabase como único backend** | Evita backend custom; PostgreSQL + Auth + RLS resuelven el problema | Lock-in mitigado: acceso a datos aislado en `api.ts` por feature |
| 2 | **RLS-first security** | "No confiar en filtros del frontend" | Toda tabla lleva políticas `user_id = auth.uid()` desde la primera migración; default **deny** |
| 3 | **Zod como fuente de verdad** | Un schema → tipos inferidos + validación runtime | Sin duplicación tipo/validación |
| 4 | **TanStack Query, no Redux** | Simplicidad; server state ≠ UI state | Estados separados conceptualmente |
| 5 | **shadcn/ui (copia de código, no paquete)** | Control total; Radix = accesibilidad base | `components/ui/` es código propio, editable |
| 6 | **Tipos de DB generados por CLI** | Elimina drift esquema↔código | Regenerarlos tras cada migración (`pnpm db:types`) |
| 7 | **Migraciones SQL con Supabase CLI** | Reproducibilidad | Nunca editar una migración ya aplicada; siempre crear nuevas |
| 8 | **Path alias `@/`** | Imports legibles | Config en `tsconfig.json` + `vite.config.ts` |
| 9 | **Env vars validadas con zod en arranque** | Fail-fast | Solo `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; **jamás** service role key |
| 10 | **Auth context mínimo** | Supabase emite eventos de sesión | Un `AuthProvider` pequeño que escucha `onAuthStateChange` y expone `session/user` (Fase 1) |
| 11 | **Sin tests en Fase 0/1** | El doc no los exige | Riesgo aceptado; añadir Vitest cuando haya lógica que proteger |

### Decisiones de entorno (cerradas con el usuario)

| Decisión | Elección |
|----------|----------|
| Supabase | Proyecto **cloud**; Supabase CLI solo para tipos y migraciones. Sin Docker local por ahora. |
| Gestor de paquetes | **pnpm** (vía corepack; fallback npm) |
| Git | Repo local; remoto GitHub se vincula después |
| Entregable de esta tarea | Este documento |

---

## 4. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|--------|---------|------------|
| 1 | **RLS mal configurado → fuga de datos entre usuarios** | Crítico | Política deny-by-default; checklist RLS en cada migración; prueba manual con 2 usuarios antes de cerrar fases con datos |
| 2 | **Sobre-abstracción prematura** (capas genéricas, "repositorios" universales) | Medio | Servicios por feature, funciones simples, sin clases; prohibido abstraer hasta el 2º caso de uso real |
| 3 | **Vendor lock-in Supabase** | Medio | Supabase solo se importa en `api.ts` y `client.ts`; el resto de la app habla con tipos propios |
| 4 | **Secretos expuestos en `VITE_*`** (todo `VITE_*` es público) | Crítico | Solo URL + anon key; documentado en `.env.example` y README; service role solo en Edge Functions futuras |
| 5 | **Tipos generados desactualizados** tras una migración | Medio | `pnpm db:types` + paso obligatorio en el checklist de cierre de fase |
| 6 | **Sin cobertura de tests** | Medio | Aceptado conscientemente; introducir Vitest en una fase posterior |
| 7 | **Imports cruzados entre features** | Medio | Regla de API pública por feature; revisión en cada fase |
| 8 | **Edge cases de sesión** (expiración, refresh, logout en otra pestaña) | Bajo | Supabase client auto-refresca; `AuthProvider` reaccionará a `onAuthStateChange` (Fase 1) |
| 9 | **Realtime prematuro** | Bajo | No se configura hasta que exista caso de uso real |
| 10 | **Deuda de UX states** (loading/empty/error olvidados) | Medio | Componentes `common/` listos desde Fase 0 (`EmptyState`, `ErrorState`, `LoadingSpinner`, `ConfirmDialog`) |

---

## 5. Preparación previa a la Fase 1 (Fase 0) — COMPLETADA

- [x] Scaffold Vite (react-ts) + limpieza de boilerplate
- [x] TypeScript strict + path alias `@/*`
- [x] Tailwind CSS + shadcn/ui + componentes base (button, input, label, card, dialog, sonner, dropdown-menu, avatar, skeleton)
- [x] Linter (oxlint)
- [x] TanStack Query (provider + cliente)
- [x] React Router (`routes/` + `ProtectedRoute` placeholder)
- [x] Supabase client + validación de env con zod
- [x] `.env.example` + `.gitignore` + `.gitattributes`
- [x] Estructura de carpetas completa
- [x] README.md (setup, scripts, seguridad, checklist de fase)
- [x] Scripts: `dev`, `build`, `lint`, `typecheck`, `db:types`
- [x] Validación: typecheck ✓ lint ✓ build ✓
- [x] Repo git local + commit inicial

### Notas de ejecución de Fase 0 (desviaciones respecto al plan)

1. **Versiones del template actual:** React 19, Vite 8, TypeScript 6, Tailwind 4, shadcn CLI v4 (preset `nova`, base `radix`, Lucide).
2. **oxlint en lugar de ESLint** — el template oficial de Vite 8 ya lo trae configurado; cumple el requisito "ejecutar lint" del doc con cero configuración extra. Si una fase futura necesita reglas de ESLint ecosistema, se evaluará entonces.
3. **`form` (shadcn) no existe en el registry v4** — era un wrapper opcional sobre React Hook Form. No bloquea: RHF + `zodResolver` funcionan directamente; si conviene, se escribe el wrapper a mano en Fase 1.
4. **TypeScript 6 depreca `baseUrl`** — los path aliases `@/*` se configuran solo con `paths` (resueltos relativos al tsconfig).
5. **pnpm instalado vía `npm install -g pnpm`** — `corepack enable` requería permisos de administrador.

### Pendiente para el usuario antes de Fase 1

1. Crear el proyecto en [supabase.com](https://supabase.com) (o indicar uno existente).
2. Copiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`.
3. Pasar la URL del repo de GitHub para configurar el remoto.

---

## 6. Checklist de cierre de cada fase (obligatorio)

1. `pnpm typecheck` ✓
2. `pnpm lint` ✓
3. `pnpm build` ✓
4. Corregir errores y revisar warnings relevantes
5. Si hubo migraciones: verificar RLS y regenerar tipos (`pnpm db:types`)
6. Actualizar este documento si cambió alguna decisión
