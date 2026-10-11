-- ============================================================
-- Fase 3 (cierre 1.1 + 2.1) — RPC create_invitation y accept_invitation robusta
-- ============================================================
-- Requiere: 20261012000001_leave_organization.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Problema 1.1: el índice único parcial (email, organization_id) solo excluye
-- las aceptadas; una invitación EXPIRADA seguía bloqueando reinvitar. No se
-- puede filtrar por expiración en el índice (now() no es inmutable), así que
-- la creación pasa por una RPC que limpia las expiradas antes de insertar.
-- Problema 2.1: se podía invitar a quien ya era miembro; al aceptar, el
-- "on conflict do nothing" dejaba el rol viejo pero marcaba la invitación
-- como aceptada. Ahora crearla se rechaza, y accept_invitation nunca
-- degrada: solo sube el rol si la invitación es de mayor rango.
-- El INSERT directo del cliente queda permitido (la policy ya existía), pero
-- la UI usa siempre la RPC.
-- ============================================================

begin;

-- ============================================================
-- 1. CREAR INVITACIÓN (RPC)
-- ============================================================
create or replace function public.create_invitation(p_org uuid, p_email text, p_role public.org_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;
  if not public.user_is_org_admin(p_org) then
    raise exception 'Solo owners y admins pueden crear invitaciones' using errcode = '42501';
  end if;
  if p_role = 'owner' and not public.user_is_org_owner(p_org) then
    raise exception 'Solo un owner puede invitar como owner' using errcode = '42501';
  end if;
  if position('@' in v_email) <= 1 or char_length(v_email) > 255 then
    raise exception 'Email no válido' using errcode = '22023';
  end if;

  -- No tiene sentido invitar a quien ya es miembro: el rol se cambia desde
  -- el panel de miembros, no con otra invitación.
  if exists (
    select 1
    from auth.users u
    join public.memberships m on m.user_id = u.id
    where lower(u.email) = v_email
      and m.organization_id = p_org
  ) then
    raise exception 'Esa persona ya es miembro de la organización' using errcode = '23505';
  end if;

  -- Las invitaciones expiradas y no aceptadas no bloquean reinvitar.
  delete from public.invitations
  where organization_id = p_org
    and lower(email) = v_email
    and accepted_at is null
    and expires_at <= now();

  -- invited_by se toma de auth.uid(): no se puede suplantar.
  insert into public.invitations (email, organization_id, role, invited_by)
  values (v_email, p_org, p_role, v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_invitation(uuid, text, public.org_role) from public, anon;
grant execute on function public.create_invitation(uuid, text, public.org_role) to authenticated;

-- ============================================================
-- 2. ACEPTAR INVITACIÓN: nunca degradar a un miembro existente
-- ============================================================
-- Si quien acepta ya es miembro (se unió por otra vía tras ser invitado),
-- solo se sube el rol cuando la invitación es de mayor rango; en caso
-- contrario la invitación se marca como aceptada sin tocar el rol.
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations%rowtype;
  v_uid uuid := auth.uid();
  v_email text;
  v_current_role public.org_role;
  v_rank_inv int;
  v_rank_cur int;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación' using errcode = '28000';
  end if;

  select u.email::text into v_email from auth.users u where u.id = v_uid;

  select * into inv from public.invitations where token = p_token for update;
  if not found then
    raise exception 'La invitación no existe' using errcode = 'P0002';
  end if;
  if inv.accepted_at is not null then
    raise exception 'La invitación ya fue aceptada' using errcode = 'P0001';
  end if;
  if inv.expires_at <= now() then
    raise exception 'La invitación ha expirado' using errcode = 'P0001';
  end if;
  if lower(coalesce(v_email, '')) <> lower(inv.email) then
    raise exception 'Esta invitación fue enviada a otro email' using errcode = '42501';
  end if;

  select m.role into v_current_role
  from public.memberships m
  where m.user_id = v_uid and m.organization_id = inv.organization_id;

  if v_current_role is null then
    insert into public.memberships (user_id, organization_id, role)
    values (v_uid, inv.organization_id, inv.role);
  else
    v_rank_inv := case inv.role when 'owner' then 3 when 'admin' then 2 else 1 end;
    v_rank_cur := case v_current_role when 'owner' then 3 when 'admin' then 2 else 1 end;
    if v_rank_inv > v_rank_cur then
      update public.memberships
      set role = inv.role
      where user_id = v_uid and organization_id = inv.organization_id;
    end if;
  end if;

  update public.invitations set accepted_at = now() where id = inv.id;

  return inv.organization_id;
end;
$$;

commit;
