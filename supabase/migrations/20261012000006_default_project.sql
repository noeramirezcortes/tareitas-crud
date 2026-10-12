-- ============================================================
-- Fase 3 (cierre) — Proyecto "General" por defecto en cada workspace
-- ============================================================
-- Requiere: 20261012000005_owner_trigger_org_cascade.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Problema: tasks.project_id era opcional (on delete set null), pero la RLS
-- de tasks exige un proyecto y la columna user_id ya no existe. Una tarea
-- "sin proyecto" quedaba inaccesible para todos, y el formulario ofrecía
-- "Sin proyecto" como valor por defecto (crear una tarea así fallaba).
--
-- Reglas nuevas:
-- 1. Cada workspace tiene exactamente un proyecto por defecto ("General",
--    projects.is_default). Se crea con el workspace (trigger) y se
--    rellena para los existentes.
-- 2. Al borrar un proyecto, sus tareas se MUEVEN a General del mismo
--    workspace (trigger BEFORE DELETE). El proyecto General no se puede
--    borrar ni dejar de ser el de por defecto.
-- 3. Al borrar el workspace (o la organización) no hay adónde mover las
--    tareas: la cascada las elimina (tasks.project_id → on delete cascade),
--    en vez de dejar filas huérfanas e inaccesibles.
--
-- NO toca las tareas que ya estén con project_id null (legado de Fases 1-2:
-- la migración 20261010 borró user_id sin asignarlas y no se puede saber a
-- qué workspace pertenecen). Ver doc/FASE3-PENDIENTES.md para recuperarlas
-- a mano.
-- ============================================================

begin;

-- ============================================================
-- 1. Columna y backfill
-- ============================================================
alter table public.projects
  add column is_default boolean not null default false;

-- Si el workspace ya tiene un proyecto llamado "General", se reutiliza el
-- más antiguo en lugar de crear un duplicado.
with ranked as (
  select id,
         row_number() over (partition by workspace_id order by created_at, id) as rn
  from public.projects
  where lower(btrim(name)) = 'general'
)
update public.projects p
set is_default = true
from ranked r
where p.id = r.id and r.rn = 1;

insert into public.projects (workspace_id, name, description, is_default)
select w.id, 'General', 'Tareas sin un proyecto específico', true
from public.workspaces w
where not exists (
  select 1 from public.projects p where p.workspace_id = w.id and p.is_default
);

create unique index projects_one_default_per_workspace
  on public.projects (workspace_id)
  where is_default;

-- ============================================================
-- 2. Solo el sistema crea proyectos por defecto
-- ============================================================
-- Los triggers SECURITY DEFINER corren como propietario y no pasan por RLS.
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert with check (
    public.user_has_workspace_access(workspace_id)
    and not is_default
  );

create or replace function public.protect_default_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default is distinct from old.is_default then
    raise exception 'No se puede cambiar cuál es el proyecto por defecto' using errcode = '23514';
  end if;
  if old.is_default and new.workspace_id is distinct from old.workspace_id then
    raise exception 'El proyecto General no se puede mover a otro workspace' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger projects_protect_default
  before update on public.projects
  for each row execute function public.protect_default_project();

-- ============================================================
-- 3. Cada workspace nuevo crea su proyecto General
-- ============================================================
create or replace function public.create_default_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.projects (workspace_id, name, description, is_default)
  values (new.id, 'General', 'Tareas sin un proyecto específico', true);
  return new;
end;
$$;

create trigger workspaces_create_default_project
  after insert on public.workspaces
  for each row execute function public.create_default_project();

-- ============================================================
-- 4. Borrar un proyecto mueve sus tareas a General
-- ============================================================
create or replace function public.move_tasks_before_project_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default uuid;
begin
  -- Si el workspace ya no existe, el borrado viene en cascada desde
  -- workspaces/organizations: no hay adónde mover y las tareas se eliminan.
  if not exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    return old;
  end if;

  if old.is_default then
    raise exception 'El proyecto General no se puede eliminar' using errcode = '23514';
  end if;

  select p.id into v_default
  from public.projects p
  where p.workspace_id = old.workspace_id and p.is_default;

  if v_default is not null then
    update public.tasks set project_id = v_default where project_id = old.id;
  end if;
  return old;
end;
$$;

create trigger projects_move_tasks_on_delete
  before delete on public.projects
  for each row execute function public.move_tasks_before_project_delete();

-- ============================================================
-- 5. Tareas: la cascada elimina, ya no deja huérfanas
-- ============================================================
alter table public.tasks drop constraint tasks_project_id_fkey;
alter table public.tasks
  add constraint tasks_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete cascade;

commit;
