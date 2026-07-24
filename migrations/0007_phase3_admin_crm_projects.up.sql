-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
-- Phase 3: administrative control plane, CRM, projects, time and expenses.
-- Executed transactionally by packages/database/src/migrate.ts.

create table business_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null check(code ~ '^[a-z0-9-]{2,60}$'), name text not null check(char_length(name) between 2 and 160),
  description text, sector text, is_system boolean not null default false, status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(company_id,code)
);
create table business_profile_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  business_profile_id uuid not null references business_profiles(id) on delete cascade, module_id uuid not null references modules(id),
  enabled_by_default boolean not null default true, configuration jsonb not null default '{}',
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(business_profile_id,module_id)
);
create table feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null check(code ~ '^[a-z][a-z0-9.-]{2,100}$'), description text not null,
  enabled_by_default boolean not null default false, status text not null default 'active' check(status in ('active','retired')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(company_id,code)
);
create table feature_flag_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  feature_flag_id uuid not null references feature_flags(id) on delete cascade,
  target_type text not null check(target_type in ('company','branch','role','user')),
  target_id uuid not null, enabled boolean not null, valid_from timestamptz not null default now(), valid_until timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  check(valid_until is null or valid_until > valid_from), unique(feature_flag_id,target_type,target_id)
);
create table configuration_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  configuration_key text not null, version_number integer not null check(version_number > 0),
  snapshot jsonb not null, checksum char(64) not null check(checksum ~ '^[0-9a-f]{64}$'),
  state text not null default 'draft' check(state in ('draft','pending_approval','approved','rejected','applied','superseded')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(company_id,configuration_key,version_number)
);
create table configuration_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  configuration_version_id uuid not null references configuration_versions(id) on delete cascade,
  path text not null, previous_value jsonb, proposed_value jsonb, change_reason text not null,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table configuration_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  configuration_version_id uuid not null references configuration_versions(id) on delete cascade,
  requested_by uuid not null references users(id), decided_by uuid references users(id),
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  requested_at timestamptz not null default now(), decided_at timestamptz, decision_note text,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  check((status='pending' and decided_at is null and decided_by is null) or status<>'pending')
);

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(company_id,code)
);
create table pipelines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, is_default boolean not null default false, status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(company_id,code)
);
create unique index pipelines_one_default on pipelines(company_id) where is_default and status='active';
create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  pipeline_id uuid not null references pipelines(id) on delete cascade, code text not null, name text not null,
  position integer not null check(position >= 0), probability numeric(5,2) not null default 0 check(probability between 0 and 100),
  terminal_kind text check(terminal_kind is null or terminal_kind in ('won','lost')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(pipeline_id,code), unique(pipeline_id,position)
);
create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  source_id uuid references lead_sources(id), party_id uuid references parties(id), owner_user_id uuid references users(id),
  full_name text not null, organization_name text, email citext, phone text, notes text,
  status text not null default 'new' check(status in ('new','contacted','qualified','disqualified','converted')),
  converted_opportunity_id uuid, qualified_at timestamptz, converted_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  pipeline_id uuid not null references pipelines(id), stage_id uuid not null references pipeline_stages(id),
  lead_id uuid references leads(id), customer_party_id uuid references parties(id), owner_user_id uuid references users(id),
  code text not null, name text not null, currency char(3) not null default 'PEN', estimated_amount numeric(18,2) not null default 0 check(estimated_amount >= 0),
  probability numeric(5,2) not null default 0 check(probability between 0 and 100), expected_close_date date,
  status text not null default 'open' check(status in ('open','won','lost','cancelled')), loss_reason text, closed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(company_id,code)
);
alter table leads add constraint leads_converted_opportunity_fk foreign key(converted_opportunity_id) references opportunities(id);
create table opportunity_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  opportunity_id uuid not null references opportunities(id) on delete cascade, item_id uuid references items(id),
  description text not null, quantity numeric(18,6) not null check(quantity > 0), unit_price numeric(18,6) not null check(unit_price >= 0),
  discount_amount numeric(18,2) not null default 0 check(discount_amount >= 0),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table commercial_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  lead_id uuid references leads(id), opportunity_id uuid references opportunities(id), party_id uuid references parties(id),
  assigned_user_id uuid references users(id), activity_type text not null check(activity_type in ('call','email','meeting','visit','task','note')),
  subject text not null, details text, scheduled_at timestamptz, completed_at timestamptz,
  status text not null default 'planned' check(status in ('planned','completed','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table opportunity_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  opportunity_id uuid not null references opportunities(id) on delete cascade, user_id uuid not null references users(id),
  role text not null default 'member', assigned_at timestamptz not null default now(), unassigned_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  check(unassigned_at is null or unassigned_at >= assigned_at)
);
create unique index opportunity_assignments_active on opportunity_assignments(opportunity_id,user_id) where unassigned_at is null;
create table opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  from_stage_id uuid references pipeline_stages(id), to_stage_id uuid not null references pipeline_stages(id),
  changed_at timestamptz not null default now(), changed_by uuid references users(id), reason text,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, description text, customer_party_id uuid references parties(id),
  manager_user_id uuid references users(id), currency char(3) not null default 'PEN',
  planned_start date, planned_end date, actual_start date, actual_end date,
  status text not null default 'draft' check(status in ('draft','planned','active','on_hold','completed','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  check(planned_end is null or planned_start is null or planned_end >= planned_start), unique(company_id,code)
);
create table project_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, user_id uuid not null references users(id),
  role text not null, allocation_percent numeric(5,2) not null default 100 check(allocation_percent between 0 and 100),
  joined_on date not null default current_date, left_on date,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  check(left_on is null or left_on >= joined_on), unique(project_id,user_id,joined_on)
);
create table project_phases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, code text not null, name text not null,
  position integer not null check(position >= 0), planned_start date, planned_end date,
  status text not null default 'pending' check(status in ('pending','active','completed','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(project_id,code), unique(project_id,position)
);
create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, phase_id uuid references project_phases(id),
  name text not null, due_date date not null, completed_at timestamptz,
  status text not null default 'pending' check(status in ('pending','completed','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table project_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, phase_id uuid references project_phases(id),
  parent_task_id uuid references project_tasks(id), assignee_user_id uuid references users(id),
  code text not null, title text not null, description text, priority text not null default 'medium' check(priority in ('low','medium','high','critical')),
  status text not null default 'todo' check(status in ('todo','in_progress','blocked','done','cancelled')),
  planned_start date, planned_end date, estimated_minutes integer check(estimated_minutes is null or estimated_minutes >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  check(parent_task_id is null or parent_task_id <> id), unique(project_id,code)
);
create table task_dependencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade,
  predecessor_task_id uuid not null references project_tasks(id) on delete cascade,
  successor_task_id uuid not null references project_tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start' check(dependency_type in ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
  lag_minutes integer not null default 0,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  check(predecessor_task_id <> successor_task_id), unique(predecessor_task_id,successor_task_id)
);
create table project_deliverables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, milestone_id uuid references project_milestones(id),
  document_id uuid references documents(id), name text not null, description text, due_date date,
  status text not null default 'pending' check(status in ('pending','submitted','accepted','rejected')),
  accepted_at timestamptz, accepted_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table project_budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, currency char(3) not null default 'PEN',
  status text not null default 'draft' check(status in ('draft','approved','closed')),
  current_version_number integer not null default 1 check(current_version_number > 0),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(project_id)
);
create table project_budget_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_budget_id uuid not null references project_budgets(id) on delete cascade,
  version_number integer not null check(version_number > 0), amount numeric(18,2) not null check(amount >= 0),
  breakdown jsonb not null default '{}', reason text, approved_at timestamptz, approved_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0),
  unique(project_budget_id,version_number)
);
create table project_costs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, task_id uuid references project_tasks(id),
  expense_id uuid references expenses(id), cost_type text not null, description text not null,
  incurred_on date not null, amount numeric(18,2) not null check(amount >= 0), currency char(3) not null default 'PEN',
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table project_time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, task_id uuid references project_tasks(id),
  user_id uuid not null references users(id), work_date date not null, minutes integer not null check(minutes between 1 and 1440),
  description text, billable boolean not null default false,
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected')),
  approved_at timestamptz, approved_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table project_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, task_id uuid references project_tasks(id),
  expense_id uuid references expenses(id), submitted_by uuid not null references users(id),
  description text not null, expense_date date not null, amount numeric(18,2) not null check(amount >= 0), currency char(3) not null default 'PEN',
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table project_risks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, owner_user_id uuid references users(id),
  title text not null, description text, probability integer not null check(probability between 1 and 5),
  impact integer not null check(impact between 1 and 5), response_plan text,
  status text not null default 'open' check(status in ('open','mitigating','closed','accepted')),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table project_issues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, owner_user_id uuid references users(id),
  title text not null, description text, severity text not null default 'medium' check(severity in ('low','medium','high','critical')),
  status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
  due_date date, resolved_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table project_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade, requested_by uuid not null references users(id),
  title text not null, description text not null, schedule_impact_days integer not null default 0,
  cost_impact numeric(18,2) not null default 0, status text not null default 'requested' check(status in ('requested','approved','rejected','implemented','cancelled')),
  decided_at timestamptz, decided_by uuid references users(id), decision_note text,
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);
create table project_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  project_id uuid not null references projects(id) on delete cascade,
  previous_status text, new_status text not null, reason text, changed_at timestamptz not null default now(), changed_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version > 0)
);

