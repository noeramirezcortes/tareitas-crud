-- ============================================================
-- Fase 1 — Tabla tasks + Row Level Security
-- ============================================================
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo)
-- o con CLI: `supabase db push` (tras `supabase link`).
-- Nunca editar esta migración una vez aplicada; crear una nueva.
-- ============================================================

-- 1. Tabla tasks ------------------------------------------------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  -- user_id referencia auth.users; el default auth.uid() permite
  -- insertar sin enviarlo (siempre será el usuario autenticado).
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  completed   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_user_id_idx on public.tasks (user_id);

-- 2. Trigger updated_at ----------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- 3. Row Level Security ----------------------------------------
-- La seguridad real vive aquí: aunque alguien consulte Supabase
-- fuera de la interfaz React, solo verá/tocará sus propias filas.
alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);

create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);

create policy "tasks_update_own" on public.tasks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);
