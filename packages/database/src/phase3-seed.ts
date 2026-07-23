import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

interface Phase3SeedContext {
  readonly tenantId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly userId: string;
}

const businessProfiles = [
  ["general-services", "Servicios generales"],
  ["professional-services", "Servicios profesionales"],
  ["retail", "Comercio minorista"],
  ["wholesale", "Comercio mayorista"],
  ["distribution", "Distribución"],
  ["workshop", "Taller"],
  ["light-manufacturing-preparation", "Preparación para manufactura ligera"],
  ["transport-preparation", "Preparación para transporte"],
  ["construction-preparation", "Preparación para construcción"],
  ["mining-contractor-preparation", "Preparación para contratista minero"],
  ["agroindustry-preparation", "Preparación para agroindustria"],
  ["private-contractor", "Contratista privado"],
  ["public-entity-preparation", "Preparación para entidad pública"],
  ["public-company-preparation", "Preparación para empresa pública"]
] as const;

const classifications = [
  ["PUBLIC", "Público", 0, true, false],
  ["INTERNAL", "Interno", 20, true, false],
  ["CONFIDENTIAL", "Confidencial", 40, false, true],
  ["PERSONAL", "Dato personal", 50, false, true],
  ["SENSITIVE_PERSONAL", "Dato personal sensible", 75, false, true],
  ["FINANCIAL", "Financiero", 70, false, true],
  ["MEDICAL_RESTRICTED", "Médico restringido", 100, false, true],
  ["LEGAL_PRIVILEGED", "Legal privilegiado", 90, false, true],
  ["SECRET", "Secreto", 100, false, true]
] as const;

export const phase3PermissionCodes = [
  "admin.settings.read", "admin.settings.manage", "admin.features.read", "admin.features.manage",
  "admin.providers.read", "admin.providers.manage", "admin.providers.rotate-secret",
  "admin.providers.activate", "admin.business-profiles.read", "admin.business-profiles.manage",
  "admin.sensitive-changes.approve",
  "crm.read", "crm.create", "crm.update", "crm.assign", "crm.stage.change", "crm.mark-won",
  "crm.mark-lost", "crm.export", "crm.private-notes.read",
  "projects.read", "projects.create", "projects.update", "projects.activate", "projects.close",
  "projects.financial.read", "projects.budget.manage", "projects.change-request.approve",
  "projects.time.submit", "projects.time.approve", "projects.expenses.submit",
  "projects.expenses.approve", "projects.export",
  "hr.read", "hr.create", "hr.update", "hr.contracts.read", "hr.contracts.manage",
  "hr.compensation-reference.read", "hr.attendance.manage", "hr.leave.manage",
  "hr.documents.read", "hr.documents.manage", "hr.export",
  "sst.read", "sst.manage", "sst.inspections.manage", "sst.corrective-actions.manage",
  "sst.incidents.manage", "sst.medical-status.read", "sst.medical-restricted.read",
  "sst.medical-restricted.manage", "sst.export",
  "assets.read", "assets.create", "assets.update", "assets.assign", "assets.transfer",
  "assets.retire", "maintenance.read", "maintenance.manage", "maintenance.close", "assets.export",
  "ocr.read", "ocr.execute", "ocr.review", "ocr.confirm", "ocr.identity.process",
  "maps.read", "maps.manage",
  "ai.use", "ai.documents.use", "ai.crm.use", "ai.projects.use", "ai.inventory.use",
  "ai.configure", "ai.audit.read", "ai.feedback.submit", "ai.emergency-disable",
  "legal.read", "legal.draft", "legal.approve", "legal.publish", "legal.acceptance.read",
  "privacy.read", "privacy.requests.manage", "privacy.consent.manage",
  "privacy.retention.manage", "privacy.legal-hold.manage", "privacy.export",
  "demo.read", "demo.manage", "demo.reset", "demo.build", "demo.publish",
  "demo.download-package"
] as const;

