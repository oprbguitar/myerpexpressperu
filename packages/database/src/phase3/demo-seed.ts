/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { moduleRegistry } from "@erp/domain";
import { hashPassword } from "@erp/security";
import type { PoolClient } from "pg";
import { PostgresDatabase } from "../index.js";
import { seedPhase2DemonstrationData } from "../phase2-seed.js";
import {
  assertDemoResetAllowed,
  assertDemoSeedAllowed,
  type DemoResetEnvironment,
  type ObservedDemoIdentity
} from "./demo-guards.js";
import { demoScenarios } from "./demo-scenarios.js";

const ids = {
  tenant: "30000000-0000-4000-8000-000000000001",
  company: "30000000-0000-4000-8000-000000000002",
  branch: "30000000-0000-4000-8000-000000000003",
  adminUser: "30000000-0000-4000-8000-000000000010",
  profile: "33000000-0000-4000-8000-000000000001",
  scenarioA: "33000000-0000-4000-8000-00000000000a",
  scenarioB: "33000000-0000-4000-8000-00000000000b",
  scenarioC: "33000000-0000-4000-8000-00000000000c",
  snapshot: "33000000-0000-4000-8000-000000000020",
  leadSource: "32000000-0000-4000-8000-000000000001",
  pipeline: "32000000-0000-4000-8000-000000000002",
  stageQualified: "32000000-0000-4000-8000-000000000003",
  lead: "32000000-0000-4000-8000-000000000004",
  opportunity: "32000000-0000-4000-8000-000000000005",
  projectA: "32000000-0000-4000-8000-000000000010",
  taskA: "32000000-0000-4000-8000-000000000011",
  timeA: "32000000-0000-4000-8000-000000000012",
  expenseA: "32000000-0000-4000-8000-000000000013",
  projectC: "32000000-0000-4000-8000-000000000020",
  employee: "32000000-0000-4000-8000-000000000021",
  contract: "32000000-0000-4000-8000-000000000022",
  inspection: "32000000-0000-4000-8000-000000000023",
  finding: "32000000-0000-4000-8000-000000000024",
  correctiveAction: "32000000-0000-4000-8000-000000000025",
  assetCategory: "32000000-0000-4000-8000-000000000026",
  assetLocation: "32000000-0000-4000-8000-000000000027",
  asset: "32000000-0000-4000-8000-000000000028",
  maintenancePlan: "32000000-0000-4000-8000-000000000029",
  maintenanceOrder: "32000000-0000-4000-8000-000000000030"
} as const;

const demoUsers = [
  ["admin", "Demo Administrator", "Administrador Demo", "admin@demo.erp-express.test"],
  ["manager", "Demo Manager", "Gerente Ficticia", "manager@demo.erp-express.test"],
  ["sales", "Demo Sales User", "Ventas Ficticio", "sales@demo.erp-express.test"],
  ["cash", "Demo Cash User", "Caja Ficticia", "cash@demo.erp-express.test"],
  ["project", "Demo Project Manager", "Proyecto Ficticio", "project@demo.erp-express.test"],
  ["hr", "Demo HR User", "RRHH Ficticia", "hr@demo.erp-express.test"],
  ["sst", "Demo SST User", "SST Ficticio", "sst@demo.erp-express.test"],
  ["auditor", "Demo Auditor", "Auditoría Ficticia", "auditor@demo.erp-express.test"]
] as const;

