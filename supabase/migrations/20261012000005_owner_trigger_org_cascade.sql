-- ============================================================
-- Fase 3 (cierre 1.4c) — Borrar una organización con su último owner
-- ============================================================
-- Requiere: 20261012000004_workspaces_select_returning.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Problema: delete_organization borra la fila de organizations y la cascada
-- elimina las membresías. El trigger memberships_keep_one_owner veía que se
-- borraba al último owner y bloqueaba toda la operación, haciendo imposible
-- eliminar una organización.
--
-- Solución: igual que prevent_last_workspace_removal, si la organización ya
-- no existe el borrado viene en cascada desde delete_organization y se
-- permite. El resto de casos no cambia: un DELETE directo de la membresía
-- del último owner (o borrar su cuenta de auth.users) sigue bloqueado
-- porque la organización todavía existe.
-- ============================================================

begin;

create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Caso UPDATE: el owner deja de serlo
  if tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner' then
    if (select count(*) from public.memberships
        where organization_id = old.organization_id and role = 'owner') <= 1 then
      raise exception 'La organización debe tener al menos un owner' using errcode = '23514';
    end if;
  end if;
  -- Caso DELETE: se elimina la membresía de un owner. Si la organización ya
  -- no existe, es la cascada de delete_organization y se permite.
  if tg_op = 'DELETE' and old.role = 'owner'
     and exists (select 1 from public.organizations o where o.id = old.organization_id) then
    if (select count(*) from public.memberships
        where organization_id = old.organization_id and role = 'owner') <= 1 then
      raise exception 'La organización debe tener al menos un owner' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

commit;
