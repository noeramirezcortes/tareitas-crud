-- ============================================================
-- Fase 2 — Productividad: projects, ampliación de tasks, tags
-- ============================================================
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo)
-- o con CLI: `supabase db push`.
-- Nunca editar esta migración una vez aplicada; crear una nueva.
-- ============================================================

-- ============================================================
-- 1. PROJECTS
-- ============================================================
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 2. TASKS: project_id, priority, due_date, status
-- ============================================================
-- project_id: al eliminar un proyecto, sus tareas NO se borran,
-- quedan sin proyecto (set null).
alter table public.tasks
  add column project_id uuid references public.projects (id) on delete set null;

alter table public.tasks
  add column priority text not null default 'medium'
  check (priority in ('low', 'medium', 'high'));

alter table public.tasks
  add column due_date date;

-- status sustituye a completed (decisión: una sola fuente de verdad;
-- completed equivaldría a status = 'done' y mantener ambos dessincroniza).
alter table public.tasks
  add column status text not null default 'pending';

update public.tasks set status = 'done' where completed;

alter table public.tasks drop column completed;

alter table public.tasks
  add constraint tasks_status_check check (status in ('pending', 'in_progress', 'done'));

create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_status_idx on public.tasks (status);
create index tasks_due_date_idx on public.tasks (due_date);

-- ============================================================
-- 3. TAGS (reutilizables, nombre único por usuario)
-- ============================================================
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, name)
);

create index tags_user_id_idx on public.tags (user_id);

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

alter table public.tags enable row level security;

create policy "tags_select_own" on public.tags
  for select using (auth.uid() = user_id);
create policy "tags_insert_own" on public.tags
  for insert with check (auth.uid() = user_id);
create policy "tags_update_own" on public.tags
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tags_delete_own" on public.tags
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 4. TASK_TAGS (relación many-to-many)
-- ============================================================
create table public.task_tags (
  task_id    uuid not null references public.tasks (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (task_id, tag_id)
);

create index task_tags_tag_id_idx on public.task_tags (tag_id);

-- Sin UPDATE: el vínculo se borra y se crea (PK compuesta).
alter table public.task_tags enable row level security;

-- Solo puedes ver/vincular/eliminar vínculos de TUS tareas con TUS tags.
create policy "task_tags_select_own" on public.task_tags
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and t.user_id = auth.uid()
    )
  );

create policy "task_tags_insert_own" on public.task_tags
  for insert with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and t.user_id = auth.uid()
    )
    and exists (
      select 1 from public.tags g
      where g.id = tag_id and g.user_id = auth.uid()
    )
  );

create policy "task_tags_delete_own" on public.task_tags
  for delete using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and t.user_id = auth.uid()
    )
  );
