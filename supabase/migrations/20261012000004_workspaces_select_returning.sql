-- ============================================================
-- Fase 3 (cierre 1.4b) — INSERT ... RETURNING en workspaces
-- ============================================================
-- Requiere: 20261012000003_delete_org_workspace.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Problema: `insert ... returning` (lo que hace supabase-js con
-- `.insert().select()`) evalúa también la política SELECT sobre la fila
-- recién insertada. workspaces_select usaba user_has_workspace_access(id),
-- que busca la fila en public.workspaces por id; dentro de la misma
-- sentencia esa función no ve la fila nueva y devuelve false, así que
-- Postgres lo reportaba como "new row violates row-level security policy".
-- Resultado: crear un workspace fallaba desde la UI.
--
-- Solución: la política SELECT también acepta a los admins de la
-- organización usando la columna organization_id de la propia fila, sin
-- buscarla en la tabla. No amplía el acceso: quien es admin ya es miembro y
-- ya tenía acceso por user_has_workspace_access.
-- ============================================================

begin;

drop policy "workspaces_select" on public.workspaces;

create policy "workspaces_select" on public.workspaces
  for select using (
    public.user_has_workspace_access(id)
    or public.user_is_org_admin(organization_id)
  );

commit;