const permissionSets: Readonly<Record<(typeof demoUsers)[number][0], readonly string[]>> = {
  admin: [
    "organization.read", "modules.read", "modules.manage", "settings.read", "settings.manage", "audit.read",
    "parties.read", "products.read", "sales.read", "purchases.read", "cash.read", "dashboard.read",
    "admin.settings.read", "admin.settings.manage", "admin.providers.read", "admin.providers.manage",
    "admin.business-profiles.read", "admin.business-profiles.manage", "crm.read", "crm.create", "crm.update",
    "projects.read", "projects.create", "projects.update", "hr.read", "hr.create", "hr.update",
    "sst.read", "sst.manage", "assets.read", "assets.create", "maintenance.read", "maintenance.manage",
    "ocr.read", "ocr.execute", "ocr.review", "ai.use", "maps.read", "legal.read", "privacy.read",
    "demo.read", "demo.manage", "demo.reset"
  ],
  manager: ["dashboard.read", "parties.read", "products.read", "sales.read", "purchases.read", "crm.read", "projects.read", "hr.read", "sst.read", "assets.read", "maintenance.read"],
  sales: ["dashboard.read", "parties.read", "parties.create", "sales.read", "sales.create", "crm.read", "crm.create", "crm.update"],
  cash: ["dashboard.read", "cash.read", "cash.open", "cash.close", "payments.read", "payments.create", "receivables.read", "payables.read"],
  project: ["dashboard.read", "projects.read", "projects.create", "projects.update", "projects.time.submit", "projects.time.approve", "projects.expenses.submit"],
  hr: ["dashboard.read", "hr.read", "hr.create", "hr.update", "hr.contracts.read", "hr.contracts.manage", "hr.documents.read"],
  sst: ["dashboard.read", "sst.read", "sst.manage", "sst.inspections.manage", "sst.corrective-actions.manage", "sst.incidents.manage", "sst.medical-status.read"],
  auditor: ["organization.read", "modules.read", "settings.read", "audit.read", "legal.read", "privacy.read", "demo.read", "ai.audit.read"]
};

const phase2CustomerId = "10000000-0000-4000-8000-000000000011";
const scenarioIds = [ids.scenarioA, ids.scenarioB, ids.scenarioC] as const;
const resetPreservedTables = [
  "tenants", "companies", "users", "branches", "establishments", "organizational_areas", "cost_centers",
  "user_companies", "user_branches", "roles", "user_roles", "company_modules", "audit_events",
  "demo_profiles", "demo_scenarios", "demo_snapshots", "demo_reset_jobs", "demo_reset_history",
  "security_events", "audit_integrity_checkpoints",
  "legal_documents", "legal_document_versions", "legal_acceptances", "legal_acceptance_revocations",
  "consent_purposes", "consent_versions", "consent_records", "consent_withdrawals",
  "privacy_requests", "privacy_request_actions", "retention_rules", "legal_holds"
] as const;

function environment(): DemoResetEnvironment {
  return {
    APP_ENVIRONMENT: process.env.APP_ENVIRONMENT,
    DEMO_RESET_ENABLED: process.env.DEMO_RESET_ENABLED,
    DEMO_TENANT_ID: process.env.DEMO_TENANT_ID,
    DEMO_DATABASE_NAME: process.env.DEMO_DATABASE_NAME,
    DEMO_DATABASE_FINGERPRINT: process.env.DEMO_DATABASE_FINGERPRINT
  };
}

