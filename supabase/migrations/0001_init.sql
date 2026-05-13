-- =============================================================
-- SCM Issue Intelligence & Workflow Management Portal
-- Initial schema (Phase 1 — no AI; placeholders for embeddings)
-- =============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =============================================================
-- ENUMS
-- =============================================================
do $$ begin
  create type user_role as enum (
    'submitter', 'coe_analyst', 'coe_admin', 'poc_owner', 'leadership', 'system_admin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_priority as enum ('P0', 'P1', 'P2', 'P3');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_stage as enum (
    'draft',
    'submitted',
    'coe_triage',
    'poc_assigned',
    'requirement_clarification',
    'brd_acceptance',
    'solution_design',
    'mih_ccb_approval',
    'development_sit',
    'uat',
    'go_live',
    'pending_validation',
    'closed',
    'reopened',
    'rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_link_type as enum ('duplicate', 'related', 'parent_child');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sla_event_kind as enum ('reminder', 'warning', 'escalation', 'breach');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('email', 'portal', 'teams');
exception when duplicate_object then null; end $$;

-- =============================================================
-- MASTER DATA
-- =============================================================
create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists functions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade,
  code text not null,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (module_id, code)
);

create table if not exists function_teams (
  id uuid primary key default gen_random_uuid(),
  function_id uuid references functions(id) on delete cascade,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  code text not null,
  name text not null,
  is_active boolean default true,
  unique (category_id, code)
);

create table if not exists sla_policies (
  id uuid primary key default gen_random_uuid(),
  priority ticket_priority not null unique,
  response_minutes int not null,
  resolution_minutes int not null,
  updated_at timestamptz default now()
);

create table if not exists brd_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  sections jsonb not null default '[]',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists workflow_stages (
  id uuid primary key default gen_random_uuid(),
  stage ticket_stage not null unique,
  display_name text not null,
  default_sla_minutes int,
  sort_order int default 0
);

create table if not exists priority_config (
  id boolean primary key default true check (id),  -- singleton row
  impact_weight numeric not null default 0.7,
  effort_weight numeric not null default 0.3,
  p1_min_score numeric not null default 85,
  p2_min_score numeric not null default 60,
  updated_at timestamptz default now()
);

-- =============================================================
-- USERS & ROLES
-- (Supabase Auth handles auth.users; we extend with profiles.)
-- =============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  employee_id text,
  department text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_roles (
  user_id uuid references profiles(id) on delete cascade,
  role user_role not null,
  primary key (user_id, role)
);

-- =============================================================
-- TICKETS
-- =============================================================
create sequence if not exists ticket_seq start 1;

create or replace function generate_ticket_id() returns text
language plpgsql as $$
declare
  yr text;
  mo text;
  nxt bigint;
begin
  yr := to_char(now(), 'YYYY');
  mo := to_char(now(), 'MM');
  nxt := nextval('ticket_seq');
  return 'SCM-' || yr || '-' || mo || '-' || lpad(nxt::text, 6, '0');
end $$;

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique not null default generate_ticket_id(),

  -- Basic info
  title text not null,
  description text not null,
  module_id uuid references modules(id),
  function_id uuid references functions(id),
  function_team_id uuid references function_teams(id),
  category_id uuid references categories(id),
  subcategory_id uuid references subcategories(id),

  -- Impact
  frequency text,
  people_affected int,
  hours_lost_per_week numeric,
  cost_saving_potential numeric,
  compliance_risk boolean default false,

  -- Additional
  suggested_solution text,
  existing_workaround text,

  -- Workflow
  stage ticket_stage not null default 'submitted',
  priority ticket_priority,
  impact_score numeric,
  execution_score numeric,
  coe_effort_score int check (coe_effort_score between 1 and 5),

  -- Linkage
  parent_ticket_id uuid references tickets(id) on delete set null,
  duplicate_count int default 0,

  -- Ownership
  submitter_id uuid references profiles(id),
  assigned_poc_id uuid references profiles(id),

  -- SLA tracking
  response_due_at timestamptz,
  resolution_due_at timestamptz,
  responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  reopen_count int default 0,

  -- Jira placeholder
  jira_ticket_id text,
  jira_status text,
  jira_owner text,
  jira_url text,

  -- AI placeholder (for future embedding search; left empty in Phase 1)
  embedding_vector jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tickets_stage on tickets(stage);
create index if not exists idx_tickets_priority on tickets(priority);
create index if not exists idx_tickets_module on tickets(module_id);
create index if not exists idx_tickets_category on tickets(category_id);
create index if not exists idx_tickets_submitter on tickets(submitter_id);
create index if not exists idx_tickets_assigned_poc on tickets(assigned_poc_id);
create index if not exists idx_tickets_parent on tickets(parent_ticket_id);

