-- ============================================================
-- Fase 3 — Multi-Tenant SaaS: organizations, workspaces, memberships, invitations
-- ============================================================
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo)
-- o con CLI: `supabase db push` (tras `supabase link`).
-- Nunca editar esta migración una vez aplicada; crear una nueva.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
-- ============================================================

begin;

-- ============================================================
-- 1. TABLAS NUEVAS (sin policies todavía)
-- ============================================================
-- Primero se crean todas las tablas: las funciones y policies de los
-- pasos siguientes las referencian.

create type public.org_role as enum ('owner', 'admin', 'member');

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  owner_id    uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.workspaces (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 100),
  description     text check (description is null or char_length(description) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index workspaces_organization_id_idx on public.workspaces (organization_id);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.memberships (
  user_id         uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role            public.org_role not null default 'member',
  created_at      timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create index memberships_organization_id_idx on public.memberships (organization_id);

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  email           text not null check (char_length(email) <= 255),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role            public.org_role not null default 'member',
  invited_by      uuid not null references auth.users (id) on delete cascade,
  token           uuid not null default gen_random_uuid(),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Solo una invitación pendiente por email y organización
create unique index invitations_email_org_pending_idx
  on public.invitations (email, organization_id)
  where accepted_at is null;

create index invitations_organization_id_idx on public.invitations (organization_id);
create index invitations_token_idx on public.invitations (token);

-- ============================================================
-- 2. FUNCIONES DE AUTORIZACIÓN
-- ============================================================
-- SECURITY DEFINER + search_path vacío: leen workspaces/memberships sin
-- pasar por RLS. Sin esto, la policy de memberships llama a una función
-- que consulta memberships → recursión infinita de RLS.

create or replace function public.user_has_workspace_access(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    join public.memberships m on m.organization_id = w.organization_id
    where w.id = ws_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.user_is_org_admin(org_id uuid)
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
      and m.role in ('owner', 'admin')
  );
$$;

revoke execute on function public.user_has_workspace_access(uuid) from public, anon;
revoke execute on function public.user_is_org_admin(uuid) from public, anon;
grant execute on function public.user_has_workspace_access(uuid) to authenticated;
grant execute on function public.user_is_org_admin(uuid) to authenticated;

-- ============================================================
-- 3. RLS: organizations, workspaces, memberships, invitations
-- ============================================================
alter table public.organizations enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;

-- organizations ------------------------------------------------
-- owner_id = auth.uid() permite que el INSERT ... RETURNING del creador
-- funcione antes de que exista su fila en memberships.
create policy "organizations_select" on public.organizations
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

create policy "organizations_insert" on public.organizations
  for insert with check (auth.uid() = owner_id);

create policy "organizations_update" on public.organizations
  for update using (public.user_is_org_admin(id))
  with check (public.user_is_org_admin(id));

create policy "organizations_delete" on public.organizations
  for delete using (
    auth.uid() = owner_id
    and not exists (
      select 1 from public.workspaces w where w.organization_id = organizations.id
    )
  );

-- workspaces ---------------------------------------------------
create policy "workspaces_select" on public.workspaces
  for select using (public.user_has_workspace_access(id));

create policy "workspaces_insert" on public.workspaces
  for insert with check (public.user_is_org_admin(organization_id));

create policy "workspaces_update" on public.workspaces
  for update using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

create policy "workspaces_delete" on public.workspaces
  for delete using (public.user_is_org_admin(organization_id));

-- memberships --------------------------------------------------
create policy "memberships_select_own" on public.memberships
  for select using (user_id = auth.uid());

create policy "memberships_select_admin" on public.memberships
  for select using (public.user_is_org_admin(organization_id));

create policy "memberships_insert" on public.memberships
  for insert with check (public.user_is_org_admin(organization_id));

create policy "memberships_update" on public.memberships
  for update using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

create policy "memberships_delete" on public.memberships
  for delete using (
    public.user_is_org_admin(organization_id)
    and not (role = 'owner' and user_id = auth.uid())
  );

-- invitations --------------------------------------------------
create policy "invitations_select" on public.invitations
  for select using (public.user_is_org_admin(organization_id));

create policy "invitations_insert" on public.invitations
  for insert with check (public.user_is_org_admin(organization_id));

create policy "invitations_update" on public.invitations
  for update using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

create policy "invitations_delete" on public.invitations
  for delete using (public.user_is_org_admin(organization_id));

-- ============================================================
-- 4. BACKFILL: org + workspace + membership personal por usuario existente
-- ============================================================
-- Se ejecuta UNA sola vez. El trigger de owner se crea DESPUÉS de este
-- bloque para no duplicar la membresía que se inserta aquí.
do $$
declare
  u record;
  new_org_id uuid;
begin
  for u in select id, email from auth.users loop
    insert into public.organizations (name, owner_id)
    values ('Personal de ' || u.email, u.id)
    returning id into new_org_id;

    insert into public.memberships (user_id, organization_id, role)
    values (u.id, new_org_id, 'owner');

    insert into public.workspaces (organization_id, name, description)
    values (new_org_id, 'Personal', 'Tu espacio personal');
  end loop;
end $$;

-- A partir de ahora, cada organización nueva crea su membresía owner.
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.memberships (user_id, organization_id, role)
  values (new.owner_id, new.id, 'owner');
  return new;
end;
$$;

create trigger organizations_add_owner
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ============================================================
-- 5. ELIMINAR POLICIES BASADAS EN user_id
-- ============================================================
-- Deben borrarse ANTES de eliminar las columnas user_id: PostgreSQL no
-- permite DROP COLUMN mientras una policy dependa de ella.
drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

drop policy if exists "tags_select_own" on public.tags;
drop policy if exists "tags_insert_own" on public.tags;
drop policy if exists "tags_update_own" on public.tags;
drop policy if exists "tags_delete_own" on public.tags;

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

drop policy if exists "task_tags_select_own" on public.task_tags;
drop policy if exists "task_tags_insert_own" on public.task_tags;
drop policy if exists "task_tags_delete_own" on public.task_tags;

-- ============================================================
-- 6. PROJECTS: workspace_id + backfill + drop user_id
-- ============================================================
alter table public.projects
  add column workspace_id uuid references public.workspaces (id) on delete cascade;

update public.projects p
set workspace_id = (
  select w.id
  from public.workspaces w
  join public.memberships m on m.organization_id = w.organization_id
  where m.user_id = p.user_id and w.name = 'Personal'
  limit 1
);

alter table public.projects alter column workspace_id set not null;
create index projects_workspace_id_idx on public.projects (workspace_id);

alter table public.projects drop column user_id;

create policy "projects_select" on public.projects
  for select using (public.user_has_workspace_access(workspace_id));

create policy "projects_insert" on public.projects
  for insert with check (public.user_has_workspace_access(workspace_id));

create policy "projects_update" on public.projects
  for update using (public.user_has_workspace_access(workspace_id))
  with check (public.user_has_workspace_access(workspace_id));

create policy "projects_delete" on public.projects
  for delete using (public.user_has_workspace_access(workspace_id));

-- ============================================================
-- 7. TAGS: workspace_id + backfill + unique(workspace_id, name) + drop user_id
-- ============================================================
alter table public.tags
  add column workspace_id uuid references public.workspaces (id) on delete cascade;

update public.tags t
set workspace_id = (
  select w.id
  from public.workspaces w
  join public.memberships m on m.organization_id = w.organization_id
  where m.user_id = t.user_id and w.name = 'Personal'
  limit 1
);

alter table public.tags alter column workspace_id set not null;
create index tags_workspace_id_idx on public.tags (workspace_id);

alter table public.tags drop constraint if exists tags_user_id_name_key;
alter table public.tags add constraint tags_workspace_id_name_key unique (workspace_id, name);

alter table public.tags drop column user_id;

create policy "tags_select" on public.tags
  for select using (public.user_has_workspace_access(workspace_id));

create policy "tags_insert" on public.tags
  for insert with check (public.user_has_workspace_access(workspace_id));

create policy "tags_update" on public.tags
  for update using (public.user_has_workspace_access(workspace_id))
  with check (public.user_has_workspace_access(workspace_id));

create policy "tags_delete" on public.tags
  for delete using (public.user_has_workspace_access(workspace_id));

-- ============================================================
-- 8. TASKS: drop user_id (pertenencia vía project → workspace)
-- ============================================================
alter table public.tasks drop column if exists user_id;

create policy "tasks_select" on public.tasks
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and public.user_has_workspace_access(p.workspace_id)
    )
  );

