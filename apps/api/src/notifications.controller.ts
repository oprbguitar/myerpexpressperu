import { Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly database: DatabaseService) {}
  @Get()
  @RequirePermissions("dashboard.read")
  list(@Req() request: ApiRequest) {
    return this.database.query(
      `select id,notification_type as "type",title,message,entity_type as "entityType",
       entity_id as "entityId",read_at as "readAt",created_at as "createdAt"
       from notifications where tenant_id=$1 and company_id=$2
         and (user_id is null or user_id=$3) order by created_at desc limit 100`,
      [request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
    );
  }
  @Post(":id/read")
  @RequirePermissions("dashboard.read")
  async read(@Req() request: ApiRequest, @Param("id") id: string) {
    await this.database.query(
      `update notifications set read_at=now() where id=$1 and tenant_id=$2 and company_id=$3
       and (user_id is null or user_id=$4)`,
      [z.uuid().parse(id), request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
    );
    return { success: true };
  }
}
