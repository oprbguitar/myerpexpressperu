create extension if not exists pgcrypto;
create extension if not exists citext;

create type record_status as enum ('active','inactive','blocked','pending','deleted');
create type module_status as enum ('enabled','disabled');
create type company_classification as enum ('private_company','public_company','public_entity');

create table tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 160),
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check(version > 0)
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  legal_name text not null check(char_length(legal_name) between 2 and 200),
  commercial_name text,
  ruc varchar(11) not null check(ruc ~ '^[0-9]{11}$'),
  fiscal_address text,
  ubigeo varchar(6) check(ubigeo is null or ubigeo ~ '^[0-9]{6}$'),
  email citext,
  phone text,
  logo_document_id uuid,
  main_currency char(3) not null default 'PEN',
  time_zone text not null default 'America/Lima',
  fiscal_configuration jsonb not null default '{}'::jsonb,
  economic_activity_code text,
  classification company_classification not null default 'private_company',
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  version integer not null default 1 check(version > 0),
  unique(tenant_id,ruc)
);

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  email citext not null,
  normalized_email citext generated always as (lower(trim(email::text))) stored,
  password_hash text not null,
  force_password_change boolean not null default true,
  status record_status not null default 'pending',
  failed_login_count integer not null default 0 check(failed_login_count >= 0),
  blocked_until timestamptz,
  password_changed_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),
  version integer not null default 1 check(version > 0),
  unique(tenant_id,normalized_email)
);

alter table companies
  add constraint companies_created_by_fk foreign key(created_by) references users(id),
  add constraint companies_updated_by_fk foreign key(updated_by) references users(id);

create table user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  full_name text not null check(char_length(full_name) between 2 and 160),
  dni varchar(8) check(dni is null or dni ~ '^[0-9]{8}$'),
  phone text,
  avatar_document_id uuid,
  locale text not null default 'es-PE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  code text not null,
  name text not null,
  address text,
  ubigeo varchar(6) check(ubigeo is null or ubigeo ~ '^[0-9]{6}$'),
  email citext,
  phone text,
  responsible_user_id uuid references users(id),
  is_default boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id,code),
  unique(id,company_id,tenant_id)
);
create unique index one_default_branch_per_company on branches(company_id) where is_default and status='active';

create table establishments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  sunat_code text not null,
  name text not null,
  address text, ubigeo varchar(6), email citext, phone text,
  responsible_user_id uuid references users(id),
  status record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1,
  unique(company_id,sunat_code)
);

create table organizational_areas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  parent_id uuid references organizational_areas(id),
  code text not null, name text not null,
  responsible_user_id uuid references users(id),
  active_from date not null default current_date, active_until date,
  status record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1,
  check(parent_id is null or parent_id <> id),
  check(active_until is null or active_until >= active_from),
  unique(company_id,code)
);

create or replace function prevent_area_cycle() returns trigger language plpgsql as $$
declare cursor_id uuid;
begin
  cursor_id := new.parent_id;
  while cursor_id is not null loop
    if cursor_id = new.id then raise exception 'AREA_CYCLE'; end if;
    select parent_id into cursor_id from organizational_areas where id=cursor_id and company_id=new.company_id;
  end loop;
  return new;
end $$;
create trigger organizational_areas_no_cycle before insert or update of parent_id on organizational_areas
for each row execute function prevent_area_cycle();

create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  parent_id uuid references cost_centers(id),
  area_id uuid references organizational_areas(id),
  code text not null, name text not null,
  responsible_user_id uuid references users(id),
  active_from date not null default current_date, active_until date,
  status record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1,
  check(parent_id is null or parent_id <> id),
  check(active_until is null or active_until >= active_from),
  unique(company_id,code)
);

