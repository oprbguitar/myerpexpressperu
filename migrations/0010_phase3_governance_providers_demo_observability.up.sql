-- Phase 3: legal/privacy governance, provider management, demo safety and observability.

create table legal_documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, title text not null, document_type text not null check(document_type in ('terms','privacy_notice','ai_notice','ocr_notice','support_policy','complaints','other')),
  audience text not null default 'users' check(audience in ('users','customers','employees','public')), current_version integer not null default 1 check(current_version>0),
  status text not null default 'draft' check(status in ('draft','under_review','approved','published','superseded','retired')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table legal_document_versions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  legal_document_id uuid not null references legal_documents(id) on delete cascade, version_number integer not null check(version_number>0),
  content_markdown text not null, checksum char(64) not null check(checksum ~ '^[0-9a-f]{64}$'), effective_from timestamptz,
  acceptance_required boolean not null default false,
  status text not null default 'draft' check(status in ('draft','under_review','approved','published','superseded','retired')),
  published_at timestamptz, published_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0),
  check((status in ('published','superseded','retired') and published_at is not null and published_by is not null) or status not in ('published','superseded','retired')),
  unique(legal_document_id,version_number)
);
create table legal_acceptances (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  legal_document_version_id uuid not null references legal_document_versions(id), user_id uuid references users(id), party_id uuid references parties(id),
  accepted_at timestamptz not null default now(), ip_address inet, user_agent text, evidence_hash char(64) not null check(evidence_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz, created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version>0),
  check(num_nonnulls(user_id,party_id)=1)
);
create unique index legal_acceptances_user_unique on legal_acceptances(legal_document_version_id,user_id) where user_id is not null and revoked_at is null;
create unique index legal_acceptances_party_unique on legal_acceptances(legal_document_version_id,party_id) where party_id is not null and revoked_at is null;
create table legal_requirements (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, title text not null, jurisdiction text not null default 'PE', authority text not null,
  applicability text not null, implementation_status text not null default 'not_assessed' check(implementation_status in ('not_assessed','planned','implemented','not_applicable','needs_review')),
  responsible_user_id uuid references users(id), review_due_on date,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table legal_source_references (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  legal_requirement_id uuid not null references legal_requirements(id) on delete cascade, title text not null, issuing_institution text not null,
  publication_date date, official_url text not null check(official_url ~ '^https://'), consulted_on date not null, content_hash char(64),
  notes text, created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version>0),
  unique(legal_requirement_id,official_url)
);