function stableUserId(index: number): string {
  return `31000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function stableRoleId(index: number): string {
  return `31000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`;
}

async function observedDatabaseName(client: PoolClient): Promise<string> {
  const result = await client.query<{ database_name: string }>("select current_database() as database_name");
  const name = result.rows[0]?.database_name;
  if (!name) throw new Error("No se pudo determinar la identidad de la base.");
  return name;
}

async function seedIdentity(client: PoolClient): Promise<void> {
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!password || password.length < 12 || password === "__GENERATED__") {
    throw new Error("DEMO_ADMIN_PASSWORD debe ser generado localmente y contener al menos 12 caracteres.");
  }
  if (process.env.DEMO_TENANT_ID !== ids.tenant) {
    throw new Error("DEMO_TENANT_ID no coincide con el identificador reservado del paquete.");
  }
  const passwordHash = await hashPassword(password);
  await client.query(
    `insert into tenants(id,code,name,status) values($1,$2,$3,'active')
     on conflict(id) do update set code=excluded.code,name=excluded.name,status='active'`,
    [ids.tenant, "demo-erp-express", "ERP Express Perú - Demostración"]
  );
  for (const [index, user] of demoUsers.entries()) {
    const userId = index === 0 ? ids.adminUser : stableUserId(index);
    await client.query(
      `insert into users(id,tenant_id,email,password_hash,force_password_change,status,password_changed_at)
       values($1,$2,$3,$4,false,'active',now())
       on conflict(tenant_id,normalized_email) do update set password_hash=excluded.password_hash,
         force_password_change=false,status='active',failed_login_count=0,blocked_until=null`,
      [userId, ids.tenant, user[3], passwordHash]
    );
    await client.query(
      `insert into user_profiles(user_id,full_name,locale) values($1,$2,'es-PE')
       on conflict(user_id) do update set full_name=excluded.full_name`,
      [userId, user[2]]
    );
  }
  await client.query(
    `insert into companies(id,tenant_id,legal_name,commercial_name,ruc,fiscal_address,ubigeo,email,phone,
       main_currency,time_zone,classification,economic_activity_code,status,created_by)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,'PEN','America/Lima','private_company','6201','active',$10)
     on conflict(id) do update set legal_name=excluded.legal_name,commercial_name=excluded.commercial_name,status='active'`,
    [
      ids.company, ids.tenant, "Empresa Demo Andina S.A.C.", "ERP Demo Andina", "20999999991",
      "Av. Demostración 100, Lima", "150101", "contacto@demo.erp-express.test", "999000001", ids.adminUser
    ]
  );
  await client.query(
    `insert into branches(id,tenant_id,company_id,code,name,address,ubigeo,is_default,status,created_by)
     values($1,$2,$3,'DEMO-LIMA','Sede demo Lima','Av. Demostración 100','150101',true,'active',$4)
     on conflict(id) do update set name=excluded.name,status='active'`,
    [ids.branch, ids.tenant, ids.company, ids.adminUser]
  );

  const allPermissions = [...new Set(Object.values(permissionSets).flat())].sort();
  for (const [index, code] of allPermissions.entries()) {
    const permissionId = `34000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    await client.query(
      `insert into permissions(id,code,name,description) values($1,$2,$3,$4)
       on conflict(code) do update set name=excluded.name,description=excluded.description`,
      [permissionId, code, code, "Permiso de demostración"]
    );
  }
  for (const [index, user] of demoUsers.entries()) {
    const userId = index === 0 ? ids.adminUser : stableUserId(index);
    const roleId = stableRoleId(index);
    await client.query(
      `insert into roles(id,tenant_id,company_id,code,name,description,is_system,status)
       values($1,$2,$3,$4,$5,'Rol sintético del paquete demo',true,'active')
       on conflict(id) do update set name=excluded.name,status='active'`,
      [roleId, ids.tenant, ids.company, `demo-${user[0]}`, user[1]]
    );
    await client.query("delete from role_permissions where role_id=$1", [roleId]);
    await client.query(
      `insert into role_permissions(role_id,permission_id)
       select $1,id from permissions where code=any($2::text[]) on conflict do nothing`,
      [roleId, permissionSets[user[0]]]
    );
    await client.query(
      `insert into user_companies(user_id,tenant_id,company_id,is_default)
       values($1,$2,$3,true) on conflict(user_id,company_id) do update set is_default=true`,
      [userId, ids.tenant, ids.company]
    );
    await client.query(
      `insert into user_branches(user_id,tenant_id,company_id,branch_id,is_default)
       values($1,$2,$3,$4,true) on conflict(user_id,branch_id) do update set is_default=true`,
      [userId, ids.tenant, ids.company, ids.branch]
    );
    await client.query(
      `insert into user_roles(user_id,tenant_id,company_id,role_id,assigned_by)
       values($1,$2,$3,$4,$5) on conflict do nothing`,
      [userId, ids.tenant, ids.company, roleId, ids.adminUser]
    );
  }
  for (const module of moduleRegistry) {
    await client.query(
      `insert into modules(id,code,name,description,version,dependencies,required_permissions,default_enabled,implemented)
       values(gen_random_uuid(),$1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)
       on conflict(code) do update set name=excluded.name,description=excluded.description,
         version=excluded.version,dependencies=excluded.dependencies,
         required_permissions=excluded.required_permissions,implemented=excluded.implemented`,
      [
        module.code, module.name, module.description, module.version, JSON.stringify(module.dependencies),
        JSON.stringify(module.requiredPermissions), module.defaultEnabled, module.implemented
      ]
    );
    if (module.implemented) {
      await client.query(
        `insert into company_modules(tenant_id,company_id,module_id,status,enabled_at,enabled_by)
         select $1,$2,id,'enabled',now(),$3 from modules where code=$4
         on conflict(company_id,module_id) do update set status='enabled',enabled_at=now(),enabled_by=$3`,
        [ids.tenant, ids.company, ids.adminUser, module.code]
      );
    }
  }
}

