-- ============================================================
-- Fase 3 (cierre 1.4) — Eliminar workspaces y organizaciones
-- ============================================================
-- Requiere: 20261012000002_create_invitation.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Reglas:
-- 1. Una organización siempre conserva al menos un workspace: el trigger
--    bloquea el borrado directo del último workspace (PostgREST/UI).
-- 2. La única vía de borrar "todo" es delete_organization (RPC, owner
--    actual únicamente), que elimina la org y deja la cascada hacer su
--    trabajo. Como el borrado en cascada llega DESPUÉS de eliminar la fila
--    de organizations, el trigger lo permite: ahí la org ya no existe.
--    Sin esa excepción implícita, las reglas 1 + "org sin workspaces"
--    harían imposible borrar ninguna organización.
-- 3. organizations_delete (RLS directa) sigue exigiendo cero workspaces:
--    defensa en profundidad por si alguien usa el cliente sin la RPC.
-- Consecuencias de la cascada (se muestran en el diálogo de confirmación
-- de la UI): borrar un workspace borra sus proyectos y etiquetas; las
-- tareas conservan la fila con project_id = null (on delete set null) pero
-- la RLS de tasks exige un proyecto, así que dejan de ser accesibles.
-- ============================================================

begin;

-- ============================================================
-- 1. No borrar el último workspace de una organización
-- ============================================================
create or replace function public.prevent_last_workspace_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Si la organización ya no existe, el borrado viene en cascada desde
  -- delete_organization y se permite.
  if exists (select 1 from public.organizations o where o.id = old.organization_id)
     and (select count(*) from public.workspaces w where w.organization_id = old.organization_id) <= 1 then
    raise exception 'La organización debe tener al menos un workspace' using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger workspaces_keep_one
  before delete on public.workspaces
  for each row execute function public.prevent_last_workspace_removal();

-- ============================================================
-- 2. Eliminar la organización completa (RPC)
-- ============================================================
-- Solo el owner actual. Borra la fila de organizations y deja que la
-- cascada elimine workspaces, proyectos, etiquetas, membresías e
-- invitaciones. Las tareas sobreviven con project_id = null.
create or replace function public.delete_organization(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'La organización no existe' using errcode = 'P0002';
  end if;
  if not public.user_is_org_owner(p_org) then
    raise exception 'Solo un owner puede eliminar la organización' using errcode = '42501';
  end if;

  delete from public.organizations where id = p_org;
end;
$$;

revoke execute on function public.delete_organization(uuid) from public, anon;
grant execute on function public.delete_organization(uuid) to authenticated;

commit;
