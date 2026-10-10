-- ============================================================
-- Fase 3 (parte 2) — Invitaciones seguras, reglas de owner, onboarding
-- ============================================================
-- Requiere haber aplicado antes: 20261010000000_fase3_multitenant.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
-- ============================================================

begin;

-- ============================================================
-- 1. HELPER: ¿es owner de la organización?
-- ============================================================
create or replace function public.user_is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

revoke execute on function public.user_is_org_owner(uuid) from public, anon;
grant execute on function public.user_is_org_owner(uuid) to authenticated;

-- ============================================================
-- 2. MEMBERSHIPS: solo un owner gestiona owners
-- ============================================================
-- Un admin puede cambiar roles y expulsar miembros, pero no puede
-- ascender a nadie a owner ni tocar a un owner (escalada de privilegios).
drop policy if exists "memberships_update" on public.memberships;
create policy "memberships_update" on public.memberships
  for update using (
    public.user_is_org_admin(organization_id)
    and (role <> 'owner' or public.user_is_org_owner(organization_id))
  )
  with check (
    public.user_is_org_admin(organization_id)
    and (role <> 'owner' or public.user_is_org_owner(organization_id))
  );

drop policy if exists "memberships_delete" on public.memberships;
create policy "memberships_delete" on public.memberships
  for delete using (
    public.user_is_org_admin(organization_id)
    and (role <> 'owner' or public.user_is_org_owner(organization_id))
    and not (user_id = auth.uid() and role = 'owner')
  );

-- ============================================================
-- 3. INVITATIONS: quien invita es el autenticado; solo owners invitan como owner
-- ============================================================
drop policy if exists "invitations_insert" on public.invitations;
create policy "invitations_insert" on public.invitations
  for insert with check (
    invited_by = auth.uid()
    and public.user_is_org_admin(organization_id)
    and (role <> 'owner' or public.user_is_org_owner(organization_id))
  );

-- Las invitaciones no se editan: se crean, se listan y se cancelan.
-- La aceptación pasa por accept_invitation(), nunca por un UPDATE directo.
drop policy if exists "invitations_update" on public.invitations;

-- ============================================================
-- 4. ACEPTAR INVITACIÓN
-- ============================================================
-- Seguridad: el token es un uuid secreto, debe estar vigente, no aceptado,
-- y el email de la cuenta autenticada debe coincidir con el de la invitación.
-- Así un enlace reenviado a otra persona no sirve.
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

  insert into public.memberships (user_id, organization_id, role)
  values (v_uid, inv.organization_id, inv.role)
  on conflict (user_id, organization_id) do nothing;

  update public.invitations set accepted_at = now() where id = inv.id;

  return inv.organization_id;
end;
$$;

revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ============================================================
-- 5. LISTAR MIEMBROS CON EMAIL
-- ============================================================
-- memberships no expone email (vive en auth.users). Esta función solo
-- devuelve miembros si quien llama también es miembro de la organización.
create or replace function public.list_org_members(p_org_id uuid)
returns table (
  user_id    uuid,
  email      text,
  role       public.org_role,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id and m.user_id = auth.uid()
  ) then
    raise exception 'No perteneces a esta organización' using errcode = '42501';
  end if;

  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_org_id
    order by m.created_at;
end;
$$;

revoke execute on function public.list_org_members(uuid) from public, anon;
grant execute on function public.list_org_members(uuid) to authenticated;

-- ============================================================
-- 6. CREAR ORGANIZACIÓN (atómico)
-- ============================================================
-- Crea la organización, la membresía owner (trigger) y un workspace inicial
-- "General" en una sola llamada. Sin esto, la organización quedaría vacía.
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(p_name);
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception 'El nombre debe tener entre 1 y 100 caracteres' using errcode = '22023';
  end if;

  insert into public.organizations (name, owner_id)
  values (v_name, v_uid)
  returning id into v_org;

  insert into public.workspaces (organization_id, name, description)
  values (v_org, 'General', 'Espacio principal de la organización');

  return v_org;
end;
$$;

revoke execute on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- ============================================================
-- 7. ONBOARDING: cada usuario nuevo recibe su organización personal
-- ============================================================
-- La migración 20261010 solo cubre usuarios existentes. Este trigger cubre
-- los registros posteriores: sin él, un usuario nuevo no tendría workspace.
create or replace function public.handle_new_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  insert into public.organizations (name, owner_id)
  values ('Personal de ' || coalesce(new.email, 'mi cuenta'), new.id)
  returning id into v_org;

  insert into public.workspaces (organization_id, name, description)
  values (v_org, 'Personal', 'Tu espacio personal');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_workspace on auth.users;
create trigger on_auth_user_created_workspace
  after insert on auth.users
  for each row execute function public.handle_new_user_workspace();

commit;