async function seedPhase3Scenarios(client: PoolClient): Promise<void> {
  await client.query(
    `insert into lead_sources(id,tenant_id,company_id,code,name,status,created_by)
     values($1,$2,$3,'DEMO-REFERIDO','Referido de demostración','active',$4)
     on conflict(id) do update set name=excluded.name,status='active'`,
    [ids.leadSource, ids.tenant, ids.company, ids.adminUser]
  );
  await client.query(
    `insert into pipelines(id,tenant_id,company_id,code,name,is_default,status,created_by)
     values($1,$2,$3,'DEMO-SERVICIOS','Pipeline servicios demo',true,'active',$4)
     on conflict(id) do update set name=excluded.name,is_default=true,status='active'`,
    [ids.pipeline, ids.tenant, ids.company, ids.adminUser]
  );
  await client.query(
    `insert into pipeline_stages(id,tenant_id,company_id,pipeline_id,code,name,position,probability,created_by)
     values($1,$2,$3,$4,'CALIFICADA','Calificada',1,60,$5)
     on conflict(id) do update set name=excluded.name,probability=excluded.probability`,
    [ids.stageQualified, ids.tenant, ids.company, ids.pipeline, ids.adminUser]
  );
  await client.query(
    `insert into leads(id,tenant_id,company_id,source_id,owner_user_id,full_name,organization_name,email,phone,notes,status,qualified_at,created_by)
     values($1,$2,$3,$4,$5,'María Demostración','Estudio Ficticio Norte','maria@ficticio.demo','999000010',
       'Registro completamente sintético','qualified',now(),$5)
     on conflict(id) do update set notes='Registro completamente sintético',status='qualified'`,
    [ids.lead, ids.tenant, ids.company, ids.leadSource, ids.adminUser]
  );
  await client.query(
    `insert into opportunities(id,tenant_id,company_id,pipeline_id,stage_id,lead_id,customer_party_id,
       owner_user_id,code,name,currency,estimated_amount,probability,expected_close_date,status,created_by)
     values($1,$2,$3,$4,$5,$6,$7,$8,'DEMO-OP-001','Implementación ERP ficticia','PEN',18500,60,current_date+30,'open',$8)
     on conflict(id) do update set estimated_amount=18500,probability=60,status='open'`,
    [ids.opportunity, ids.tenant, ids.company, ids.pipeline, ids.stageQualified, ids.lead, phase2CustomerId, ids.adminUser]
  );
  await client.query(
    "update leads set converted_opportunity_id=$2,converted_at=now(),status='converted' where id=$1",
    [ids.lead, ids.opportunity]
  );
  await client.query(
    `insert into projects(id,tenant_id,company_id,code,name,description,customer_party_id,manager_user_id,
       currency,planned_start,planned_end,actual_start,status,created_by)
     values($1,$2,$3,'DEMO-PRO-A','Adopción ERP de servicios','Proyecto sintético del escenario A',$4,$5,
       'PEN',current_date-7,current_date+45,current_date-7,'active',$5)
     on conflict(id) do update set name=excluded.name,status='active'`,
    [ids.projectA, ids.tenant, ids.company, phase2CustomerId, ids.adminUser]
  );
  await client.query(
    `insert into project_tasks(id,tenant_id,company_id,project_id,assignee_user_id,code,title,priority,status,
       planned_start,planned_end,estimated_minutes,created_by)
     values($1,$2,$3,$4,$5,'A-01','Configurar catálogos ficticios','medium','in_progress',
       current_date-2,current_date+5,480,$5)
     on conflict(id) do update set status='in_progress',title=excluded.title`,
    [ids.taskA, ids.tenant, ids.company, ids.projectA, ids.adminUser]
  );
  await client.query(
    `insert into project_time_entries(id,tenant_id,company_id,project_id,task_id,user_id,work_date,minutes,
       description,billable,status,approved_at,approved_by,created_by)
     values($1,$2,$3,$4,$5,$6,current_date-1,240,'Horas sintéticas de configuración',true,'approved',now(),$6,$6)
     on conflict(id) do update set minutes=240,status='approved'`,
    [ids.timeA, ids.tenant, ids.company, ids.projectA, ids.taskA, ids.adminUser]
  );
  await client.query(
    `insert into project_expenses(id,tenant_id,company_id,project_id,task_id,submitted_by,description,
       expense_date,amount,currency,status,created_by)
     values($1,$2,$3,$4,$5,$6,'Movilidad ficticia',current_date-1,45,'PEN','approved',$6)
     on conflict(id) do update set amount=45,status='approved'`,
    [ids.expenseA, ids.tenant, ids.company, ids.projectA, ids.taskA, ids.adminUser]
  );
  await client.query(
    `insert into projects(id,tenant_id,company_id,code,name,description,manager_user_id,currency,
       planned_start,planned_end,actual_start,status,created_by)
     values($1,$2,$3,'DEMO-PRO-C','Mantenimiento de sede demo','Referencia ficticia DEMO-C-001',$4,
       'PEN',current_date-14,current_date+60,current_date-14,'active',$4)
     on conflict(id) do update set name=excluded.name,status='active'`,
    [ids.projectC, ids.tenant, ids.company, ids.adminUser]
  );
  await client.query(
    `insert into employees(id,tenant_id,company_id,employee_code,first_name,last_name,document_type,
       document_number,work_email,phone,hire_date,status,created_by)
     values($1,$2,$3,'DEMO-EMP-001','Alex','Ficticio','DEMO','NO-REAL',
       'alex@trabajador.demo','999000020',current_date-120,'active',$4)
     on conflict(id) do update set first_name='Alex',last_name='Ficticio',status='active'`,
    [ids.employee, ids.tenant, ids.company, ids.adminUser]
  );
  await client.query(
    `insert into employment_contracts(id,tenant_id,company_id,employee_id,contract_type,start_date,end_date,status,created_by)
     values($1,$2,$3,$4,'DEMO-C-001',current_date-120,current_date+245,'active',$5)
     on conflict(id) do update set status='active',end_date=current_date+245`,
    [ids.contract, ids.tenant, ids.company, ids.employee, ids.adminUser]
  );
  await client.query(
    `insert into sst_inspections(id,tenant_id,company_id,branch_id,inspection_type,scheduled_on,performed_on,
       inspector_user_id,status,created_by)
     values($1,$2,$3,$4,'Inspección demostrativa',current_date-3,current_date-3,$5,'completed',$5)
     on conflict(id) do update set status='completed',performed_on=current_date-3`,
    [ids.inspection, ids.tenant, ids.company, ids.branch, ids.adminUser]
  );
  await client.query(
    `insert into sst_inspection_findings(id,tenant_id,company_id,inspection_id,finding_type,description,severity,created_by)
     values($1,$2,$3,$4,'nonconformity','Señalización ficticia pendiente','medium',$5)
     on conflict(id) do update set description=excluded.description,severity='medium'`,
    [ids.finding, ids.tenant, ids.company, ids.inspection, ids.adminUser]
  );
  await client.query(
    `insert into sst_corrective_actions(id,tenant_id,company_id,finding_id,description,owner_user_id,due_date,status,created_by)
     values($1,$2,$3,$4,'Instalar señalética de demostración',$5,current_date+7,'in_progress',$5)
     on conflict(id) do update set status='in_progress',due_date=current_date+7`,
    [ids.correctiveAction, ids.tenant, ids.company, ids.finding, ids.adminUser]
  );
  await client.query(
    `insert into asset_categories(id,tenant_id,company_id,code,name,status,created_by)
     values($1,$2,$3,'DEMO-EQUIPO','Equipos ficticios','active',$4)
     on conflict(id) do update set name=excluded.name,status='active'`,
    [ids.assetCategory, ids.tenant, ids.company, ids.adminUser]
  );
  await client.query(
    `insert into asset_locations(id,tenant_id,company_id,branch_id,code,name,status,created_by)
     values($1,$2,$3,$4,'DEMO-TALLER','Taller demo','active',$5)
     on conflict(id) do update set name=excluded.name,status='active'`,
    [ids.assetLocation, ids.tenant, ids.company, ids.branch, ids.adminUser]
  );
  await client.query(
    `insert into assets(id,tenant_id,company_id,category_id,location_id,code,name,serial_number,model,
       manufacturer,acquired_on,acquisition_cost,currency,criticality,status,created_by)
     values($1,$2,$3,$4,$5,'DEMO-ACT-001','Compresora de demostración','SERIAL-FICTICIO-001',
       'Modelo Demo','Fabricante Ficticio',current_date-300,4500,'PEN','high','maintenance',$6)
     on conflict(id) do update set name=excluded.name,status='maintenance'`,
    [ids.asset, ids.tenant, ids.company, ids.assetCategory, ids.assetLocation, ids.adminUser]
  );
  await client.query(
    `insert into maintenance_plans(id,tenant_id,company_id,asset_id,name,trigger_type,interval_days,status,created_by)
     values($1,$2,$3,$4,'Plan trimestral demo','calendar',90,'active',$5)
     on conflict(id) do update set interval_days=90,status='active'`,
    [ids.maintenancePlan, ids.tenant, ids.company, ids.asset, ids.adminUser]
  );
  await client.query(
    `insert into maintenance_work_orders(id,tenant_id,company_id,asset_id,code,maintenance_type,priority,
       assigned_user_id,scheduled_at,status,created_by)
     values($1,$2,$3,$4,'DEMO-OT-001','preventive','high',$5,now()+interval '1 day','scheduled',$5)
     on conflict(id) do update set status='scheduled',scheduled_at=now()+interval '1 day'`,
    [ids.maintenanceOrder, ids.tenant, ids.company, ids.asset, ids.adminUser]
  );
}

