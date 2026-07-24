-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
drop table if exists audit_integrity_checkpoints, security_events, system_metrics,
  demo_reset_history, demo_reset_jobs, demo_snapshots, demo_scenarios, demo_profiles,
  provider_usage_records, provider_health_checks, provider_configurations, provider_definitions,
  legal_holds, retention_executions, retention_rules, privacy_request_actions, privacy_requests,
  consent_records, consent_versions, consent_purposes, data_classification_assignments,
  data_classifications, legal_source_references, legal_requirements, legal_acceptances,
  legal_document_versions, legal_documents cascade;
drop function if exists enforce_demo_reset_guards();
drop function if exists prevent_published_legal_version_mutation();
drop function if exists app_has_provider_secret_access();
