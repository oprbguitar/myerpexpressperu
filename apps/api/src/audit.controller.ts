import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";

@ApiTags("audit")
@Controller("audit")
export class AuditController {
  constructor(private readonly database: DatabaseService) {}
  @Get()
  @RequirePermissions("audit.read")
  async list(@Req() request: ApiRequest, @Query() query: unknown) {
    const input = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      action: z.string().max(100).optional()
    }).parse(query);
    const offset = (input.page - 1) * input.pageSize;
    const params: unknown[] = [request.auth!.tenantId, request.auth!.companyId, input.pageSize, offset];
    const actionFilter = input.action ? "and action=$5" : "";
    if (input.action) params.push(input.action);
    const [rows, countRows] = await Promise.all([
      this.database.query(
        `select id,action,entity_type as "entityType",entity_id as "entityId",actor_user_id as "actorUserId",
          request_id as "requestId",occurred_at as "occurredAt" from audit_events
         where tenant_id=$1 and company_id=$2 ${actionFilter} order by occurred_at desc limit $3 offset $4`,
        params
      ),
      this.database.query<{ total: string }>(
        `select count(*)::text total from audit_events where tenant_id=$1 and company_id=$2 ${actionFilter}`,
        input.action ? [request.auth!.tenantId, request.auth!.companyId, undefined, undefined, input.action] : [request.auth!.tenantId, request.auth!.companyId]
      )
    ]);
    return { data: rows, meta: { page: input.page, pageSize: input.pageSize, total: Number(countRows[0]?.total ?? 0) } };
  }
}