async function seedDemoMetadata(client: PoolClient): Promise<string> {
  const fingerprint = process.env.DEMO_DATABASE_FINGERPRINT;
  if (!fingerprint) throw new Error("DEMO_DATABASE_FINGERPRINT es obligatorio.");
  const manifest = JSON.stringify(demoScenarios);
  const checksum = createHash("sha256").update(manifest).digest("hex");
  await client.query(
    `insert into demo_profiles(id,tenant_id,company_id,code,name,description,reset_enabled,reset_schedule,
       data_disclaimer,environment_fingerprint,status,created_by)
     values($1,$2,$3,'portable-local','ERP Express Perú portable','Perfil local aislado',true,$4,
       'Todos los datos son sintéticos y no deben usarse en producción.',$5,'active',$6)
     on conflict(id) do update set reset_enabled=true,reset_schedule=excluded.reset_schedule,
       data_disclaimer=excluded.data_disclaimer,environment_fingerprint=excluded.environment_fingerprint,status='active'`,
    [ids.profile, ids.tenant, ids.company, process.env.DEMO_RESET_SCHEDULE ?? "0 4 * * *", fingerprint, ids.adminUser]
  );
  for (const [index, scenario] of demoScenarios.entries()) {
    const scenarioId = scenarioIds[index];
    if (!scenarioId) throw new Error("El manifiesto de escenarios no coincide con sus identificadores.");
    await client.query(
      `insert into demo_scenarios(id,tenant_id,company_id,demo_profile_id,code,name,description,seed_manifest,status,created_by)
       values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'active',$9)
       on conflict(id) do update set name=excluded.name,description=excluded.description,
         seed_manifest=excluded.seed_manifest,status='active'`,
      [
        scenarioId, ids.tenant, ids.company, ids.profile, scenario.code, scenario.name,
        scenario.description, JSON.stringify(scenario), ids.adminUser
      ]
    );
  }
  await client.query(
    `insert into demo_snapshots(id,tenant_id,company_id,demo_profile_id,storage_reference,checksum,database_version,created_by)
     values($1,$2,$3,$4,'seed://v0.3.0/demo-scenarios',$5,'phase3-0011',$6)
     on conflict(id) do update set checksum=excluded.checksum,database_version=excluded.database_version`,
    [ids.snapshot, ids.tenant, ids.company, ids.profile, checksum, ids.adminUser]
  );
  return checksum;
}

