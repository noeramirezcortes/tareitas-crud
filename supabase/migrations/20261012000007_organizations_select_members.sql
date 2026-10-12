-- ============================================================
-- Fase 3 (cierre) — organizations_select solo para miembros actuales
-- ============================================================
-- Requiere: 20261012000006_default_project.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Bug detectado por las pruebas de UI (e2e/organization.spec.ts): la policy
-- de SELECT seguía aceptando `owner_id = auth.uid()`. Quien creó una
-- organización y luego salió de ella (tras transferir el ownership)
-- seguía viéndola: aparecía en su selector, sin workspaces ("Sin workspace"),
-- y no podía quitársela. La migración 20261012000001 ya decidió que
-- owner_id es "creador histórico" y no autoriza; faltaba esta policy.
--
-- La clausula owner_id existía para que `INSERT ... RETURNING` directo del
-- creador funcionara antes de que el trigger creara su membresía. La app
-- crea organizaciones con la función create_organization (SECURITY DEFINER),
-- que no pasa por esa policy, así que ya no hace falta.
-- ============================================================

begin;

drop policy if exists "organizations_select" on public.organizations;
create policy "organizations_select" on public.organizations
  for select using (
    exists (
      select 1 from public.memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

commit;