export async function seedPhase3Foundation(client: PoolClient, context: Phase3SeedContext): Promise<void> {
  for (const [code, name] of businessProfiles) {
    await client.query(
      `insert into business_profiles(
         id,tenant_id,company_id,code,name,description,sector,is_system,created_by,updated_by
       ) values($1,$2,$3,$4,$5,$6,$4,true,$7,$7)
       on conflict(company_id,code) do update set name=excluded.name,description=excluded.description,
         updated_at=now(),updated_by=excluded.updated_by,version=business_profiles.version+1`,
      [
        randomUUID(), context.tenantId, context.companyId, code, name,
        "Plantilla inicial configurable; no restringe permanentemente a la empresa.", context.userId
      ]
    );
  }

  const pipelineId = "00000000-0000-4000-8000-000000003001";
  await client.query(
    `insert into pipelines(id,tenant_id,company_id,code,name,is_default,created_by,updated_by)
     values($1,$2,$3,'commercial-default','Pipeline comercial',true,$4,$4)
     on conflict(company_id,code) do update set name=excluded.name,is_default=true,status='active',
       updated_at=now(),updated_by=excluded.updated_by,version=pipelines.version+1`,
    [pipelineId, context.tenantId, context.companyId, context.userId]
  );
  const stages = [
    ["qualification", "Calificación", 0, 10, null],
    ["proposal", "Propuesta", 1, 35, null],
    ["negotiation", "Negociación", 2, 65, null],
    ["won", "Ganada", 3, 100, "won"],
    ["lost", "Perdida", 4, 0, "lost"]
  ] as const;
  for (const [code, name, position, probability, terminalKind] of stages) {
    await client.query(
      `insert into pipeline_stages(
         id,tenant_id,company_id,pipeline_id,code,name,position,probability,terminal_kind,created_by,updated_by
       ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       on conflict(pipeline_id,code) do update set name=excluded.name,position=excluded.position,
         probability=excluded.probability,terminal_kind=excluded.terminal_kind,
         updated_at=now(),updated_by=excluded.updated_by,version=pipeline_stages.version+1`,
      [randomUUID(), context.tenantId, context.companyId, pipelineId, code, name, position, probability, terminalKind, context.userId]
    );
  }

  await client.query(
    `insert into asset_categories(id,tenant_id,company_id,code,name,created_by,updated_by)
     values($1,$2,$3,'general','Activos generales',$4,$4)
     on conflict(company_id,code) do update set name=excluded.name,updated_at=now(),
       updated_by=excluded.updated_by,version=asset_categories.version+1`,
    [randomUUID(), context.tenantId, context.companyId, context.userId]
  );
  await client.query(
    `insert into asset_locations(id,tenant_id,company_id,branch_id,code,name,created_by,updated_by)
     values($1,$2,$3,$4,'principal','Sede principal',$5,$5)
     on conflict(company_id,code) do update set name=excluded.name,branch_id=excluded.branch_id,
       updated_at=now(),updated_by=excluded.updated_by,version=asset_locations.version+1`,
    [randomUUID(), context.tenantId, context.companyId, context.branchId, context.userId]
  );

  for (const [code, name, rank, externalAllowed, encryptionRequired] of classifications) {
    await client.query(
      `insert into data_classifications(
         id,tenant_id,company_id,code,name,sensitivity_rank,external_processing_allowed,
         encryption_required,created_by,updated_by
       ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       on conflict(company_id,code) do update set name=excluded.name,
         sensitivity_rank=excluded.sensitivity_rank,
         external_processing_allowed=excluded.external_processing_allowed,
         encryption_required=excluded.encryption_required,updated_at=now(),
         updated_by=excluded.updated_by,version=data_classifications.version+1`,
      [randomUUID(), context.tenantId, context.companyId, code, name, rank, externalAllowed, encryptionRequired, context.userId]
    );
  }

  const providerDefinitions = [
    ["ai-disabled", "IA deshabilitada", "ai", "no-ai"],
    ["ai-mock", "IA de demostración", "ai", "mock"],
    ["ocr-mock", "OCR de demostración", "ocr", "mock"],
    ["geocoding-manual", "Geocodificación manual", "geocoding", "manual"],
    ["sunat-manual", "SUNAT manual — No enviado a SUNAT", "sunat", "manual"]
  ] as const;
  for (const [code, name, capability, adapterType] of providerDefinitions) {
    await client.query(
      `insert into provider_definitions(
         id,tenant_id,company_id,code,name,capability,adapter_type,status,created_by,updated_by
       ) values($1,$2,$3,$4,$5,$6,$7,'active',$8,$8)
       on conflict(company_id,code) do update set name=excluded.name,adapter_type=excluded.adapter_type,
         updated_at=now(),updated_by=excluded.updated_by,version=provider_definitions.version+1`,
      [randomUUID(), context.tenantId, context.companyId, code, name, capability, adapterType, context.userId]
    );
  }

  const requirements = [
    ["PE-PDP-01", "Protección de datos personales", "ANPD", "applicable"],
    ["PE-AI-01", "Gobierno de inteligencia artificial", "PCM/SGTD", "conditionally_applicable"],
    ["PE-SIGN-01", "Firma digital IOFE", "PCM", "conditionally_applicable"],
    ["PE-CONS-01", "Protección del consumidor", "Indecopi", "conditionally_applicable"],
    ["PE-SST-01", "Seguridad y salud en el trabajo", "MTPE", "conditionally_applicable"],
    ["PE-CPE-01", "Comprobantes de pago electrónicos", "SUNAT", "requires_legal_review"]
  ] as const;
  for (const [code, title, authority, applicability] of requirements) {
    await client.query(
      `insert into legal_requirements(
         id,tenant_id,company_id,code,title,authority,applicability,
         implementation_status,created_by,updated_by
       ) values($1,$2,$3,$4,$5,$6,$7,'needs_review',$8,$8)
       on conflict(company_id,code) do update set title=excluded.title,authority=excluded.authority,
         applicability=excluded.applicability,updated_at=now(),updated_by=excluded.updated_by,
         version=legal_requirements.version+1`,
      [randomUUID(), context.tenantId, context.companyId, code, title, authority, applicability, context.userId]
    );
  }
}