async function seedAll(client: PoolClient): Promise<void> {
  const databaseName = await observedDatabaseName(client);
  assertDemoSeedAllowed(environment(), databaseName);
  await seedIdentity(client);
  await seedPhase2DemonstrationData(client, {
    tenantId: ids.tenant,
    companyId: ids.company,
    branchId: ids.branch,
    userId: ids.adminUser
  });
  await seedPhase3Scenarios(client);
  await seedDemoMetadata(client);
}

async function loadObservedIdentity(client: PoolClient): Promise<ObservedDemoIdentity> {
  const result = await client.query<ObservedDemoIdentity>(
    `select current_database() as "databaseName",t.id::text as "tenantId",t.code as "tenantCode",
       dp.status as "profileStatus",dp.reset_enabled as "profileResetEnabled",
       dp.environment_fingerprint as "profileFingerprint"
     from demo_profiles dp join tenants t on t.id=dp.tenant_id
     where dp.id=$1 and dp.tenant_id=$2`,
    [ids.profile, process.env.DEMO_TENANT_ID]
  );
  const observed = result.rows[0];
  if (!observed) throw new Error("No existe un perfil demo para el tenant configurado.");
  return observed;
}

async function resetScenarioRows(client: PoolClient): Promise<number> {
  const tableResult = await client.query<{ table_name: string }>(
    `select c.table_name from information_schema.columns c
     join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
     where c.table_schema='public' and c.column_name='tenant_id' and t.table_type='BASE TABLE'
       and c.table_name<>all($1::text[])
     order by c.table_name`,
    [[...resetPreservedTables]]
  );
  await client.query("set local session_replication_role = replica");
  let deleted = 0;
  let failure: unknown;
  try {
    for (const { table_name: tableName } of tableResult.rows) {
      if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
        throw new Error("Nombre de tabla inesperado durante reset.");
      }
      try {
        const result = await client.query(`delete from "${tableName}" where tenant_id=$1`, [ids.tenant]);
        deleted += result.rowCount ?? 0;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "error desconocido";
        throw new Error(`No se pudo limpiar la tabla demo ${tableName}: ${message}`);
      }
    }
  } catch (error: unknown) {
    failure = error;
  }
  if (!failure) {
    await client.query("set local session_replication_role = origin");
  }
  if (failure) {
    throw failure instanceof Error ? failure : new Error("Falló la limpieza del reset demo.");
  }
  return deleted;
}

