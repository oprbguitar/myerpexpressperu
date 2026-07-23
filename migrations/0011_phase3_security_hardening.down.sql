drop view if exists consent_record_effective_status;
drop view if exists legal_acceptance_effective_status;
drop table if exists consent_withdrawals;
drop table if exists legal_acceptance_revocations;

alter table demo_reset_jobs
  drop constraint if exists demo_reset_jobs_snapshot_scope_fk,
  drop constraint if exists demo_reset_jobs_profile_scope_fk;
alter table consent_records
  drop constraint if exists consent_records_version_scope_fk;
alter table legal_acceptances
  drop constraint if exists legal_acceptances_version_scope_fk;
alter table ocr_jobs
  drop constraint if exists ocr_jobs_document_scope_fk;
alter table provider_configurations
  drop constraint if exists provider_configurations_definition_scope_fk;
alter table occupational_exam_medical_details
  drop constraint if exists occupational_exam_medical_details_exam_scope_fk;

alter table demo_snapshots drop constraint if exists demo_snapshots_id_scope_unique;
alter table demo_profiles drop constraint if exists demo_profiles_id_scope_unique;
alter table consent_records drop constraint if exists consent_records_id_scope_unique;
alter table consent_versions drop constraint if exists consent_versions_id_scope_unique;
alter table legal_acceptances drop constraint if exists legal_acceptances_id_scope_unique;
alter table legal_document_versions drop constraint if exists legal_document_versions_id_scope_unique;
alter table provider_definitions drop constraint if exists provider_definitions_id_scope_unique;
alter table occupational_exams drop constraint if exists occupational_exams_id_scope_unique;
alter table documents drop constraint if exists documents_id_tenant_company_unique;