create table user_companies (
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(user_id,company_id)
);
create table user_branches (
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(user_id,branch_id)
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid references companies(id),
  code text not null, name text not null, description text,
  is_system boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1,
  unique(tenant_id,company_id,code)
);
create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$'),
  name text not null, description text, created_at timestamptz not null default now()
);
create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(role_id,permission_id)
);
create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  assigned_at timestamptz not null default now(), assigned_by uuid references users(id),
  primary key(user_id,company_id,role_id)
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null, description text not null,
  version text not null, dependencies jsonb not null default '[]',
  required_permissions jsonb not null default '[]',
  default_enabled boolean not null default false,
  implemented boolean not null default false,
  created_at timestamptz not null default now()
);
create table company_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id) on delete cascade,
  module_id uuid not null references modules(id),
  status module_status not null default 'disabled',
  configuration jsonb not null default '{}',
  enabled_at timestamptz, enabled_by uuid references users(id),
  disabled_at timestamptz, disabled_by uuid references users(id),
  version integer not null default 1,
  unique(company_id,module_id)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references users(id) on delete cascade,
  token_hash char(64) not null unique,
  ip_address inet, user_agent text,
  expires_at timestamptz not null, last_seen_at timestamptz not null default now(),
  revoked_at timestamptz, created_at timestamptz not null default now()
);
create index sessions_lookup on sessions(token_hash) where revoked_at is null;
create index sessions_user_active on sessions(user_id,expires_at) where revoked_at is null;
create table password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references users(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now()
);
create table login_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id), normalized_email citext not null,
  success boolean not null, ip_address inet, user_agent text,
  occurred_at timestamptz not null default now()
);
create index login_attempts_email_time on login_attempts(normalized_email,occurred_at desc);

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  branch_id uuid references branches(id), storage_key text not null unique,
  original_filename text not null, normalized_filename text not null,
  mime_type text not null, size_bytes bigint not null check(size_bytes between 1 and 26214400),
  sha256 char(64) not null, owner_entity_type text not null, owner_entity_id uuid,
  visibility text not null default 'private' check(visibility in ('private','company','restricted')),
  uploaded_by uuid not null references users(id), uploaded_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid references users(id),
  version integer not null default 1
);
alter table companies add constraint companies_logo_document_fk foreign key(logo_document_id) references documents(id);
alter table user_profiles add constraint profiles_avatar_document_fk foreign key(avatar_document_id) references documents(id);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id), company_id uuid references companies(id),
  actor_user_id uuid references users(id), action text not null, entity_type text not null,
  entity_id uuid, previous_values jsonb, new_values jsonb,
  ip_address inet, user_agent text, request_id text not null,
  occurred_at timestamptz not null default now()
);
create index audit_tenant_company_time on audit_events(tenant_id,company_id,occurred_at desc);
create index audit_entity on audit_events(entity_type,entity_id);
create rule audit_no_update as on update to audit_events do instead nothing;
create rule audit_no_delete as on delete to audit_events do instead nothing;

create table system_settings (
  key text primary key, value jsonb not null, description text,
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1
);
create table company_settings (
  tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  key text not null, value jsonb not null,
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1,
  primary key(company_id,key)
);
create table catalog_types (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  system_managed boolean not null default true, created_at timestamptz not null default now()
);
create table catalog_items (
  id uuid primary key default gen_random_uuid(), catalog_type_id uuid not null references catalog_types(id),
  tenant_id uuid references tenants(id), company_id uuid references companies(id),
  code text not null, name text not null, metadata jsonb not null default '{}',
  status record_status not null default 'active', sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(catalog_type_id,tenant_id,company_id,code)
);

create index companies_tenant_status on companies(tenant_id,status);
create index branches_company_status on branches(company_id,status);
create index establishments_company_status on establishments(company_id,status);
create index areas_company_parent on organizational_areas(company_id,parent_id);
create index cost_centers_company_parent on cost_centers(company_id,parent_id);
create index users_tenant_status on users(tenant_id,status);
create index documents_company_time on documents(company_id,uploaded_at desc) where deleted_at is null;

alter table companies enable row level security;
alter table branches enable row level security;
alter table establishments enable row level security;
alter table organizational_areas enable row level security;
alter table cost_centers enable row level security;
alter table documents enable row level security;
alter table audit_events enable row level security;

create function app_tenant_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.tenant_id', true),'')::uuid
$$;
create function app_company_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.company_id', true),'')::uuid
$$;
create policy company_tenant_isolation on companies using(tenant_id=app_tenant_id()) with check(tenant_id=app_tenant_id());
create policy branch_company_isolation on branches using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id());
create policy establishment_company_isolation on establishments using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id());
create policy area_company_isolation on organizational_areas using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id());
create policy cost_center_company_isolation on cost_centers using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id());
create policy document_company_isolation on documents using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id());
create policy audit_company_isolation on audit_events for select using(tenant_id=app_tenant_id() and (company_id is null or company_id=app_company_id()));
