-- ============================================================
-- Fase 3 (cierre 1.3) — Salir de la organización y endurecer memberships
-- ============================================================
-- Requiere: 20261012000000_last_owner.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Decisión documentada (organizations.owner_id): queda como "creador
-- histórico" y DEJA de usarse para autorizar. Borrar la organización
-- requiere ser owner actual (memberships.role = 'owner'), no el owner_id.
-- ============================================================

begin;

-- 1. Un miembro puede borrar SU PROPIA membresía (salir de la organización).
-- El trigger memberships_keep_one_owner (migración 20261012000000) impide
-- que el último owner salga: primero debe transferir el ownership.
create policy "memberships_delete_self" on public.memberships
  for delete using (user_id = auth.uid());

-- 2. Solo un owner puede crear membresías con rol owner.
-- Hasta aquí cualquier admin podía insertar directamente un owner nuevo
-- (escalada de privilegios por la vía INSERT; el UPDATE ya estaba cubierto).
drop policy if exists "memberships_insert" on public.memberships;
create policy "memberships_insert" on public.memberships
  for insert with check (
    public.user_is_org_admin(organization_id)
    and (role <> 'owner' or public.user_is_org_owner(organization_id))
  );

-- 3. organizations_delete ya no mira owner_id: solo un owner actual puede
-- borrar la organización, y sigue exigiendo que no tenga workspaces.
drop policy if exists "organizations_delete" on public.organizations;
create policy "organizations_delete" on public.organizations
  for delete using (
    public.user_is_org_owner(id)
    and not exists (
      select 1 from public.workspaces w where w.organization_id = organizations.id
    )
  );

commit;
