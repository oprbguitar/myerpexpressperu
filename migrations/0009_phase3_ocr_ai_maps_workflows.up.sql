-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
-- Phase 3: OCR, governed AI, maps and workflow rules.

create table ocr_jobs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  document_id uuid not null references documents(id), provider_code text not null, requested_by uuid not null references users(id),
  document_classification text not null check(document_classification in ('public','internal','confidential','restricted')),
  status text not null default 'queued' check(status in ('queued','processing','review_required','approved','rejected','failed','cancelled')),
  page_count integer check(page_count is null or page_count>0), error_code text, started_at timestamptz, completed_at timestamptz,
  retention_until timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table ocr_job_pages (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ocr_job_id uuid not null references ocr_jobs(id) on delete cascade, page_number integer not null check(page_number>0),
  status text not null default 'pending' check(status in ('pending','processed','failed')), confidence numeric(5,4) check(confidence is null or confidence between 0 and 1),
  provider_page_reference text, created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version>0),
  unique(ocr_job_id,page_number)
);
create table ocr_extractions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ocr_job_id uuid not null references ocr_jobs(id) on delete cascade, extraction_type text not null,
  raw_text text, structured_result jsonb not null default '{}', confidence numeric(5,4) check(confidence is null or confidence between 0 and 1),
  status text not null default 'draft' check(status in ('draft','reviewed','approved','rejected')),
  reviewed_by uuid references users(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table ocr_extracted_fields (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ocr_extraction_id uuid not null references ocr_extractions(id) on delete cascade, field_path text not null,
  extracted_value text, normalized_value jsonb, confidence numeric(5,4) check(confidence is null or confidence between 0 and 1),
  review_status text not null default 'pending' check(review_status in ('pending','accepted','corrected','rejected')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(ocr_extraction_id,field_path)
);
create table ocr_corrections (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  extracted_field_id uuid not null references ocr_extracted_fields(id) on delete cascade,
  previous_value text, corrected_value text, reason text, corrected_by uuid not null references users(id), corrected_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);

create table ai_providers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, provider_type text not null check(provider_type in ('local','openai_compatible','managed','mock')),
  base_url text, status text not null default 'inactive' check(status in ('active','inactive','degraded')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table ai_provider_configurations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ai_provider_id uuid not null references ai_providers(id) on delete cascade, model_name text not null,
  secret_reference text, encrypted_secret bytea, parameters jsonb not null default '{}',
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(num_nonnulls(secret_reference,encrypted_secret)<=1), unique(ai_provider_id,model_name)
);
create table ai_policies (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, allowed_data_classifications text[] not null default array['public','internal'],
  allowed_tools text[] not null default '{}', max_input_characters integer not null default 20000 check(max_input_characters between 1 and 200000),
  content_logging_enabled boolean not null default false, human_review_required boolean not null default true,
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table ai_prompt_templates (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, purpose text not null, ai_policy_id uuid not null references ai_policies(id),
  current_version integer not null default 1 check(current_version>0), status text not null default 'draft' check(status in ('draft','active','retired')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table ai_prompt_template_versions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  prompt_template_id uuid not null references ai_prompt_templates(id) on delete cascade, version_number integer not null check(version_number>0),
  system_instructions text not null, input_schema jsonb not null default '{}', output_schema jsonb not null default '{}',
  checksum char(64) not null check(checksum ~ '^[0-9a-f]{64}$'), approved_at timestamptz, approved_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(prompt_template_id,version_number)
);
create table ai_interactions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ai_provider_id uuid references ai_providers(id), prompt_template_version_id uuid references ai_prompt_template_versions(id),
  requested_by uuid not null references users(id), purpose text not null, input_classification text not null check(input_classification in ('public','internal','confidential','restricted')),
  input_hash char(64) not null check(input_hash ~ '^[0-9a-f]{64}$'), output_hash char(64) check(output_hash is null or output_hash ~ '^[0-9a-f]{64}$'),
  input_content text, output_content text, status text not null default 'requested' check(status in ('requested','completed','blocked','failed','review_required','approved','rejected')),
  prompt_tokens integer not null default 0 check(prompt_tokens>=0), completion_tokens integer not null default 0 check(completion_tokens>=0),
  estimated_cost numeric(18,8) not null default 0 check(estimated_cost>=0), latency_ms integer check(latency_ms is null or latency_ms>=0),
  retention_until timestamptz, created_at timestamptz not null default now(), created_by uuid references users(id),
  updated_at timestamptz not null default now(), updated_by uuid references users(id), version integer not null default 1 check(version>0),
  check(input_classification not in ('confidential','restricted') or (input_content is null and output_content is null))
);
create table ai_tool_calls (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ai_interaction_id uuid not null references ai_interactions(id) on delete cascade, tool_name text not null,
  arguments_hash char(64) not null check(arguments_hash ~ '^[0-9a-f]{64}$'), result_hash char(64),
  consequence_level text not null default 'read_only' check(consequence_level in ('read_only','draft_only')),
  status text not null check(status in ('allowed','blocked','completed','failed')), blocked_reason text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table ai_feedback (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ai_interaction_id uuid not null references ai_interactions(id) on delete cascade, user_id uuid not null references users(id),
  rating integer not null check(rating between 1 and 5), useful boolean, comments text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(ai_interaction_id,user_id)
);
create table ai_usage_budgets (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  period_type text not null check(period_type in ('daily','monthly')), amount_limit numeric(18,4) not null check(amount_limit>=0),
  token_limit bigint check(token_limit is null or token_limit>=0), currency char(3) not null default 'USD',
  warning_percent numeric(5,2) not null default 80 check(warning_percent between 0 and 100),
  valid_from date not null, valid_until date, status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(valid_until is null or valid_until>=valid_from)
);
create table ai_incidents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  ai_interaction_id uuid references ai_interactions(id), incident_type text not null, severity text not null check(severity in ('low','medium','high','critical')),
  summary text not null, status text not null default 'open' check(status in ('open','investigating','contained','closed')),
  reported_at timestamptz not null default now(), closed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);

create table geo_locations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  entity_type text not null check(entity_type in ('party','project','branch','asset')), entity_id uuid not null,
  latitude numeric(9,6) not null check(latitude between -90 and 90), longitude numeric(9,6) not null check(longitude between -180 and 180),
  address_text text, precision_level text not null default 'manual' check(precision_level in ('exact','approximate','manual')),
  source text not null default 'manual' check(source in ('manual','provider')), verified_at timestamptz, verified_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,entity_type,entity_id)
);
create table geocoding_attempts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  entity_type text not null, entity_id uuid not null, provider_code text not null, address_hash char(64) not null check(address_hash ~ '^[0-9a-f]{64}$'),
  status text not null check(status in ('succeeded','not_found','failed','rate_limited')), response_reference text,
  attempted_at timestamptz not null default now(), latency_ms integer check(latency_ms is null or latency_ms>=0),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);
