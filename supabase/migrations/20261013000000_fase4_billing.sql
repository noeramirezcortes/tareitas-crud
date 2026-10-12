-- ============================================================
-- Fase 4 — Billing (Stripe): planes, suscripciones y límites
-- ============================================================
-- Requiere: 20261012000007_organizations_select_members.sql
-- Aplicar con: Supabase Dashboard → SQL Editor (pegar todo) o `supabase db push`.
-- Va envuelta en una transacción: si algo falla, no queda nada a medias.
--
-- Modelo (el billing es por ORGANIZACIÓN):
--
--   plans              catálogo de planes y sus límites (null = ilimitado)
--   subscriptions      estado de la suscripción de Stripe por organización
--   billing_customers  organización ↔ Stripe Customer (solo servidor)
--   stripe_events      eventos de webhook ya procesados (idempotencia)
--
-- Reglas:
-- 1. Stripe es la fuente de verdad. El cliente NUNCA escribe en estas
--    tablas: solo el servidor (service_role, desde las Edge Functions) lo
--    hace, y únicamente a través de billing_apply_subscription().
-- 2. Sin fila en subscriptions (o con un estado que no da acceso) la
--    organización está en el plan 'free'. No hay que migrar datos
--    existentes: todas las organizaciones actuales son FREE.
-- 3. Los límites se aplican con triggers BEFORE INSERT: se conserva lo ya
--    creado (si una organización baja de plan, no se borra nada) pero no
--    se puede crear más por encima del límite.
-- 4. Un pago fallido (past_due) conserva el plan 7 días de gracia.
--
-- Errores de límite: SQLSTATE 'PT402' (PostgREST lo devuelve como HTTP
-- 402 Payment Required); el campo hint indica el recurso
-- (workspaces | projects | members | feature:<nombre>).
-- ============================================================

begin;

-- ============================================================
-- 1. Planes
-- ============================================================
create table public.plans (
  code            text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  name            text not null,
  description     text,
  -- null = ilimitado
  max_workspaces  integer check (max_workspaces is null or max_workspaces >= 1),
  max_projects    integer check (max_projects   is null or max_projects   >= 0),
  max_members     integer check (max_members    is null or max_members    >= 1),
  -- Funciones premium: {"tags": true}. Una clave ausente cuenta como false.
  features        jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(features) = 'object'),
  -- Price de Stripe (price_...). Distinto en test y en live: se asigna con
  -- un UPDATE (ver doc/guia-stripe.md). null en planes que no se cobran.
  stripe_price_id text unique,
  is_public       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

insert into public.plans (code, name, description, max_workspaces, max_projects, max_members, features, sort_order)
values
  ('free', 'Free', 'Para empezar y equipos pequeños', 2, 5, 3, '{"tags": false}'::jsonb, 0),
  ('pro',  'Pro',  'Sin límites y con todas las funciones', null, null, null, '{"tags": true}'::jsonb, 10);

alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to authenticated;

create policy "plans_select" on public.plans
  for select to authenticated using (is_public);

