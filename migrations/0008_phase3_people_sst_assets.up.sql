-- Phase 3: lightweight HR, occupational safety, assets and maintenance.

create table employees (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  party_id uuid references parties(id), user_id uuid references users(id), employee_code text not null, first_name text not null, last_name text not null,
  document_type text, document_number text, work_email citext, personal_email citext, phone text, hire_date date not null, termination_date date,
  status text not null default 'active' check(status in ('draft','active','leave','suspended','terminated')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(termination_date is null or termination_date>=hire_date), unique(company_id,employee_code)
);
create table employment_contracts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, contract_type text not null, start_date date not null, end_date date,
  document_id uuid references documents(id), status text not null default 'draft' check(status in ('draft','active','expired','terminated')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(end_date is null or end_date>=start_date)
);
create table employee_positions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, area_id uuid references organizational_areas(id), risk_level text not null default 'low' check(risk_level in ('low','medium','high','critical')),
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table employee_assignments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, position_id uuid not null references employee_positions(id),
  branch_id uuid references branches(id), area_id uuid references organizational_areas(id), supervisor_employee_id uuid references employees(id),
  start_date date not null, end_date date, is_primary boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(end_date is null or end_date>=start_date), check(supervisor_employee_id is null or supervisor_employee_id<>employee_id)
);
create unique index employee_primary_assignment on employee_assignments(employee_id) where is_primary and end_date is null;
create table employee_documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, document_id uuid not null references documents(id), document_type text not null,
  issued_on date, expires_on date, status text not null default 'valid' check(status in ('pending','valid','expired','revoked')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(expires_on is null or issued_on is null or expires_on>=issued_on)
);
create table employee_emergency_contacts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, full_name text not null, relationship text not null, phone text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create unique index employee_primary_emergency_contact on employee_emergency_contacts(employee_id) where is_primary;
create table employee_benefits (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, benefit_type text not null, provider_name text, start_date date not null, end_date date,
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(end_date is null or end_date>=start_date)
);
create table employee_leaves (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, leave_type text not null, start_date date not null, end_date date not null,
  reason text, status text not null default 'requested' check(status in ('requested','approved','rejected','cancelled')),
  decided_by uuid references users(id), decided_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(end_date>=start_date)
);
create table employee_vacations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, period_start date not null, period_end date not null,
  days numeric(6,2) not null check(days>0), status text not null default 'requested' check(status in ('requested','approved','taken','rejected','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(period_end>=period_start)
);
create table attendance_records (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, work_date date not null, check_in timestamptz, check_out timestamptz,
  source text not null default 'manual' check(source in ('manual','import','device')), notes text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(check_out is null or check_in is null or check_out>=check_in), unique(employee_id,work_date)
);
create table employee_trainings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, training_name text not null, provider_name text, completed_on date,
  hours numeric(8,2) check(hours is null or hours>=0), document_id uuid references documents(id), expires_on date,
  status text not null default 'planned' check(status in ('planned','completed','cancelled','expired')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table employee_certifications (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, certification_name text not null, issuer text,
  issued_on date, expires_on date, credential_reference text, document_id uuid references documents(id),
  status text not null default 'valid' check(status in ('pending','valid','expired','revoked')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(expires_on is null or issued_on is null or expires_on>=issued_on)
);
create table employee_status_history (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id) on delete cascade, previous_status text, new_status text not null, reason text,
  effective_at timestamptz not null default now(), changed_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);

create table sst_hazards (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, category text not null, description text, status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table sst_risks (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  hazard_id uuid not null references sst_hazards(id), area_id uuid references organizational_areas(id), position_id uuid references employee_positions(id),
  activity text not null, exposed_people integer not null default 0 check(exposed_people>=0), status text not null default 'identified' check(status in ('identified','assessed','controlled','closed')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table sst_risk_assessments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  risk_id uuid not null references sst_risks(id) on delete cascade, assessed_on date not null, likelihood integer not null check(likelihood between 1 and 5),
  consequence integer not null check(consequence between 1 and 5), exposure integer not null default 1 check(exposure between 1 and 5),
  risk_score integer generated always as (likelihood*consequence*exposure) stored, methodology text not null, assessed_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table sst_control_measures (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  risk_id uuid not null references sst_risks(id) on delete cascade, hierarchy_level text not null check(hierarchy_level in ('elimination','substitution','engineering','administrative','ppe')),
  description text not null, owner_user_id uuid references users(id), due_date date,
  status text not null default 'planned' check(status in ('planned','implemented','verified','ineffective','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table sst_inspections (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  branch_id uuid references branches(id), area_id uuid references organizational_areas(id), inspection_type text not null,
  scheduled_on date, performed_on date, inspector_user_id uuid references users(id),
  status text not null default 'planned' check(status in ('planned','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table sst_inspection_findings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  inspection_id uuid not null references sst_inspections(id) on delete cascade, finding_type text not null check(finding_type in ('conformity','observation','nonconformity')),
  description text not null, severity text check(severity is null or severity in ('low','medium','high','critical')), evidence_document_id uuid references documents(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table sst_corrective_actions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  finding_id uuid references sst_inspection_findings(id), incident_id uuid, description text not null,
  owner_user_id uuid references users(id), due_date date not null, completed_at timestamptz,
  status text not null default 'open' check(status in ('open','in_progress','completed','verified','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table sst_training_sessions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  topic text not null, scheduled_at timestamptz not null, completed_at timestamptz, trainer text, duration_minutes integer check(duration_minutes is null or duration_minutes>0),
  status text not null default 'planned' check(status in ('planned','completed','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table sst_training_attendance (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  training_session_id uuid not null references sst_training_sessions(id) on delete cascade, employee_id uuid not null references employees(id),
  attended boolean not null default false, score numeric(5,2) check(score is null or score between 0 and 100), signed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(training_session_id,employee_id)
);
create table sst_ppe_items (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, useful_life_days integer check(useful_life_days is null or useful_life_days>0),
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table sst_ppe_deliveries (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ppe_item_id uuid not null references sst_ppe_items(id), employee_id uuid not null references employees(id),
  quantity numeric(12,3) not null check(quantity>0), delivered_at timestamptz not null default now(), expires_on date,
  acknowledged_at timestamptz, evidence_document_id uuid references documents(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table sst_incidents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, occurred_at timestamptz not null, branch_id uuid references branches(id), area_id uuid references organizational_areas(id),
  reported_by uuid references users(id), description text not null, severity text not null check(severity in ('low','medium','high','critical')),
  status text not null default 'reported' check(status in ('reported','investigating','action_pending','closed')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
alter table sst_corrective_actions add constraint sst_corrective_actions_incident_fk foreign key(incident_id) references sst_incidents(id);
create table sst_accidents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  incident_id uuid not null unique references sst_incidents(id), employee_id uuid references employees(id),
  lost_time boolean not null default false, days_lost integer not null default 0 check(days_lost>=0),
  investigation_summary text, authority_reference text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table occupational_exams (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  employee_id uuid not null references employees(id), exam_type text not null, scheduled_on date, performed_on date,
  provider_name text, result_status text not null default 'pending' check(result_status in ('pending','completed','expired','cancelled')),
  expires_on date, restricted_detail_present boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(expires_on is null or performed_on is null or expires_on>=performed_on)
);
create table occupational_exam_medical_details (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  occupational_exam_id uuid not null unique references occupational_exams(id) on delete cascade,
  encrypted_payload bytea not null check(octet_length(encrypted_payload)>0), encryption_key_reference text not null check(char_length(encryption_key_reference)>0),
  payload_format_version integer not null default 1 check(payload_format_version>0),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table occupational_fitness (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  occupational_exam_id uuid not null references occupational_exams(id), employee_id uuid not null references employees(id),
  fitness_status text not null check(fitness_status in ('fit','fit_with_restrictions','not_fit','pending')),
  valid_from date not null, valid_until date, issued_by_reference text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(valid_until is null or valid_until>=valid_from)
);
create table work_restrictions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  occupational_fitness_id uuid not null references occupational_fitness(id) on delete cascade, employee_id uuid not null references employees(id),
  restriction_code text not null, operational_instruction text not null, valid_from date not null, valid_until date,
  authorized_by_user_id uuid references users(id), status text not null default 'active' check(status in ('active','expired','revoked')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(valid_until is null or valid_until>=valid_from)
);
create table sst_committee_records (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  meeting_date date not null, record_number text not null, summary text not null, document_id uuid references documents(id),
  status text not null default 'draft' check(status in ('draft','approved','archived')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,record_number)
);

create table asset_categories (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  parent_id uuid references asset_categories(id), code text not null, name text not null, depreciation_method text,
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(parent_id is null or parent_id<>id), unique(company_id,code)
);
create table asset_locations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  parent_id uuid references asset_locations(id), branch_id uuid references branches(id), code text not null, name text not null,
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(parent_id is null or parent_id<>id), unique(company_id,code)
);
create table assets (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  category_id uuid not null references asset_categories(id), location_id uuid references asset_locations(id), code text not null, name text not null,
  serial_number text, model text, manufacturer text, acquired_on date, acquisition_cost numeric(18,2) check(acquisition_cost is null or acquisition_cost>=0),
  currency char(3) not null default 'PEN', criticality text not null default 'medium' check(criticality in ('low','medium','high','critical')),
  status text not null default 'available' check(status in ('available','assigned','maintenance','retired','lost')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create unique index assets_serial_unique on assets(company_id,serial_number) where serial_number is not null;
create table asset_assignments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  asset_id uuid not null references assets(id) on delete cascade, employee_id uuid references employees(id), user_id uuid references users(id),
  location_id uuid references asset_locations(id), assigned_at timestamptz not null default now(), returned_at timestamptz, condition_notes text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(num_nonnulls(employee_id,user_id,location_id)>=1), check(returned_at is null or returned_at>=assigned_at)
);
create unique index asset_active_assignment on asset_assignments(asset_id) where returned_at is null;
create table asset_status_history (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  asset_id uuid not null references assets(id) on delete cascade, previous_status text, new_status text not null, reason text,
  changed_at timestamptz not null default now(), changed_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table maintenance_plans (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  asset_id uuid references assets(id), category_id uuid references asset_categories(id), name text not null,
  trigger_type text not null check(trigger_type in ('calendar','meter')), interval_days integer, interval_units numeric(18,3),
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(num_nonnulls(asset_id,category_id)=1),
  check((trigger_type='calendar' and interval_days>0 and interval_units is null) or (trigger_type='meter' and interval_units>0 and interval_days is null))
);
create table maintenance_schedules (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  maintenance_plan_id uuid not null references maintenance_plans(id), asset_id uuid not null references assets(id),
  due_date date, due_meter_value numeric(18,3), status text not null default 'scheduled' check(status in ('scheduled','due','completed','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(num_nonnulls(due_date,due_meter_value)>=1)
);
create table maintenance_work_orders (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  asset_id uuid not null references assets(id), schedule_id uuid references maintenance_schedules(id), code text not null,
  maintenance_type text not null check(maintenance_type in ('preventive','corrective','predictive','inspection')),
  priority text not null default 'medium' check(priority in ('low','medium','high','critical')), assigned_user_id uuid references users(id),
  scheduled_at timestamptz, started_at timestamptz, completed_at timestamptz,
  status text not null default 'draft' check(status in ('draft','scheduled','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table maintenance_tasks (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  work_order_id uuid not null references maintenance_work_orders(id) on delete cascade, position integer not null check(position>=0),
  description text not null, completed boolean not null default false, completed_at timestamptz, completed_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(work_order_id,position)
);
create table maintenance_parts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  work_order_id uuid not null references maintenance_work_orders(id) on delete cascade, item_id uuid references items(id),
  description text not null, quantity numeric(18,6) not null check(quantity>0), unit_cost numeric(18,6) not null default 0 check(unit_cost>=0),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table maintenance_costs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  work_order_id uuid not null references maintenance_work_orders(id) on delete cascade, cost_type text not null, description text not null,
  amount numeric(18,2) not null check(amount>=0), currency char(3) not null default 'PEN', incurred_on date not null,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table meter_readings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  asset_id uuid not null references assets(id) on delete cascade, meter_type text not null, reading_value numeric(18,3) not null check(reading_value>=0),
  read_at timestamptz not null, source text not null default 'manual' check(source in ('manual','import','device')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(asset_id,meter_type,read_at)
);
create table asset_incidents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  asset_id uuid not null references assets(id), reported_by uuid references users(id), occurred_at timestamptz not null, description text not null,
  severity text not null default 'medium' check(severity in ('low','medium','high','critical')),
  status text not null default 'open' check(status in ('open','investigating','resolved','closed')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);

create index employees_scope_status on employees(tenant_id,company_id,status,last_name,first_name);
create index employment_contracts_expiry on employment_contracts(company_id,end_date) where status='active' and end_date is not null;
create index employee_documents_expiry on employee_documents(company_id,expires_on) where status='valid' and expires_on is not null;
create index sst_risks_open on sst_risks(company_id,status,area_id) where status<>'closed';
create index sst_corrective_actions_due on sst_corrective_actions(company_id,due_date) where status in ('open','in_progress');
create index occupational_exams_expiry on occupational_exams(company_id,expires_on) where result_status='completed' and expires_on is not null;
create index assets_scope_status on assets(tenant_id,company_id,status,category_id);
create index maintenance_schedules_due on maintenance_schedules(company_id,due_date) where status in ('scheduled','due');
create index maintenance_work_orders_queue on maintenance_work_orders(company_id,status,priority,scheduled_at);
create index meter_readings_latest on meter_readings(asset_id,meter_type,read_at desc);

create function app_has_medical_access() returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('app.medical_access',true),'')::boolean,false)
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'employees','employment_contracts','employee_positions','employee_assignments','employee_documents',
    'employee_emergency_contacts','employee_benefits','employee_leaves','employee_vacations','attendance_records',
    'employee_trainings','employee_certifications','employee_status_history','sst_hazards','sst_risks',
    'sst_risk_assessments','sst_control_measures','sst_inspections','sst_inspection_findings','sst_corrective_actions',
    'sst_training_sessions','sst_training_attendance','sst_ppe_items','sst_ppe_deliveries','sst_incidents',
    'sst_accidents','occupational_exams','occupational_fitness','work_restrictions','sst_committee_records',
    'asset_categories','asset_locations','assets','asset_assignments','asset_status_history','maintenance_plans',
    'maintenance_schedules','maintenance_work_orders','maintenance_tasks','maintenance_parts','maintenance_costs',
    'meter_readings','asset_incidents'
  ] loop
    execute format('alter table %I enable row level security',table_name);
    execute format(
      'create policy %I on %I using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id())',
      table_name || '_company_isolation',table_name
    );
  end loop;
end $$;

alter table occupational_exam_medical_details enable row level security;
create policy occupational_exam_medical_details_restricted on occupational_exam_medical_details
  using(tenant_id=app_tenant_id() and company_id=app_company_id() and app_has_medical_access())
  with check(tenant_id=app_tenant_id() and company_id=app_company_id() and app_has_medical_access());