async function countScenarioRows(client: PoolClient): Promise<number> {
  const tableResult = await client.query<{ table_name: string }>(
    `select c.table_name from information_schema.columns c
     join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
     where c.table_schema='public' and c.column_name='tenant_id' and t.table_type='BASE TABLE'
       and c.table_name<>all($1::text[])
     order by c.table_name`,
    [[...resetPreservedTables]]
  );
  let count = 0;
  for (const { table_name: tableName } of tableResult.rows) {
    if (!/^[a-z][a-z0-9_]*$/.test(tableName)) throw new Error("Nombre de tabla inesperado durante verificación.");
    const result = await client.query<{ count: string }>(
      `select count(*)::text as count from "${tableName}" where tenant_id=$1`,
      [ids.tenant]
    );
    count += Number(result.rows[0]?.count ?? 0);
  }
  return count;
}

async function resetAll(client: PoolClient): Promise<void> {
  await client.query(
    `select set_config('app.tenant_id',$1,true),
       set_config('app.company_id',$2,true)`,
    [ids.tenant, ids.company]
  );
  const observed = await loadObservedIdentity(client);
  assertDemoResetAllowed(environment(), observed);
  const companyScope = await client.query<{ count: string; exact: boolean }>(
    `select count(*)::text count,bool_and(id=$2) exact from companies where tenant_id=$1`,
    [ids.tenant, ids.company]
  );
  if (companyScope.rows[0]?.count !== "1" || companyScope.rows[0]?.exact !== true) {
    throw new Error("El reset demo requiere exactamente una empresa reservada en el tenant.");
  }
  await client.query(
    `select set_config('app.environment',$1,true),
       set_config('app.demo_reset_enabled',$2,true),
       set_config('app.environment_fingerprint',$3,true)`,
    ["demo", "true", observed.profileFingerprint]
  );
  const jobResult = await client.query<{ id: string }>(
    `insert into demo_reset_jobs(tenant_id,company_id,demo_profile_id,snapshot_id,requested_by,
       confirmation_phrase,environment_name,environment_fingerprint,status,started_at,created_by)
     values($1,$2,$3,$4,$5,'RESET DEMO DATA','demo',$6,'running',now(),$5) returning id`,
    [ids.tenant, ids.company, ids.profile, ids.snapshot, ids.adminUser, observed.profileFingerprint]
  );
  const jobId = jobResult.rows[0]?.id;
  if (!jobId) throw new Error("No se pudo registrar el trabajo de reset.");
  const deleted = await resetScenarioRows(client);
  await seedIdentity(client);
  await seedPhase2DemonstrationData(client, {
    tenantId: ids.tenant,
    companyId: ids.company,
    branchId: ids.branch,
    userId: ids.adminUser
  });
  await seedPhase3Scenarios(client);
  const checksum = await seedDemoMetadata(client);
  const inserted = await countScenarioRows(client);
  const integrity = await client.query<{ invalid_count: string }>(
    `select (
       (select count(*) from legal_acceptance_revocations r left join legal_acceptances a
          on (a.id,a.tenant_id,a.company_id)=(r.legal_acceptance_id,r.tenant_id,r.company_id)
          where r.tenant_id=$1 and a.id is null) +
       (select count(*) from legal_acceptances a left join legal_document_versions v
          on (v.id,v.tenant_id,v.company_id)=(a.legal_document_version_id,a.tenant_id,a.company_id)
          where a.tenant_id=$1 and v.id is null) +
       (select count(*) from consent_withdrawals w left join consent_records c
          on (c.id,c.tenant_id,c.company_id)=(w.consent_record_id,w.tenant_id,w.company_id)
          where w.tenant_id=$1 and c.id is null) +
       (select count(*) from consent_records c left join consent_versions v
          on (v.id,v.tenant_id,v.company_id)=(c.consent_version_id,c.tenant_id,c.company_id)
          where c.tenant_id=$1 and v.id is null)
     )::text invalid_count`,
    [ids.tenant]
  );
  if (integrity.rows[0]?.invalid_count !== "0") {
    throw new Error("La verificación referencial posterior al reset demo falló.");
  }
  await client.query(
    `update demo_reset_jobs set status='completed',completed_at=now(),updated_at=now(),version=version+1
     where id=$1`,
    [jobId]
  );
  await client.query(
    `insert into demo_reset_history(tenant_id,company_id,demo_reset_job_id,completed_by,completed_at,
       snapshot_checksum,rows_deleted,rows_inserted,verification_summary,created_by)
     values($1,$2,$3,$4,now(),$5,$6,$7,$8::jsonb,$4)`,
    [
      ids.tenant, ids.company, jobId, ids.adminUser, checksum, deleted, inserted,
      JSON.stringify({ profile: "portable-local", scenarios: demoScenarios.map((item) => item.code), deterministicSeed: true })
    ]
  );
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL es obligatorio.");
  const command = process.argv[2] ?? "seed";
  const database = new PostgresDatabase(connectionString);
  try {
    await database.transaction(async (client) => {
      if (command === "seed") await seedAll(client);
      else if (command === "reset") await resetAll(client);
      else throw new Error(`Comando demo desconocido: ${command}`);
    });
    console.log(JSON.stringify({
      level: "info",
      event: command === "reset" ? "demo.reset.completed" : "demo.seed.completed",
      tenantId: ids.tenant,
      scenarios: demoScenarios.map((scenario) => scenario.code)
    }));
  } catch (error: unknown) {
    if (command === "reset") {
      await database.transaction(async (client) => {
        await client.query(
          `select set_config('app.tenant_id',$1,true),
             set_config('app.company_id',$2,true),
             set_config('app.environment','demo',true),
             set_config('app.demo_reset_enabled','true',true),
             set_config('app.environment_fingerprint',$3,true)`,
          [ids.tenant, ids.company, process.env.DEMO_DATABASE_FINGERPRINT ?? ""]
        );
        await client.query(
          `insert into demo_reset_jobs(
             tenant_id,company_id,demo_profile_id,snapshot_id,requested_by,confirmation_phrase,
             environment_name,environment_fingerprint,status,started_at,completed_at,error_summary,created_by
           ) select $1,$2,$3,$4,$5,'RESET DEMO DATA','demo',$6,'failed',now(),now(),$7,$5
           where exists(select 1 from demo_profiles where id=$3 and tenant_id=$1 and company_id=$2)`,
          [
            ids.tenant, ids.company, ids.profile, ids.snapshot, ids.adminUser,
            process.env.DEMO_DATABASE_FINGERPRINT,
            error instanceof Error ? error.message.slice(0, 1000) : "Error desconocido"
          ]
        );
      }).catch(() => undefined);
    }
    throw error;
  } finally {
    await database.close();
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  main().catch((error: unknown) => {
    console.error(JSON.stringify({
      level: "error",
      event: "demo.command.failed",
      message: error instanceof Error ? error.message : "Error desconocido"
    }));
    process.exitCode = 1;
  });
}