-- ============================================================
-- 2. Suscripciones y clientes de Stripe (solo escribe el servidor)
-- ============================================================
create table public.billing_customers (
  organization_id    uuid primary key references public.organizations (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

create table public.subscriptions (
  organization_id        uuid primary key references public.organizations (id) on delete cascade,
  plan_code              text not null references public.plans (code),
  status                 text not null check (status in (
                           'incomplete', 'incomplete_expired', 'trialing', 'active',
                           'past_due', 'canceled', 'unpaid', 'paused')),
  stripe_subscription_id text not null unique,
  stripe_price_id        text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  -- Desde cuándo está en past_due (inicia la gracia de 7 días).
  past_due_since         timestamptz,
  -- created del último evento aplicado: descarta eventos fuera de orden.
  last_event_at          timestamptz not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.stripe_events (
  event_id     text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.stripe_events     enable row level security;

-- Sin políticas de escritura: ningún rol de la app puede modificarlas.
revoke all on public.billing_customers, public.subscriptions, public.stripe_events from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- Owners y admins ven el estado de la suscripción de su organización.
create policy "subscriptions_select" on public.subscriptions
  for select to authenticated using (public.user_is_org_admin(organization_id));

-- ============================================================
-- 3. Plan efectivo de una organización
-- ============================================================
create or replace function public.org_plan_code(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select s.plan_code
      from public.subscriptions s
      where s.organization_id = p_org
        and (
          s.status in ('active', 'trialing')
          -- Pago fallido: 7 días de gracia conservando el plan.
          or (s.status = 'past_due'
              and s.past_due_since is not null
              and s.past_due_since + interval '7 days' > now())
        )
    ),
    'free'
  );
$$;

create or replace function public.org_plan(p_org uuid)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.plans p where p.code = public.org_plan_code(p_org);
$$;

create or replace function public.org_has_feature(p_org uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.features ->> p_feature = 'true'
       from public.plans p
      where p.code = public.org_plan_code(p_org)),
    false
  );
$$;

-- Funciones internas: las usan los triggers (security definer), no la API.
revoke execute on function public.org_plan_code(uuid) from public, anon, authenticated;
revoke execute on function public.org_plan(uuid) from public, anon, authenticated;
revoke execute on function public.org_has_feature(uuid, text) from public, anon, authenticated;

-- ============================================================
-- 4. Límites del plan (triggers BEFORE INSERT)
-- ============================================================
-- El advisory lock serializa las comprobaciones de una misma organización
-- para que dos altas simultáneas no se cuelen por encima del límite.

create or replace function public.enforce_workspace_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan  public.plans;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));
  v_plan := public.org_plan(new.organization_id);
  if v_plan.max_workspaces is null then
    return new;
  end if;

  select count(*) into v_count
  from public.workspaces w
  where w.organization_id = new.organization_id;

  if v_count >= v_plan.max_workspaces then
    raise exception 'Has alcanzado el límite de % workspaces del plan %. Actualiza el plan para crear más.',
      v_plan.max_workspaces, v_plan.name
      using errcode = 'PT402', hint = 'workspaces';
  end if;
  return new;
end;
$$;

create trigger workspaces_enforce_limit
  before insert on public.workspaces
  for each row execute function public.enforce_workspace_limit();

create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_plan  public.plans;
  v_count integer;
begin
  -- "General" lo crea el sistema y no cuenta contra el límite.
  if new.is_default then
    return new;
  end if;

  select w.organization_id into v_org
  from public.workspaces w where w.id = new.workspace_id;
  if v_org is null then
    return new; -- la FK rechazará el insert
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text, 0));
  v_plan := public.org_plan(v_org);
  if v_plan.max_projects is null then
    return new;
  end if;

  select count(*) into v_count
  from public.projects p
  join public.workspaces w on w.id = p.workspace_id
  where w.organization_id = v_org
    and not p.is_default;

  if v_count >= v_plan.max_projects then
    raise exception 'Has alcanzado el límite de % proyectos del plan %. Actualiza el plan para crear más.',
      v_plan.max_projects, v_plan.name
      using errcode = 'PT402', hint = 'projects';
  end if;
  return new;
end;
$$;

create trigger projects_enforce_limit
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan  public.plans;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));
  v_plan := public.org_plan(new.organization_id);
  if v_plan.max_members is null then
    return new;
  end if;

  select count(*) into v_count
  from public.memberships m
  where m.organization_id = new.organization_id;

  if v_count >= v_plan.max_members then
    raise exception 'La organización alcanzó el límite de % miembros del plan %.',
      v_plan.max_members, v_plan.name
      using errcode = 'PT402', hint = 'members';
  end if;
  return new;
end;
$$;

create trigger memberships_enforce_limit
  before insert on public.memberships
  for each row execute function public.enforce_member_limit();

