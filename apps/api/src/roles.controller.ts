/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";

@ApiTags("roles")
@Controller("roles")
export class RolesController {
  constructor(private readonly database: DatabaseService) {}
  @Get()
  @RequirePermissions("roles.read")
  list(@Req() request: ApiRequest) {
    return this.database.query(
      `select r.id,r.code,r.name,r.description,r.is_system as "isSystem",
       coalesce(array_agg(p.code) filter(where p.code is not null),'{}') permissions
       from roles r left join role_permissions rp on rp.role_id=r.id
       left join permissions p on p.id=rp.permission_id
       where r.tenant_id=$1 and (r.company_id=$2 or r.company_id is null)
       group by r.id order by r.is_system desc,r.name`,
      [request.auth!.tenantId, request.auth!.companyId]
    );
  }
  @Post()
  @RequirePermissions("roles.manage")
  async create(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      code: z.string().regex(/^[a-z][a-z0-9-]{2,39}$/),
      name: z.string().min(2).max(120), description: z.string().max(500).optional(),
      permissionCodes: z.array(z.string()).max(100)
    }).parse(body);
    const id = randomUUID();
    await this.database.transaction(async (client) => {
      await client.query(
        `insert into roles(id,tenant_id,company_id,code,name,description,created_by)
         values($1,$2,$3,$4,$5,$6,$7)`,
        [id, request.auth!.tenantId, request.auth!.companyId, input.code, input.name, input.description, request.auth!.userId]
      );
      await client.query(
        `insert into role_permissions(role_id,permission_id)
         select $1,id from permissions where code=any($2::text[])`,
        [id, input.permissionCodes]
      );
      await client.query(
        `insert into audit_events(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,new_values,request_id)
         values($1,$2,$3,'role.created','role',$4,jsonb_build_object('code',$5::text),$6)`,
        [request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, id, input.code, request.requestId]
      );
    });
    return { id, ...input };
  }
}