create policy "tasks_insert" on public.tasks
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and public.user_has_workspace_access(p.workspace_id)
    )
  );

create policy "tasks_update" on public.tasks
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and public.user_has_workspace_access(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and public.user_has_workspace_access(p.workspace_id)
    )
  );

create policy "tasks_delete" on public.tasks
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and public.user_has_workspace_access(p.workspace_id)
    )
  );

-- ============================================================
-- 9. TASK_TAGS: RLS vía task → project → workspace
-- ============================================================
create policy "task_tags_select" on public.task_tags
  for select using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_tags.task_id
        and public.user_has_workspace_access(p.workspace_id)
    )
  );

create policy "task_tags_insert" on public.task_tags
  for insert with check (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_tags.task_id
        and public.user_has_workspace_access(p.workspace_id)
    )
    and exists (
      select 1 from public.tags g
      where g.id = task_tags.tag_id
        and public.user_has_workspace_access(g.workspace_id)
    )
  );

create policy "task_tags_delete" on public.task_tags
  for delete using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_tags.task_id
        and public.user_has_workspace_access(p.workspace_id)
    )
  );

-- ============================================================
-- 10. LIMPIEZA
-- ============================================================
drop index if exists projects_user_id_idx;
drop index if exists tasks_user_id_idx;
drop index if exists tags_user_id_idx;

commit;

-- ============================================================
-- FIN MIGRACIÓN FASE 3
-- ============================================================
