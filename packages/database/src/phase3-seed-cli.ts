import { PostgresDatabase } from "./index.js";
import { moduleRegistry } from "@erp/domain";
import { randomUUID } from "node:crypto";
import { phase3PermissionCodes, seedPhase3Foundation } from "./phase3-seed.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL es obligatorio.");
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PHASE3_FOUNDATION_SEED !== "true") {
  throw new Error("La semilla de configuración Fase 3 requiere autorización explícita en producción.");
}

const database = new PostgresDatabase(connectionString);
try {
  const contexts = await database.query<{
    tenant_id: string; company_id: string; branch_id: string; user_id: string;
  }>(
    `select c.tenant_id,c.id company_id,
       coalesce(
         (select b.id from branches b where b.company_id=c.id and b.is_default order by b.created_at limit 1),
         (select b.id from branches b where b.company_id=c.id order by b.created_at limit 1)
       ) branch_id,
       coalesce(
         (select uc.user_id from user_companies uc where uc.company_id=c.id and uc.is_default order by uc.created_at limit 1),
         (select uc.user_id from user_companies uc where uc.company_id=c.id order by uc.created_at limit 1)
       ) user_id
     from companies c where c.status='active'`
  );
  let seeded = 0;
  for (const context of contexts) {
    if (!context.branch_id || !context.user_id) continue;
    await database.transaction((client) => seedPhase3Foundation(client, {
      tenantId: context.tenant_id,
      companyId: context.company_id,
      branchId: context.branch_id,
      userId: context.user_id
    }).then(async () => {
      for (const code of phase3PermissionCodes) {
        await client.query(
          `insert into permissions(id,code,name,description)
           values($1,$2,$2,$2) on conflict(code) do nothing`,
          [randomUUID(), code]
        );
      }
      await client.query(
        `insert into role_permissions(role_id,permission_id)
         select r.id,p.id
         from roles r cross join permissions p
         where r.tenant_id=$1 and r.company_id=$2 and r.code='company-admin'
           and p.code=any($3::text[])
         on conflict do nothing`,
        [context.tenant_id, context.company_id, [...phase3PermissionCodes]]
      );
      for (const module of moduleRegistry) {
        await client.query(
          `insert into modules(id,code,name,description,version,dependencies,required_permissions,
             default_enabled,implemented)
           values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
           on conflict(code) do update set name=excluded.name,description=excluded.description,
             version=excluded.version,dependencies=excluded.dependencies,
             required_permissions=excluded.required_permissions,
             default_enabled=excluded.default_enabled,implemented=excluded.implemented`,
          [
            randomUUID(), module.code, module.name, module.description, module.version,
            JSON.stringify(module.dependencies), JSON.stringify(module.requiredPermissions),
            module.defaultEnabled, module.implemented
          ]
        );
        if (module.defaultEnabled) {
          await client.query(
            `insert into company_modules(tenant_id,company_id,module_id,status,enabled_at,enabled_by)
             select $1,$2,id,'enabled',now(),$3 from modules where code=$4
             on conflict(company_id,module_id) do nothing`,
            [context.tenant_id, context.company_id, context.user_id, module.code]
          );
        }
      }
    }));
    seeded += 1;
  }
  console.log(`Configuración base Fase 3 aplicada a ${seeded} empresa(s).`);
} finally {
  await database.close();
}
