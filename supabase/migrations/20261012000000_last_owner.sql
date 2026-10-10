-- ============================================================
-- Fase 3 (cierre 1.2) — Una organización nunca se queda sin owner
-- ============================================================
-- Requiere: 20261011000000_fase3_invitations_onboarding.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Sin este trigger, el único owner de una organización podía degradarse a
-- admin/member o borrar su membresía, y la org quedaba sin nadie capaz de
-- gestionar owners ni de eliminarla.
--
-- Decisión documentada (caso cuenta borrada): si se elimina el usuario de
-- auth.users que es el último owner, el borrado en cascada de su membresía
-- también queda bloqueado por este trigger (además del `on delete restrict`
-- de organizations.owner_id). Para borrar esa cuenta primero hay que
-- transferir el ownership a otro miembro.
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
  -- Caso DELETE: se elimina la membresía de un owner
  if tg_op = 'DELETE' and old.role = 'owner' then
    if (select count(*) from public.memberships
        where organization_id = old.organization_id and role = 'owner') <= 1 then
      raise exception 'La organización debe tener al menos un owner' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_one_owner
  before update or delete on public.memberships
  for each row execute function public.prevent_last_owner_removal();

commit;
