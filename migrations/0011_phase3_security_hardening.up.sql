-- Phase 3 security hardening: scope-safe sensitive references and immutable
-- revocation/withdrawal events. This migration is intentionally additive.

alter table documents
  add constraint documents_id_tenant_company_unique unique(id,tenant_id,company_id);
alter table occupational_exams
  add constraint occupational_exams_id_scope_unique unique(id,tenant_id,company_id);
alter table provider_definitions
  add constraint provider_definitions_id_scope_unique unique(id,tenant_id,company_id);
alter table legal_document_versions
  add constraint legal_document_versions_id_scope_unique unique(id,tenant_id,company_id);
alter table legal_acceptances
  add constraint legal_acceptances_id_scope_unique unique(id,tenant_id,company_id);
alter table consent_versions
  add constraint consent_versions_id_scope_unique unique(id,tenant_id,company_id);
alter table consent_records
  add constraint consent_records_id_scope_unique unique(id,tenant_id,company_id);
alter table demo_profiles
  add constraint demo_profiles_id_scope_unique unique(id,tenant_id,company_id);
alter table demo_snapshots
  add constraint demo_snapshots_id_scope_unique unique(id,tenant_id,company_id);

alter table occupational_exam_medical_details
  add constraint occupational_exam_medical_details_exam_scope_fk
  foreign key(occupational_exam_id,tenant_id,company_id)
  references occupational_exams(id,tenant_id,company_id);
alter table provider_configurations
  add constraint provider_configurations_definition_scope_fk
  foreign key(provider_definition_id,tenant_id,company_id)
  references provider_definitions(id,tenant_id,company_id);
alter table ocr_jobs
  add constraint ocr_jobs_document_scope_fk
  foreign key(document_id,tenant_id,company_id)
  references documents(id,tenant_id,company_id);
alter table legal_acceptances
  add constraint legal_acceptances_version_scope_fk
  foreign key(legal_document_version_id,tenant_id,company_id)
  references legal_document_versions(id,tenant_id,company_id);
alter table consent_records
  add constraint consent_records_version_scope_fk
  foreign key(consent_version_id,tenant_id,company_id)
  references consent_versions(id,tenant_id,company_id);
alter table demo_reset_jobs
  add constraint demo_reset_jobs_profile_scope_fk
  foreign key(demo_profile_id,tenant_id,company_id)
  references demo_profiles(id,tenant_id,company_id),
  add constraint demo_reset_jobs_snapshot_scope_fk
  foreign key(snapshot_id,tenant_id,company_id)
  references demo_snapshots(id,tenant_id,company_id);

create table legal_acceptance_revocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  legal_acceptance_id uuid not null,
  reason text not null check(char_length(trim(reason)) between 3 and 1000),
  revoked_at timestamptz not null default now(),
  revoked_by uuid references users(id),
  evidence_hash char(64) check(evidence_hash is null or evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  version integer not null default 1 check(version=1),
  constraint legal_acceptance_revocations_acceptance_scope_fk
    foreign key(legal_acceptance_id,tenant_id,company_id)
    references legal_acceptances(id,tenant_id,company_id),
  unique(legal_acceptance_id)
);

create table consent_withdrawals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  consent_record_id uuid not null,
  reason text check(reason is null or char_length(trim(reason)) between 3 and 1000),
  withdrawn_at timestamptz not null default now(),
  withdrawn_by uuid references users(id),
  evidence_hash char(64) check(evidence_hash is null or evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  version integer not null default 1 check(version=1),
  constraint consent_withdrawals_record_scope_fk
    foreign key(consent_record_id,tenant_id,company_id)
    references consent_records(id,tenant_id,company_id),
  unique(consent_record_id)
);

create index legal_acceptance_revocations_scope_time
  on legal_acceptance_revocations(tenant_id,company_id,revoked_at desc);
create index consent_withdrawals_scope_time
  on consent_withdrawals(tenant_id,company_id,withdrawn_at desc);

alter table legal_acceptance_revocations enable row level security;
create policy legal_acceptance_revocations_company_isolation on legal_acceptance_revocations
  using(tenant_id=app_tenant_id() and company_id=app_company_id())
  with check(tenant_id=app_tenant_id() and company_id=app_company_id());
alter table consent_withdrawals enable row level security;
create policy consent_withdrawals_company_isolation on consent_withdrawals
  using(tenant_id=app_tenant_id() and company_id=app_company_id())
  with check(tenant_id=app_tenant_id() and company_id=app_company_id());

create trigger legal_acceptance_revocations_no_update_or_delete
  before update or delete on legal_acceptance_revocations
  for each row execute function prevent_phase3_history_mutation();
create trigger consent_withdrawals_no_update_or_delete
  before update or delete on consent_withdrawals
  for each row execute function prevent_phase3_history_mutation();

create view legal_acceptance_effective_status with (security_barrier=true,security_invoker=true) as
select
  a.id legal_acceptance_id,
  a.tenant_id,
  a.company_id,
  a.legal_document_version_id,
  a.user_id,
  a.party_id,
  a.accepted_at,
  coalesce(r.revoked_at,a.revoked_at) revoked_at,
  (a.revoked_at is null and r.id is null) active
from legal_acceptances a
left join legal_acceptance_revocations r on
  r.legal_acceptance_id=a.id and r.tenant_id=a.tenant_id and r.company_id=a.company_id;

create view consent_record_effective_status with (security_barrier=true,security_invoker=true) as
select
  c.id consent_record_id,
  c.tenant_id,
  c.company_id,
  c.consent_version_id,
  c.data_subject_type,
  c.data_subject_id,
  c.granted,
  c.recorded_at,
  coalesce(w.withdrawn_at,c.withdrawn_at) withdrawn_at,
  (c.granted and c.withdrawn_at is null and w.id is null) active
from consent_records c
left join consent_withdrawals w on
  w.consent_record_id=c.id and w.tenant_id=c.tenant_id and w.company_id=c.company_id;

comment on column legal_acceptances.revoked_at is
  'Deprecated in Phase 3. Record revocation in legal_acceptance_revocations; acceptance rows are immutable.';
comment on column consent_records.withdrawn_at is
  'Deprecated in Phase 3. Record withdrawal in consent_withdrawals; consent rows are immutable.';