create table data_classifications (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, sensitivity_rank integer not null check(sensitivity_rank between 0 and 100),
  external_processing_allowed boolean not null default false, encryption_required boolean not null default false,
  retention_default_days integer check(retention_default_days is null or retention_default_days>0),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table data_classification_assignments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  data_classification_id uuid not null references data_classifications(id), resource_type text not null, resource_id uuid, field_path text,
  assigned_by uuid references users(id), assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,resource_type,resource_id,field_path)
);
create table consent_purposes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, description text not null, lawful_basis text not null,
  current_version integer not null default 1 check(current_version>0), status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table consent_versions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  consent_purpose_id uuid not null references consent_purposes(id) on delete cascade, version_number integer not null check(version_number>0),
  notice_text text not null, checksum char(64) not null check(checksum ~ '^[0-9a-f]{64}$'), effective_from timestamptz not null,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(consent_purpose_id,version_number)
);
create table consent_records (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  consent_version_id uuid not null references consent_versions(id), data_subject_type text not null check(data_subject_type in ('user','party','employee')),
  data_subject_id uuid not null, granted boolean not null, recorded_at timestamptz not null default now(), source text not null,
  evidence_hash char(64) not null check(evidence_hash ~ '^[0-9a-f]{64}$'), withdrawn_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table privacy_requests (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  request_number text not null, request_type text not null check(request_type in ('access','rectification','cancellation','opposition','information','withdraw_consent')),
  data_subject_type text not null, data_subject_reference text not null, received_at timestamptz not null default now(), due_at timestamptz,
  status text not null default 'received' check(status in ('received','identity_verification','in_progress','fulfilled','rejected','cancelled')),
  assigned_to uuid references users(id), response_summary text, completed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,request_number)
);
create table privacy_request_actions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  privacy_request_id uuid not null references privacy_requests(id) on delete cascade, action_type text not null, description text not null,
  performed_at timestamptz not null default now(), performed_by uuid references users(id), evidence_document_id uuid references documents(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table retention_rules (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, resource_type text not null, retention_days integer not null check(retention_days>0), action text not null check(action in ('delete','anonymize','archive','review')),
  legal_basis text, status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table retention_executions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  retention_rule_id uuid not null references retention_rules(id), started_at timestamptz not null default now(), completed_at timestamptz,
  status text not null default 'running' check(status in ('running','completed','failed','cancelled')),
  examined_count bigint not null default 0 check(examined_count>=0), affected_count bigint not null default 0 check(affected_count>=0), error_summary text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table legal_holds (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, reason text not null, resource_type text, resource_id uuid, starts_at timestamptz not null default now(), ends_at timestamptz,
  status text not null default 'active' check(status in ('active','released')), approved_by uuid not null references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(ends_at is null or ends_at>=starts_at), unique(company_id,code)
);

create table provider_definitions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, capability text not null check(capability in ('ai','ocr','geocoding','email','storage','sunat','other')),
  adapter_type text not null, base_url text, status text not null default 'inactive' check(status in ('active','inactive','deprecated')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table provider_configurations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  provider_definition_id uuid not null references provider_definitions(id) on delete cascade, configuration_name text not null,
  non_secret_settings jsonb not null default '{}', secret_reference text, encrypted_secret bytea,
  enabled boolean not null default false, timeout_ms integer not null default 10000 check(timeout_ms between 100 and 120000),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(num_nonnulls(secret_reference,encrypted_secret)<=1),
  check(not (non_secret_settings ?| array['apiKey','api_key','secret','password','token','credential'])),
  unique(provider_definition_id,configuration_name)
);
create table provider_health_checks (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  provider_configuration_id uuid not null references provider_configurations(id) on delete cascade,
  status text not null check(status in ('healthy','degraded','unavailable','disabled')), checked_at timestamptz not null default now(),
  latency_ms integer check(latency_ms is null or latency_ms>=0), error_code text, safe_message text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table provider_usage_records (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  provider_configuration_id uuid not null references provider_configurations(id), operation text not null, occurred_at timestamptz not null default now(),
  units numeric(24,6) not null default 0 check(units>=0), estimated_cost numeric(18,8) not null default 0 check(estimated_cost>=0),
  currency char(3) not null default 'USD', success boolean not null, request_hash char(64),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);

create table demo_profiles (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, description text, reset_enabled boolean not null default false,
  reset_schedule text, data_disclaimer text not null,
  environment_fingerprint text not null check(char_length(environment_fingerprint) between 16 and 128),
  status text not null default 'inactive' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table demo_scenarios (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  demo_profile_id uuid not null references demo_profiles(id) on delete cascade, code text not null, name text not null,
  description text not null, seed_manifest jsonb not null default '{}', status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(demo_profile_id,code)
);
create table demo_snapshots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  demo_profile_id uuid not null references demo_profiles(id) on delete cascade, scenario_id uuid references demo_scenarios(id),
  storage_reference text not null, checksum char(64) not null check(checksum ~ '^[0-9a-f]{64}$'), database_version text not null,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table demo_reset_jobs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  demo_profile_id uuid not null references demo_profiles(id), snapshot_id uuid references demo_snapshots(id),
  requested_by uuid not null references users(id), confirmation_phrase text not null check(confirmation_phrase='RESET DEMO DATA'),
  environment_name text not null check(environment_name='demo'),
  environment_fingerprint text not null check(char_length(environment_fingerprint) between 16 and 128),
  status text not null default 'queued' check(status in ('queued','running','completed','failed','cancelled')),
  requested_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, error_summary text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table demo_reset_history (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  demo_reset_job_id uuid not null unique references demo_reset_jobs(id), completed_by uuid references users(id),
  completed_at timestamptz not null, snapshot_checksum char(64) not null, rows_deleted bigint not null default 0 check(rows_deleted>=0),
  rows_inserted bigint not null default 0 check(rows_inserted>=0), verification_summary jsonb not null default '{}',
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);

create table system_metrics (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  metric_name text not null, metric_value numeric(30,8) not null, unit text not null, labels jsonb not null default '{}',
  observed_at timestamptz not null default now(), retention_until timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table security_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  event_type text not null, severity text not null check(severity in ('info','low','medium','high','critical')),
  actor_user_id uuid references users(id), source_ip inet, entity_type text, entity_id uuid, request_id text,
  summary text not null, details jsonb not null default '{}', occurred_at timestamptz not null default now(), retention_until timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table audit_integrity_checkpoints (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  period_start timestamptz not null, period_end timestamptz not null, event_count bigint not null check(event_count>=0),
  first_event_id uuid, last_event_id uuid, previous_checkpoint_hash char(64), checkpoint_hash char(64) not null check(checkpoint_hash ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz, verification_status text not null default 'pending' check(verification_status in ('pending','valid','invalid')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(period_end>=period_start), unique(company_id,period_start,period_end)
);

create index legal_document_versions_effective on legal_document_versions(company_id,effective_from desc) where published_at is not null;
create index legal_requirements_review on legal_requirements(company_id,review_due_on) where implementation_status in ('not_assessed','planned','needs_review');
create index privacy_requests_queue on privacy_requests(company_id,status,due_at);
create index retention_executions_status on retention_executions(company_id,status,started_at desc);
create index provider_health_checks_latest on provider_health_checks(provider_configuration_id,checked_at desc);
create index provider_usage_period on provider_usage_records(company_id,provider_configuration_id,occurred_at desc);
create index demo_reset_jobs_queue on demo_reset_jobs(company_id,status,requested_at) where status in ('queued','running');
create index system_metrics_lookup on system_metrics(company_id,metric_name,observed_at desc);
create index security_events_response on security_events(company_id,severity,occurred_at desc);
create index audit_integrity_checkpoints_latest on audit_integrity_checkpoints(company_id,period_end desc);

create function app_has_provider_secret_access() returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('app.provider_secret_access',true),'')::boolean,false)
$$;
create function prevent_published_legal_version_mutation() returns trigger language plpgsql as $$
begin
  if old.published_at is not null or old.status in ('published','superseded','retired') then
    raise exception 'PUBLISHED_LEGAL_VERSION_IMMUTABLE';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$$;
create function enforce_demo_reset_guards() returns trigger language plpgsql as $$
declare profile_enabled boolean; expected_fingerprint text; tenant_is_demo boolean;
begin
  if coalesce(current_setting('app.environment',true),'') <> 'demo' then
    raise exception 'DEMO_RESET_ENVIRONMENT_GUARD';
  end if;
  if not coalesce(nullif(current_setting('app.demo_reset_enabled',true),'')::boolean,false) then
    raise exception 'DEMO_RESET_RUNTIME_GUARD';
  end if;
  select dp.reset_enabled and dp.status='active',dp.environment_fingerprint,(t.code like 'demo-%')
    into profile_enabled,expected_fingerprint,tenant_is_demo
    from demo_profiles dp join tenants t on t.id=dp.tenant_id
    where dp.id=new.demo_profile_id and dp.tenant_id=new.tenant_id and dp.company_id=new.company_id;
  if not coalesce(profile_enabled,false) then raise exception 'DEMO_RESET_PROFILE_GUARD'; end if;
  if not coalesce(tenant_is_demo,false) then raise exception 'DEMO_RESET_TENANT_GUARD'; end if;
  if new.environment_fingerprint <> expected_fingerprint
     or coalesce(current_setting('app.environment_fingerprint',true),'') <> expected_fingerprint then
    raise exception 'DEMO_RESET_FINGERPRINT_GUARD';
  end if;
  return new;
end
$$;
create trigger demo_reset_jobs_guard before insert on demo_reset_jobs for each row execute function enforce_demo_reset_guards();
create trigger legal_document_versions_published_immutable before update or delete on legal_document_versions
  for each row execute function prevent_published_legal_version_mutation();
create trigger legal_acceptances_no_update_or_delete before update or delete on legal_acceptances for each row execute function prevent_phase3_history_mutation();
create trigger consent_records_no_update_or_delete before update or delete on consent_records for each row execute function prevent_phase3_history_mutation();
create trigger provider_usage_records_no_update_or_delete before update or delete on provider_usage_records for each row execute function prevent_phase3_history_mutation();
create trigger demo_reset_history_no_update_or_delete before update or delete on demo_reset_history for each row execute function prevent_phase3_history_mutation();
create trigger security_events_no_update_or_delete before update or delete on security_events for each row execute function prevent_phase3_history_mutation();
create trigger audit_integrity_checkpoints_no_update_or_delete before update or delete on audit_integrity_checkpoints for each row execute function prevent_phase3_history_mutation();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'legal_documents','legal_document_versions','legal_acceptances','legal_requirements','legal_source_references',
    'data_classifications','data_classification_assignments','consent_purposes','consent_versions','consent_records',
    'privacy_requests','privacy_request_actions','retention_rules','retention_executions','legal_holds',
    'provider_definitions','provider_health_checks','provider_usage_records','demo_profiles','demo_scenarios',
    'demo_snapshots','demo_reset_jobs','demo_reset_history','system_metrics','security_events','audit_integrity_checkpoints'
  ] loop
    execute format('alter table %I enable row level security',table_name);
    execute format(
      'create policy %I on %I using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id())',
      table_name || '_company_isolation',table_name
    );
  end loop;
end $$;

alter table provider_configurations enable row level security;
create policy provider_configurations_restricted on provider_configurations
  using(tenant_id=app_tenant_id() and company_id=app_company_id() and app_has_provider_secret_access())
  with check(tenant_id=app_tenant_id() and company_id=app_company_id() and app_has_provider_secret_access());
