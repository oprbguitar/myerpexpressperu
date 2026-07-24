/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { afterAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../packages/database/src/index.js";

const enabled = Boolean(process.env.DATABASE_URL);
const database = enabled ? new PostgresDatabase(process.env.DATABASE_URL!) : null;

const requiredTables = [
  "business_profiles", "business_profile_modules", "feature_flags", "feature_flag_targets",
  "configuration_versions", "configuration_changes", "configuration_approvals",
  "leads", "lead_sources", "pipelines", "pipeline_stages", "opportunities",
  "opportunity_products", "commercial_activities", "opportunity_assignments",
  "opportunity_stage_history", "projects", "project_members", "project_phases",
  "project_milestones", "project_tasks", "task_dependencies", "project_deliverables",
  "project_budgets", "project_budget_versions", "project_costs", "project_time_entries",
  "project_expenses", "project_risks", "project_issues", "project_change_requests",
  "project_status_history", "employees", "employment_contracts", "employee_positions",
  "employee_assignments", "employee_documents", "employee_emergency_contacts",
  "employee_benefits", "employee_leaves", "employee_vacations", "attendance_records",
  "employee_trainings", "employee_certifications", "employee_status_history",
  "sst_hazards", "sst_risks", "sst_risk_assessments", "sst_control_measures",
  "sst_inspections", "sst_inspection_findings", "sst_corrective_actions",
  "sst_training_sessions", "sst_training_attendance", "sst_ppe_items", "sst_ppe_deliveries",
  "sst_incidents", "sst_accidents", "occupational_exams", "occupational_fitness",
  "work_restrictions", "sst_committee_records", "asset_categories", "assets",
  "asset_locations", "asset_assignments", "asset_status_history", "maintenance_plans",
  "maintenance_schedules", "maintenance_work_orders", "maintenance_tasks",
  "maintenance_parts", "maintenance_costs", "meter_readings", "asset_incidents",
  "ocr_jobs", "ocr_job_pages", "ocr_extractions", "ocr_extracted_fields", "ocr_corrections",
  "ai_providers", "ai_provider_configurations", "ai_policies", "ai_prompt_templates",
  "ai_prompt_template_versions", "ai_interactions", "ai_tool_calls", "ai_feedback",
  "ai_usage_budgets", "ai_incidents", "geo_locations", "geocoding_attempts",
  "geographical_aggregates", "workflow_rules", "workflow_rule_versions",
  "workflow_executions", "workflow_simulations", "legal_documents",
  "legal_document_versions", "legal_acceptances", "legal_requirements",
  "legal_source_references", "data_classifications", "data_classification_assignments",
  "consent_purposes", "consent_versions", "consent_records", "privacy_requests",
  "privacy_request_actions", "retention_rules", "retention_executions", "legal_holds",
  "provider_definitions", "provider_configurations", "provider_health_checks",
  "provider_usage_records", "demo_profiles", "demo_scenarios", "demo_snapshots",
  "demo_reset_jobs", "demo_reset_history", "system_metrics", "security_events",
  "audit_integrity_checkpoints"
] as const;

describe.skipIf(!enabled)("persistencia y aislamiento de fase 3", () => {
  afterAll(() => database!.close());

  it("instala todas las tablas obligatorias sin omisiones", async () => {
    const rows = await database!.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema='public' and table_name=any($1::text[])`,
      [[...requiredTables]]
    );
    expect(new Set(rows.map((row) => row.table_name))).toEqual(new Set(requiredTables));
  });

  it("habilita RLS en todas las tablas empresariales de fase 3", async () => {
    const rows = await database!.query<{ table_name: string; row_security: boolean }>(
      `select c.relname table_name,c.relrowsecurity row_security
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and c.relname=any($1::text[])`,
      [[...requiredTables]]
    );
    expect(rows).toHaveLength(requiredTables.length);
    expect(rows.every((row) => row.row_security)).toBe(true);
  });

  it("aplica políticas adicionales a datos médicos y secretos de proveedor", async () => {
    const policies = await database!.query<{ tablename: string; policyname: string; qual: string }>(
      `select tablename,policyname,qual from pg_policies
       where schemaname='public' and tablename=any($1::text[])`,
      [["occupational_exam_medical_details", "provider_configurations"]]
    );
    expect(policies).toHaveLength(2);
    expect(policies.find((row) => row.tablename === "occupational_exam_medical_details")?.qual)
      .toContain("app_has_medical_access()");
    expect(policies.find((row) => row.tablename === "provider_configurations")?.qual)
      .toContain("app_has_provider_secret_access()");
  });

  it("no modela secretos o diagnósticos médicos como texto plano", async () => {
    const columns = await database!.query<{ table_name: string; column_name: string; data_type: string }>(
      `select table_name,column_name,data_type from information_schema.columns
       where table_schema='public'
         and table_name=any($1::text[])
         and column_name=any($2::text[])`,
      [
        ["provider_configurations", "ai_provider_configurations", "occupational_exam_medical_details"],
        ["api_key", "password", "token", "secret", "diagnosis", "medical_notes"]
      ]
    );
    expect(columns).toEqual([]);
    const protectedColumns = await database!.query<{ table_name: string; column_name: string; data_type: string }>(
      `select table_name,column_name,data_type from information_schema.columns
       where table_schema='public' and table_name=any($1::text[])
         and column_name=any($2::text[])`,
      [
        ["provider_configurations", "ai_provider_configurations", "occupational_exam_medical_details"],
        ["secret_reference", "encrypted_secret", "encryption_key_reference", "encrypted_payload"]
      ]
    );
    expect(protectedColumns.some((row) => row.column_name === "encrypted_payload" && row.data_type === "bytea")).toBe(true);
    expect(protectedColumns.some((row) => row.column_name === "secret_reference")).toBe(true);
  });

  it("instala guardas independientes para impedir reinicios demo fuera del entorno demo", async () => {
    const functions = await database!.query<{ definition: string }>(
      `select pg_get_functiondef(p.oid) definition
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='enforce_demo_reset_guards'`
    );
    expect(functions).toHaveLength(1);
    expect(functions[0]!.definition).toContain("DEMO_RESET_ENVIRONMENT_GUARD");
    expect(functions[0]!.definition).toContain("DEMO_RESET_RUNTIME_GUARD");
    expect(functions[0]!.definition).toContain("DEMO_RESET_PROFILE_GUARD");
    expect(functions[0]!.definition).toContain("DEMO_RESET_TENANT_GUARD");
    expect(functions[0]!.definition).toContain("DEMO_RESET_FINGERPRINT_GUARD");
    const confirmation = await database!.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) definition from pg_constraint
       where conrelid='demo_reset_jobs'::regclass and contype='c'`
    );
    expect(confirmation.some((row) => row.definition.includes("RESET DEMO DATA"))).toBe(true);
  });

  it("hace inmutables las versiones legales una vez publicadas", async () => {
    const triggers = await database!.query<{ trigger_name: string }>(
      `select distinct trigger_name from information_schema.triggers
       where event_object_schema='public' and event_object_table='legal_document_versions'
         and trigger_name='legal_document_versions_published_immutable'`
    );
    expect(triggers).toHaveLength(1);
    const functions = await database!.query<{ definition: string }>(
      `select pg_get_functiondef(p.oid) definition
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='prevent_published_legal_version_mutation'`
    );
    expect(functions[0]!.definition).toContain("PUBLISHED_LEGAL_VERSION_IMMUTABLE");
  });

  it("indexa colas, vencimientos y consultas representativas", async () => {
    const expected = [
      "leads_pipeline_search", "opportunities_pipeline_board", "projects_scope_status",
      "employee_documents_expiry", "sst_corrective_actions_due", "maintenance_schedules_due",
      "ocr_jobs_review_queue", "workflow_executions_queue", "privacy_requests_queue",
      "provider_health_checks_latest", "security_events_response"
    ];
    const indexes = await database!.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname='public' and indexname=any($1::text[])`,
      [expected]
    );
    expect(new Set(indexes.map((row) => row.indexname))).toEqual(new Set(expected));
  });
});
