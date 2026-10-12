-- ============================================================
-- Verifica qué migraciones de Fase 3 están aplicadas en la base.
-- Solo lectura. Pegar en Supabase Dashboard → SQL Editor y ejecutar.
-- Cada fila busca un objeto que esa migración crea; "aplicada = true"
-- significa que el objeto existe (no depende de supabase_migrations).
-- ============================================================
select migracion, aplicada
from (
  values
    ('20261010000000_fase3_multitenant',
      to_regclass('public.organizations') is not null
      and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'user_has_workspace_access')),
    ('20261011000000_fase3_invitations_onboarding',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'accept_invitation')
      and exists (select 1 from pg_trigger where tgname = 'on_auth_user_created_workspace')),
    ('20261012000000_last_owner',
      exists (select 1 from pg_trigger where tgname = 'memberships_keep_one_owner')),
    ('20261012000001_leave_organization',
      exists (select 1 from pg_policies
              where schemaname = 'public' and policyname = 'memberships_delete_self')),
    ('20261012000002_create_invitation',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'create_invitation')),
    ('20261012000003_delete_org_workspace',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'delete_organization')
      and exists (select 1 from pg_trigger where tgname = 'workspaces_keep_one')),
    ('20261012000004_workspaces_select_returning',
      exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'workspaces'
                and policyname = 'workspaces_select' and qual like '%user_is_org_admin%')),
    ('20261012000005_owner_trigger_org_cascade',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'prevent_last_owner_removal'
                and p.prosrc like '%public.organizations%')),
    ('20261012000006_default_project',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'projects'
                and column_name = 'is_default')
      and exists (select 1 from pg_trigger where tgname = 'workspaces_create_default_project')),
    ('20261012000007_organizations_select_members',
      exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'organizations'
                and policyname = 'organizations_select' and qual not like '%owner_id%'))
) as m (migracion, aplicada)
order by migracion;

-- Datos que conviene revisar antes/después de aplicar:
-- tareas huérfanas de legado (project_id null): nadie puede verlas.
select count(*) as tareas_huerfanas from public.tasks where project_id is null;
