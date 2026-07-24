/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { randomUUID } from "node:crypto";
import { moduleRegistry } from "@erp/domain";
import { hashPassword } from "@erp/security";
import { PostgresDatabase } from "./index.js";
import { seedPhase2DemonstrationData } from "./phase2-seed.js";
import { seedPhase3Foundation } from "./phase3-seed.js";

const required = ["SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD"] as const;
for (const key of required) if (!process.env[key]) throw new Error(`${key} es obligatorio para crear la semilla.`);
// La semilla provisiona datos de varios tenants, por lo que corre con el rol de
// migración (propietario), no con el rol de aplicación sujeto a RLS.
const seedConnection = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!seedConnection) throw new Error("DATABASE_MIGRATION_URL o DATABASE_URL es obligatorio para crear la semilla.");

const database = new PostgresDatabase(seedConnection);
const tenantId = "00000000-0000-4000-8000-000000000001";
const companyId = "00000000-0000-4000-8000-000000000002";
const branchId = "00000000-0000-4000-8000-000000000003";
const userId = "00000000-0000-4000-8000-000000000004";
const roleId = "00000000-0000-4000-8000-000000000005";

const permissionCodes = [
  "organization.read", "organization.manage", "branches.read", "branches.manage",
  "users.read", "users.create", "users.update", "users.deactivate", "roles.read",
  "roles.manage", "permissions.read", "modules.read", "modules.manage", "audit.read",
  "settings.read", "settings.manage", "documents.read", "documents.upload", "documents.delete",
  "parties.read", "parties.create", "parties.update", "parties.deactivate", "parties.export",
  "customer.credit.manage", "supplier.manage",
  "products.read", "products.create", "products.update", "products.deactivate", "products.import",
  "products.export", "pricing.read", "pricing.manage",
  "warehouses.read", "warehouses.manage", "inventory.read", "inventory.receive", "inventory.issue",
  "inventory.transfer", "inventory.adjust", "inventory.adjust.backdate", "inventory.allow-negative",
  "inventory.export",
  "quotations.read", "quotations.create", "quotations.update", "quotations.send", "quotations.accept",
  "quotations.cancel", "sales-orders.read", "sales-orders.create", "sales-orders.confirm",
  "sales-orders.cancel", "sales.read", "sales.create", "sales.confirm", "sales.cancel",
  "sales.discount.override", "sales.price.override", "sales.export",
  "commercial-documents.read", "commercial-documents.issue", "commercial-documents.cancel",
  "commercial-documents.export", "sunat.read", "sunat.manual-update", "sunat.upload-xml",
  "sunat.upload-cdr", "sunat.mark-accepted", "sunat.mark-rejected", "sunat.mark-voided",
  "purchases.read", "purchases.create", "purchases.confirm", "purchases.cancel", "purchases.export",
  "expenses.read", "expenses.create", "expenses.register", "expenses.cancel", "expenses.export",
  "supplier-document.duplicate-override",
  "receivables.read", "receivables.manage", "payables.read", "payables.manage", "payments.read",
  "payments.create", "payments.reverse", "cash.read", "cash.open", "cash.close", "cash.adjust",
  "cash.reopen", "cash.export", "imports.read", "imports.execute", "exports.execute",
  "dashboard.read", "dashboard.financial", "dashboard.sales", "dashboard.inventory",
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
];
const defaultRoles = [
  {
    id: roleId, code: "company-admin", name: "Administrador de empresa", companyScoped: true,
    permissions: permissionCodes
  },
  {
    id: "00000000-0000-4000-8000-000000000006", code: "platform-super-admin",
    name: "Superadministrador de plataforma", companyScoped: false, permissions: [] as string[]
  },
  {
    id: "00000000-0000-4000-8000-000000000007", code: "supervisor", name: "Supervisor",
    companyScoped: true,
    permissions: permissionCodes.filter((code) =>
      !["roles.manage", "modules.manage", "inventory.allow-negative", "cash.reopen"].includes(code)
    )
  },
  {
    id: "00000000-0000-4000-8000-000000000008", code: "operator", name: "Operador",
    companyScoped: true,
    permissions: [
      "organization.read", "branches.read", "users.read", "roles.read", "permissions.read",
      "modules.read", "settings.read", "documents.read", "documents.upload", "parties.read",
      "parties.create", "products.read", "quotations.read", "quotations.create", "sales-orders.read",
      "sales.read", "sales.create", "purchases.read", "purchases.create", "expenses.read",
      "expenses.create", "receivables.read", "payables.read", "payments.read", "cash.read",
      "dashboard.read"
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000009", code: "read-only", name: "Usuario de solo lectura",
    companyScoped: true,
    permissions: permissionCodes.filter((code) => code.endsWith(".read"))
  },
  {
    id: "00000000-0000-4000-8000-000000000010", code: "auditor", name: "Auditor",
    companyScoped: true,
    permissions: ["organization.read", "branches.read", "users.read", "roles.read", "permissions.read",
      "modules.read", "audit.read", "settings.read", "documents.read"]
  }
] as const;

try {
  const passwordHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD!);
  await database.transaction(async (client) => {
    await client.query(
      `insert into tenants(id, code, name) values($1,'demo','Espacio de desarrollo')
       on conflict(id) do update set name=excluded.name`,
      [tenantId]
    );
    await client.query(
      `insert into companies(id, tenant_id, legal_name, commercial_name, ruc, fiscal_address, ubigeo,
         email, phone, main_currency, time_zone, classification, economic_activity_code)
       values($1,$2,'Comercial Andina S.A.C.','Comercial Andina','20123456789',
         'Av. Javier Prado Este 1234, San Isidro, Lima','150131','contacto@comercialandina.com',
         '016123456','PEN','America/Lima','private_company','4669')
       on conflict(id) do update set legal_name=excluded.legal_name`,
      [companyId, tenantId]
    );
    await client.query(
      `insert into branches(id, tenant_id, company_id, code, name, address, ubigeo, is_default)
       values($1,$2,$3,'PRINCIPAL','Sede principal','Av. Javier Prado Este 1234','150131',true)
       on conflict(id) do nothing`,
      [branchId, tenantId, companyId]
    );
    await client.query(
      `insert into users(id, tenant_id, email, password_hash, force_password_change, status)
       values($1,$2,$3,$4,true,'active')
       on conflict(tenant_id, normalized_email) do update set password_hash=excluded.password_hash,
         force_password_change=true,status='active',failed_login_count=0,blocked_until=null`,
      [userId, tenantId, process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase(), passwordHash]
    );
    await client.query("update sessions set revoked_at=now() where user_id=$1 and revoked_at is null", [userId]);
    await client.query(
      `insert into user_profiles(user_id, full_name) values($1,'Administrador de desarrollo')
       on conflict(user_id) do update set full_name=excluded.full_name`,
      [userId]
    );
    await client.query(
      `insert into user_companies(user_id, tenant_id, company_id, is_default)
       values($1,$2,$3,true) on conflict do nothing`,
      [userId, tenantId, companyId]
    );
    await client.query(
      `insert into user_branches(user_id, tenant_id, company_id, branch_id, is_default)
       values($1,$2,$3,$4,true) on conflict do nothing`,
      [userId, tenantId, companyId, branchId]
    );
    for (const code of permissionCodes) {
      await client.query(
        `insert into permissions(id, code, name, description)
         values($1,$2,$3,$3) on conflict(code) do nothing`,
        [randomUUID(), code, code]
      );
    }
    for (const role of defaultRoles) {
      await client.query(
        `insert into roles(id,tenant_id,company_id,code,name,is_system)
         values($1,$2,$3,$4,$5,true)
         on conflict(id) do update set name=excluded.name,status='active'`,
        [role.id, tenantId, role.companyScoped ? companyId : null, role.code, role.name]
      );
      await client.query("delete from role_permissions where role_id=$1", [role.id]);
      if (role.permissions.length > 0) {
        await client.query(
          `insert into role_permissions(role_id,permission_id)
           select $1,id from permissions where code=any($2::text[]) on conflict do nothing`,
          [role.id, [...role.permissions]]
        );
      }
    }
    await client.query(
      `insert into user_roles(user_id, tenant_id, company_id, role_id)
       values($1,$2,$3,$4) on conflict do nothing`,
      [userId, tenantId, companyId, roleId]
    );
    for (const module of moduleRegistry) {
      await client.query(
        `insert into modules(id, code, name, description, version, dependencies, required_permissions,
           default_enabled, implemented)
         values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
         on conflict(code) do update set name=excluded.name, description=excluded.description,
          dependencies=excluded.dependencies, required_permissions=excluded.required_permissions,
          default_enabled=excluded.default_enabled, implemented=excluded.implemented`,
        [
          randomUUID(), module.code, module.name, module.description, module.version,
          JSON.stringify(module.dependencies), JSON.stringify(module.requiredPermissions),
          module.defaultEnabled, module.implemented
        ]
      );
      if (module.defaultEnabled) {
        await client.query(
          `insert into company_modules(tenant_id, company_id, module_id, status, enabled_at, enabled_by)
           select $1,$2,id,'enabled',now(),$3 from modules where code=$4
           on conflict(company_id,module_id) do nothing`,
          [tenantId, companyId, userId, module.code]
        );
      }
    }
    if (process.env.NODE_ENV !== "production") {
      await seedPhase2DemonstrationData(client, { tenantId, companyId, branchId, userId });
      await seedPhase3Foundation(client, { tenantId, companyId, branchId, userId });
    }
  });
  console.log(`Semilla creada para ${process.env.SEED_ADMIN_EMAIL}. La contraseña no se imprime.`);
} finally {
  await database.close();
}