-- =============================================================
-- TICKET LINKS (related/duplicate clusters surfaced by humans)
-- =============================================================
create table if not exists ticket_links (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  linked_ticket_id uuid not null references tickets(id) on delete cascade,
  link_type ticket_link_type not null default 'related',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (ticket_id, linked_ticket_id, link_type)
);

-- =============================================================
-- TICKET HISTORY / AUDIT
-- =============================================================
create table if not exists ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid references profiles(id),
  changed_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_audit_entity on audit_logs(entity_type, entity_id);

-- =============================================================
-- ATTACHMENTS
-- =============================================================
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  brd_id uuid,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now()
);

-- =============================================================
-- COMMENTS
-- =============================================================
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  is_internal boolean default false,
  created_at timestamptz default now()
);

-- =============================================================
-- BRDs (Phase 1: human-created drafts; template scaffolds content)
-- =============================================================
create table if not exists brds (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  template_id uuid references brd_templates(id),
  version int not null default 1,
  status text not null default 'draft', -- draft | in_review | approved | locked
  content jsonb not null default '{}',
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (ticket_id, version)
);

-- =============================================================
-- SLA EVENTS
-- =============================================================
create table if not exists sla_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  kind sla_event_kind not null,
  threshold_pct int,
  fired_at timestamptz default now(),
  notes text
);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id) on delete cascade,
  ticket_id uuid references tickets(id) on delete set null,
  channel notification_channel not null default 'portal',
  subject text not null,
  body text,
  is_read boolean default false,
  delivered_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_recipient on notifications(recipient_id, is_read);

-- =============================================================
-- PRIORITY SCORES (snapshots for analytics)
-- =============================================================
create table if not exists priority_scores (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  pct_people numeric,
  pct_frequency numeric,
  pct_time_loss numeric,
  pct_cost numeric,
  combined_impact numeric,
  effort_score int,
  execution_score numeric,
  priority ticket_priority,
  computed_at timestamptz default now()
);

-- =============================================================
-- TRIGGERS — updated_at, history, audit
-- =============================================================
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_tickets_updated_at on tickets;
create trigger trg_tickets_updated_at before update on tickets
  for each row execute procedure set_updated_at();

drop trigger if exists trg_brds_updated_at on brds;
create trigger trg_brds_updated_at before update on brds
  for each row execute procedure set_updated_at();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute procedure set_updated_at();

-- Auto-track ticket stage / priority / assignment changes
create or replace function log_ticket_changes() returns trigger
language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    insert into ticket_history (ticket_id, field, old_value, new_value)
    values (new.id, 'stage', old.stage::text, new.stage::text);
  end if;
  if new.priority is distinct from old.priority then
    insert into ticket_history (ticket_id, field, old_value, new_value)
    values (new.id, 'priority', old.priority::text, new.priority::text);
  end if;
  if new.assigned_poc_id is distinct from old.assigned_poc_id then
    insert into ticket_history (ticket_id, field, old_value, new_value)
    values (new.id, 'assigned_poc_id', old.assigned_poc_id::text, new.assigned_poc_id::text);
  end if;
  return new;
end $$;

drop trigger if exists trg_tickets_history on tickets;
create trigger trg_tickets_history after update on tickets
  for each row execute procedure log_ticket_changes();

-- =============================================================
-- HELPERS — current user roles
-- =============================================================
create or replace function has_role(p_role user_role) returns boolean
language sql stable as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = p_role
  );
$$;

create or replace function is_coe() returns boolean
language sql stable as $$
  select has_role('coe_admin') or has_role('coe_analyst') or has_role('system_admin');
$$;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table tickets enable row level security;
alter table ticket_links enable row level security;
alter table ticket_history enable row level security;
alter table attachments enable row level security;
alter table comments enable row level security;
alter table brds enable row level security;
alter table sla_events enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table priority_scores enable row level security;
alter table modules enable row level security;
alter table functions enable row level security;
alter table function_teams enable row level security;
alter table categories enable row level security;
alter table subcategories enable row level security;
alter table sla_policies enable row level security;
alter table brd_templates enable row level security;
alter table workflow_stages enable row level security;
alter table priority_config enable row level security;

-- Masters are readable by all authenticated users; only system_admin writes
create policy "masters_read" on modules for select to authenticated using (true);
create policy "masters_read" on functions for select to authenticated using (true);
create policy "masters_read" on function_teams for select to authenticated using (true);
create policy "masters_read" on categories for select to authenticated using (true);
create policy "masters_read" on subcategories for select to authenticated using (true);
create policy "masters_read" on sla_policies for select to authenticated using (true);
create policy "masters_read" on brd_templates for select to authenticated using (true);
create policy "masters_read" on workflow_stages for select to authenticated using (true);
create policy "masters_read" on priority_config for select to authenticated using (true);

