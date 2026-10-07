# Tareitas

Aplicación SaaS moderna de gestión de tareas. Desarrollo incremental por fases — ver `doc/idea.md` (reglas) y `doc/arquitectura.md` (decisiones de arquitectura).

## Stack

- **Frontend:** React 19 + Vite 8 + TypeScript (strict)
- **UI:** Tailwind CSS 4 + shadcn/ui + Lucide Icons
- **Routing:** React Router
- **Backend / DB:** Supabase (PostgreSQL + Auth + RLS)
- **Server state:** TanStack Query
- **Validación:** Zod
- **Forms:** React Hook Form + `@hookform/resolvers`

## Requisitos

- Node.js ≥ 20 (recomendado 24)
- pnpm (`npm install -g pnpm`)
- Proyecto en [supabase.com](https://supabase.com) (para desarrollo contra cloud)

## Setup

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env
#    Editar .env con tus claves de Supabase:
#    Dashboard → Project Settings → API → Project URL / anon public key

# 3. Arrancar en desarrollo
pnpm dev
```

## Scripts

| Script           | Descripción                                              |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo                                   |
| `pnpm build`     | Typecheck + build de producción                          |
| `pnpm lint`      | Linter (oxlint)                                          |
| `pnpm typecheck` | Verificación de tipos (`tsc -b`)                         |
| `pnpm db:types`  | Regenera `src/lib/supabase/database.types.ts` desde la DB vinculada (requiere Supabase CLI + `supabase link`) |
| `pnpm preview`   | Sirve el build de producción                             |

## Estructura

```
src/
  components/   ui/ (shadcn) + common/ (LoadingSpinner, EmptyState, ErrorState, ConfirmDialog)
  features/     auth/, tasks/ — cada feature: components/, hooks/, api.ts, schemas.ts, types.ts
  pages/        componentes de ruta
  routes/       árbol de rutas + ProtectedRoute
  hooks/        hooks globales
  lib/          supabase/ (client + tipos generados), query/ (QueryClient), utils
  config/       env.ts (validación de VITE_* con zod)
  schemas/      zod compartido
  types/        tipos globales
  utils/
supabase/
  migrations/   migraciones SQL reproducibles
```

Ver `doc/arquitectura.md` para las reglas de flujo (UI → hooks → api.ts → Supabase) y la regla de API pública por feature.

## Seguridad

- **La seguridad real vive en Row Level Security (PostgreSQL).** Las rutas protegidas de React son solo UX.
- Todo `VITE_*` es **público** en el bundle. Solo se permiten `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- **Nunca** usar la `service_role` key en el frontend.
- Toda tabla nueva debe llevar políticas RLS (deny-by-default) desde su primera migración.

## Checklist de cierre de fase

Antes de dar por terminada una fase:

1. `pnpm typecheck` ✓
2. `pnpm lint` ✓
3. `pnpm build` ✓
4. Si hubo migraciones: verificar políticas RLS y ejecutar `pnpm db:types`
5. Actualizar `doc/arquitectura.md` si cambió alguna decisión
