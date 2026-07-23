import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { validateModuleEnablement } from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import { appendAudit } from "./operations.js";

@Injectable()
export class ModulesService {
  constructor(private readonly database: DatabaseService) {}
  list(request: ApiRequest) {
    return this.database.query(
      `select m.code,m.name,m.description,m.version,m.dependencies,m.required_permissions as "requiredPermissions",
        m.implemented,coalesce(cm.status,'disabled') status,cm.enabled_at as "enabledAt"
       from modules m left join company_modules cm on cm.module_id=m.id and cm.company_id=$2
       where $1=$1 order by m.implemented desc,m.name`,
      [request.auth!.tenantId, request.auth!.companyId]
    );
  }
  async enable(request: ApiRequest, code: string): Promise<{ success: true }> {
    const enabledRows = await this.database.query<{ code: string }>(
      `select m.code from company_modules cm join modules m on m.id=cm.module_id
       where cm.company_id=$1 and cm.status='enabled'`,
      [request.auth!.companyId]
    );
    validateModuleEnablement(code, new Set(enabledRows.map((row) => row.code)));
    await this.database.transaction(async (client) => {
      await client.query(
        `insert into company_modules(tenant_id,company_id,module_id,status,enabled_at,enabled_by)
         select $1,$2,id,'enabled',now(),$3 from modules where code=$4
         on conflict(company_id,module_id) do update set status='enabled',enabled_at=now(),enabled_by=$3,
           disabled_at=null,disabled_by=null,version=company_modules.version+1`,
        [request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, code]
      );
      await client.query(
        `insert into audit_events(tenant_id,company_id,actor_user_id,action,entity_type,new_values,request_id)
         values($1,$2,$3,'module.enabled','module',jsonb_build_object('code',$4::text),$5)`,
        [request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, code, request.requestId]
      );
    });
    return { success: true };
  }

  async disableImpact(request: ApiRequest, code: string) {
    const [module] = await this.database.query<{
      id: string; code: string; name: string; status: string; enabledDependents: string[];
    }>(
      `select m.id,m.code,m.name,coalesce(cm.status,'disabled') status,
        coalesce(array_agg(dm.code order by dm.code) filter(where dcm.status='enabled'),'{}') "enabledDependents"
       from modules m
       left join company_modules cm on cm.module_id=m.id and cm.company_id=$2
       left join modules dm on dm.dependencies ? m.code
       left join company_modules dcm on dcm.module_id=dm.id and dcm.company_id=$2
       where m.code=$1 group by m.id,m.code,m.name,cm.status`,
      [code, request.auth!.companyId]
    );
    if (!module) throw new NotFoundException("El módulo no existe.");
    return {
      code: module.code,
      name: module.name,
      status: module.status,
      enabledDependents: module.enabledDependents,
      consequences: [
        "Se oculta la navegación y los widgets del módulo.",
        "La API y los jobs protegidos rechazan nuevas operaciones.",
        "No se realizan llamadas a proveedores del módulo.",
        "Los datos históricos y la auditoría se conservan."
      ],
      canDisable: module.enabledDependents.length === 0
    };
  }

  async disable(request: ApiRequest, code: string, reason: string): Promise<{ success: true }> {
    const impact = await this.disableImpact(request, code);
    if (impact.enabledDependents.length > 0) {
      throw new ConflictException(`Deshabilite primero: ${impact.enabledDependents.join(", ")}.`);
    }
    await this.database.scopedTransaction(request.auth!, async (client) => {
      const result = await client.query(
        `update company_modules cm set status='disabled',disabled_at=now(),disabled_by=$3,
           enabled_at=null,enabled_by=null,version=cm.version+1
         from modules m where cm.module_id=m.id and cm.tenant_id=$1 and cm.company_id=$2
           and m.code=$4 and cm.status='enabled' returning cm.id`,
        [request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, code]
      );
      if (!result.rows[0]) throw new ConflictException("El módulo ya está deshabilitado.");
      await appendAudit(client, request, {
        action: "module.disabled", entityType: "module",
        newValues: { code, reason, historicalDataPreserved: true }
      });
    });
    return { success: true };
  }
}