create index business_profiles_scope on business_profiles(tenant_id,company_id,status);
create index configuration_versions_lookup on configuration_versions(tenant_id,company_id,configuration_key,created_at desc);
create index leads_pipeline_search on leads(tenant_id,company_id,status,owner_user_id,updated_at desc);
create index leads_text_search on leads using gin(to_tsvector('simple',coalesce(full_name,'') || ' ' || coalesce(organization_name,'')));
create index opportunities_pipeline_board on opportunities(tenant_id,company_id,pipeline_id,stage_id,status);
create index commercial_activities_due on commercial_activities(company_id,assigned_user_id,scheduled_at) where status='planned';
create index projects_scope_status on projects(tenant_id,company_id,status,planned_end);
create index project_tasks_board on project_tasks(project_id,status,priority,planned_end);
create index project_tasks_assignee on project_tasks(company_id,assignee_user_id,status) where status not in ('done','cancelled');
create index project_time_entries_approval on project_time_entries(company_id,status,work_date desc);
create index project_expenses_approval on project_expenses(company_id,status,expense_date desc);
create index project_risks_open on project_risks(project_id,impact desc,probability desc) where status in ('open','mitigating');

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'business_profiles','business_profile_modules','feature_flags','feature_flag_targets',
    'configuration_versions','configuration_changes','configuration_approvals',
    'lead_sources','pipelines','pipeline_stages','leads','opportunities','opportunity_products',
    'commercial_activities','opportunity_assignments','opportunity_stage_history',
    'projects','project_members','project_phases','project_milestones','project_tasks',
    'task_dependencies','project_deliverables','project_budgets','project_budget_versions',
    'project_costs','project_time_entries','project_expenses','project_risks','project_issues',
    'project_change_requests','project_status_history'
  ] loop
    execute format('alter table %I enable row level security',table_name);
    execute format(
      'create policy %I on %I using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id())',
      table_name || '_company_isolation',table_name
    );
  end loop;
end $$;