create table geographical_aggregates (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  aggregate_type text not null, area_code text not null, metric_code text not null, metric_value numeric(24,6) not null,
  period_start date not null, period_end date not null, calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), check(period_end>=period_start), unique(company_id,aggregate_type,area_code,metric_code,period_start,period_end)
);

create table workflow_rules (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  code text not null, name text not null, event_type text not null, current_version integer not null default 1 check(current_version>0),
  status text not null default 'draft' check(status in ('draft','active','paused','retired')),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,code)
);
create table workflow_rule_versions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  workflow_rule_id uuid not null references workflow_rules(id) on delete cascade, version_number integer not null check(version_number>0),
  conditions jsonb not null default '{}', actions jsonb not null default '[]',
  checksum char(64) not null check(checksum ~ '^[0-9a-f]{64}$'), approved_at timestamptz, approved_by uuid references users(id),
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(workflow_rule_id,version_number)
);
create table workflow_executions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  workflow_rule_version_id uuid not null references workflow_rule_versions(id), event_id uuid, idempotency_key text not null,
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed','blocked')),
  attempt_count integer not null default 0 check(attempt_count>=0), started_at timestamptz, completed_at timestamptz,
  output_summary jsonb not null default '{}', error_code text,
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0), unique(company_id,idempotency_key)
);
create table workflow_simulations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), company_id uuid not null references companies(id),
  workflow_rule_version_id uuid not null references workflow_rule_versions(id), simulated_by uuid not null references users(id),
  input_event jsonb not null, predicted_actions jsonb not null default '[]', warnings jsonb not null default '[]',
  created_at timestamptz not null default now(), created_by uuid references users(id), updated_at timestamptz not null default now(), updated_by uuid references users(id),
  version integer not null default 1 check(version>0)
);

create index ocr_jobs_review_queue on ocr_jobs(company_id,status,created_at) where status in ('queued','processing','review_required');
create index ocr_extractions_job on ocr_extractions(ocr_job_id,status);
create index ai_interactions_usage on ai_interactions(company_id,created_at desc,status);
create index ai_interactions_retention on ai_interactions(retention_until) where retention_until is not null;
create index ai_incidents_open on ai_incidents(company_id,severity,reported_at desc) where status<>'closed';
create index geo_locations_coordinates on geo_locations(company_id,latitude,longitude);
create index geocoding_attempts_lookup on geocoding_attempts(company_id,entity_type,entity_id,attempted_at desc);
create index workflow_executions_queue on workflow_executions(company_id,status,created_at) where status in ('queued','running');

create function prevent_phase3_history_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'APPEND_ONLY_HISTORY';
end
$$;
create trigger ai_interactions_no_delete before delete on ai_interactions for each row execute function prevent_phase3_history_mutation();
create trigger ai_tool_calls_no_update_or_delete before update or delete on ai_tool_calls for each row execute function prevent_phase3_history_mutation();
create trigger ocr_corrections_no_update_or_delete before update or delete on ocr_corrections for each row execute function prevent_phase3_history_mutation();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'ocr_jobs','ocr_job_pages','ocr_extractions','ocr_extracted_fields','ocr_corrections',
    'ai_providers','ai_provider_configurations','ai_policies','ai_prompt_templates','ai_prompt_template_versions',
    'ai_interactions','ai_tool_calls','ai_feedback','ai_usage_budgets','ai_incidents',
    'geo_locations','geocoding_attempts','geographical_aggregates','workflow_rules',
    'workflow_rule_versions','workflow_executions','workflow_simulations'
  ] loop
    execute format('alter table %I enable row level security',table_name);
    execute format(
      'create policy %I on %I using(tenant_id=app_tenant_id() and company_id=app_company_id()) with check(tenant_id=app_tenant_id() and company_id=app_company_id())',
      table_name || '_company_isolation',table_name
    );
  end loop;
end $$;