-- Invitar reserva un puesto: miembros + invitaciones pendientes no pueden
-- superar el límite (si no, la invitación no se podría aceptar).
create or replace function public.enforce_invitation_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan    public.plans;
  v_members integer;
  v_pending integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));
  v_plan := public.org_plan(new.organization_id);
  if v_plan.max_members is null then
    return new;
  end if;

  select count(*) into v_members
  from public.memberships m
  where m.organization_id = new.organization_id;

  select count(*) into v_pending
  from public.invitations i
  where i.organization_id = new.organization_id
    and i.accepted_at is null
    and i.expires_at > now();

  if v_members + v_pending >= v_plan.max_members then
    raise exception 'Has alcanzado el límite de % miembros del plan % (incluye invitaciones pendientes).',
      v_plan.max_members, v_plan.name
      using errcode = 'PT402', hint = 'members';
  end if;
  return new;
end;
$$;

create trigger invitations_enforce_limit
  before insert on public.invitations
  for each row execute function public.enforce_invitation_limit();

-- Función premium: etiquetas solo en planes con features.tags = true.
-- Las etiquetas existentes se conservan y se pueden seguir usando.
create or replace function public.enforce_tags_feature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select w.organization_id into v_org
  from public.workspaces w where w.id = new.workspace_id;
  if v_org is null then
    return new; -- la FK rechazará el insert
  end if;

  if not public.org_has_feature(v_org, 'tags') then
    raise exception 'Crear etiquetas está disponible en el plan Pro.'
      using errcode = 'PT402', hint = 'feature:tags';
  end if;
  return new;
end;
$$;

create trigger tags_enforce_feature
  before insert on public.tags
  for each row execute function public.enforce_tags_feature();

revoke execute on function
  public.enforce_workspace_limit(), public.enforce_project_limit(),
  public.enforce_member_limit(), public.enforce_invitation_limit(),
  public.enforce_tags_feature()
  from public, anon, authenticated;

-- ============================================================
-- 5. Estado de billing para la UI
-- ============================================================
-- Devuelve plan, límites, consumo y suscripción de una organización.
-- Cualquier miembro puede verlo; solo un owner puede gestionarlo
-- (can_manage).
create or replace function public.get_billing_status(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_plan public.plans;
  v_sub  public.subscriptions;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_org and m.user_id = v_uid
  ) then
    raise exception 'No perteneces a esta organización' using errcode = '42501';
  end if;

  v_plan := public.org_plan(p_org);
  select * into v_sub from public.subscriptions s where s.organization_id = p_org;

  return jsonb_build_object(
    'plan', jsonb_build_object(
      'code', v_plan.code,
      'name', v_plan.name,
      'description', v_plan.description,
      'features', v_plan.features
    ),
    'limits', jsonb_build_object(
      'workspaces', v_plan.max_workspaces,
      'projects', v_plan.max_projects,
      'members', v_plan.max_members
    ),
    'usage', jsonb_build_object(
      'workspaces', (select count(*) from public.workspaces w where w.organization_id = p_org),
      'projects', (select count(*) from public.projects p
                     join public.workspaces w on w.id = p.workspace_id
                    where w.organization_id = p_org and not p.is_default),
      'members', (select count(*) from public.memberships m where m.organization_id = p_org),
      'pending_invitations', (select count(*) from public.invitations i
                               where i.organization_id = p_org
                                 and i.accepted_at is null and i.expires_at > now())
    ),
    'subscription', case when v_sub.organization_id is null then null else jsonb_build_object(
      'status', v_sub.status,
      'plan_code', v_sub.plan_code,
      'current_period_end', v_sub.current_period_end,
      'cancel_at_period_end', v_sub.cancel_at_period_end,
      'past_due_since', v_sub.past_due_since,
      'grace_ends_at', case when v_sub.status = 'past_due'
                            then v_sub.past_due_since + interval '7 days' end
    ) end,
    'can_manage', public.user_is_org_owner(p_org)
  );
end;
$$;

revoke execute on function public.get_billing_status(uuid) from public, anon;
grant execute on function public.get_billing_status(uuid) to authenticated;