create policy "masters_admin_write" on modules for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));
create policy "masters_admin_write" on functions for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));
create policy "masters_admin_write" on function_teams for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));
create policy "masters_admin_write" on categories for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));
create policy "masters_admin_write" on subcategories for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));
create policy "masters_admin_write" on sla_policies for all to authenticated
  using (has_role('system_admin') or has_role('coe_admin'))
  with check (has_role('system_admin') or has_role('coe_admin'));
create policy "masters_admin_write" on brd_templates for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));
create policy "masters_admin_write" on workflow_stages for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));
create policy "masters_admin_write" on priority_config for all to authenticated
  using (has_role('system_admin') or has_role('coe_admin'))
  with check (has_role('system_admin') or has_role('coe_admin'));

-- Profiles: self-read; COE/admin can read all
create policy "profiles_self_read" on profiles for select to authenticated
  using (id = auth.uid() or is_coe() or has_role('leadership'));
create policy "profiles_self_update" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_write" on profiles for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));

create policy "user_roles_read" on user_roles for select to authenticated
  using (user_id = auth.uid() or is_coe());
create policy "user_roles_admin_write" on user_roles for all to authenticated
  using (has_role('system_admin')) with check (has_role('system_admin'));

-- Tickets: submitter sees own; assigned POC sees assigned; COE sees all;
-- leadership read-only on all
create policy "tickets_read" on tickets for select to authenticated using (
  submitter_id = auth.uid()
  or assigned_poc_id = auth.uid()
  or is_coe()
  or has_role('leadership')
);
create policy "tickets_insert" on tickets for insert to authenticated
  with check (submitter_id = auth.uid());
create policy "tickets_update" on tickets for update to authenticated using (
  is_coe() or assigned_poc_id = auth.uid() or submitter_id = auth.uid()
) with check (
  is_coe() or assigned_poc_id = auth.uid() or submitter_id = auth.uid()
);

create policy "ticket_links_read" on ticket_links for select to authenticated using (
  exists (
    select 1 from tickets t where t.id = ticket_links.ticket_id and (
      t.submitter_id = auth.uid() or t.assigned_poc_id = auth.uid()
      or is_coe() or has_role('leadership')
    )
  )
);
create policy "ticket_links_write" on ticket_links for all to authenticated
  using (is_coe()) with check (is_coe());

create policy "ticket_history_read" on ticket_history for select to authenticated using (
  is_coe() or has_role('leadership') or exists (
    select 1 from tickets t where t.id = ticket_history.ticket_id and (
      t.submitter_id = auth.uid() or t.assigned_poc_id = auth.uid()
    )
  )
);

create policy "comments_read" on comments for select to authenticated using (
  exists (
    select 1 from tickets t where t.id = comments.ticket_id and (
      t.submitter_id = auth.uid() or t.assigned_poc_id = auth.uid()
      or is_coe() or has_role('leadership')
    )
  )
);
create policy "comments_insert" on comments for insert to authenticated
  with check (author_id = auth.uid());

create policy "attachments_read" on attachments for select to authenticated using (
  exists (
    select 1 from tickets t where t.id = attachments.ticket_id and (
      t.submitter_id = auth.uid() or t.assigned_poc_id = auth.uid()
      or is_coe() or has_role('leadership')
    )
  )
);
create policy "attachments_insert" on attachments for insert to authenticated
  with check (uploaded_by = auth.uid());

create policy "brds_read" on brds for select to authenticated using (
  exists (
    select 1 from tickets t where t.id = brds.ticket_id and (
      t.submitter_id = auth.uid() or t.assigned_poc_id = auth.uid()
      or is_coe() or has_role('leadership')
    )
  )
);
create policy "brds_write" on brds for all to authenticated using (
  is_coe() or exists (
    select 1 from tickets t where t.id = brds.ticket_id and (
      t.submitter_id = auth.uid() or t.assigned_poc_id = auth.uid()
    )
  )
) with check (
  is_coe() or exists (
    select 1 from tickets t where t.id = brds.ticket_id and (
      t.submitter_id = auth.uid() or t.assigned_poc_id = auth.uid()
    )
  )
);

create policy "sla_events_read" on sla_events for select to authenticated using (
  is_coe() or has_role('leadership')
);

create policy "notifications_read" on notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy "notifications_update" on notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "audit_logs_read" on audit_logs for select to authenticated using (
  is_coe() or has_role('leadership')
);

create policy "priority_scores_read" on priority_scores for select to authenticated using (
  is_coe() or has_role('leadership')
);

-- =============================================================
-- AUTO-CREATE PROFILE ON AUTH SIGNUP
-- =============================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  -- Default role: submitter
  insert into user_roles (user_id, role)
  values (new.id, 'submitter')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure handle_new_user();