-- ============================================================
-- 6. Aplicar un evento de suscripción de Stripe (solo servidor)
-- ============================================================
-- La llama la Edge Function stripe-webhook con service_role, DESPUÉS de
-- validar la firma. Es atómica e idempotente: devuelve
--   'applied'    el estado se actualizó
--   'duplicate'  el evento ya se había procesado
--   'stale'      llegó fuera de orden (hay uno más reciente aplicado)
--   'ignored'    la organización ya no existe, o es de otra suscripción
create or replace function public.billing_apply_subscription(
  p_event_id             text,
  p_event_type           text,
  p_event_created        timestamptz,
  p_organization         uuid,
  p_stripe_subscription  text,
  p_status               text,
  p_price_id             text,
  p_current_period_end   timestamptz,
  p_cancel_at_period_end boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_current  public.subscriptions;
  v_plan     text;
  v_past_due timestamptz;
begin
  -- Idempotencia: un evento ya registrado no se vuelve a aplicar.
  insert into public.stripe_events (event_id, type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_organization) then
    return 'ignored';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization::text, 0));
  select * into v_current from public.subscriptions s where s.organization_id = p_organization;

  if v_current.organization_id is not null then
    -- Stripe no garantiza el orden de entrega.
    if p_event_created < v_current.last_event_at then
      return 'stale';
    end if;
    -- Un evento de una suscripción anterior (ya reemplazada) que la da por
    -- terminada no debe tumbar la suscripción vigente.
    if v_current.stripe_subscription_id <> p_stripe_subscription
       and v_current.status in ('active', 'trialing', 'past_due')
       and p_status not in ('active', 'trialing', 'past_due') then
      return 'ignored';
    end if;
  end if;

  select p.code into v_plan from public.plans p where p.stripe_price_id = p_price_id;
  if v_plan is null then
    if v_current.organization_id is not null
       and v_current.stripe_subscription_id = p_stripe_subscription then
      v_plan := v_current.plan_code; -- mismo sub, precio no reconocido: no cambia de plan
    else
      -- Revierte también el registro del evento: Stripe lo reintentará
      -- cuando el plan tenga su stripe_price_id configurado.
      raise exception 'Precio de Stripe desconocido: %', p_price_id using errcode = 'P0001';
    end if;
  end if;

  -- La gracia de 7 días arranca al entrar en past_due y no se reinicia.
  if p_status = 'past_due' then
    v_past_due := case
      when v_current.status = 'past_due'
           and v_current.stripe_subscription_id = p_stripe_subscription
        then coalesce(v_current.past_due_since, now())
      else now()
    end;
  end if;

  insert into public.subscriptions (
    organization_id, plan_code, status, stripe_subscription_id, stripe_price_id,
    current_period_end, cancel_at_period_end, past_due_since, last_event_at
  )
  values (
    p_organization, v_plan, p_status, p_stripe_subscription, p_price_id,
    p_current_period_end, coalesce(p_cancel_at_period_end, false), v_past_due, p_event_created
  )
  on conflict (organization_id) do update set
    plan_code              = excluded.plan_code,
    status                 = excluded.status,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id        = excluded.stripe_price_id,
    current_period_end     = excluded.current_period_end,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    past_due_since         = excluded.past_due_since,
    last_event_at          = excluded.last_event_at,
    updated_at             = now();

  return 'applied';
end;
$$;

revoke execute on function public.billing_apply_subscription(
  text, text, timestamptz, uuid, text, text, text, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.billing_apply_subscription(
  text, text, timestamptz, uuid, text, text, text, timestamptz, boolean
) to service_role;

-- ============================================================
-- 7. No borrar una organización con suscripción vigente
-- ============================================================
-- Si no, Stripe seguiría cobrando una suscripción sin organización.
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
  if exists (
    select 1 from public.subscriptions s
    where s.organization_id = p_org
      and s.status in ('active', 'trialing', 'past_due')
  ) then
    raise exception 'Cancela la suscripción antes de eliminar la organización'
      using errcode = '55000';
  end if;

  delete from public.organizations where id = p_org;
end;
$$;

revoke execute on function public.delete_organization(uuid) from public, anon;
grant execute on function public.delete_organization(uuid) to authenticated;

commit;
