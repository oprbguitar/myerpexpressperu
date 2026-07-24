/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PublicRoute } from "./auth.guard.js";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import { CoreEndpoint } from "./module-ownership.js";

@ApiTags("system")
@CoreEndpoint()
@Controller()
export class AppController {
  constructor(private readonly database: DatabaseService) {}
  @PublicRoute()
  @Get("health")
  health() { return { status: "ok", service: "erp-api", timestamp: new Date().toISOString() }; }
  @PublicRoute()
  @Get("health/readiness")
  async readiness() {
    await this.database.query("select 1");
    return { status: "ready", database: "available" };
  }
  @Get("me")
  me(@Req() request: ApiRequest) {
    return {
      userId: request.auth!.userId, tenantId: request.auth!.tenantId,
      companyId: request.auth!.companyId, branchIds: request.auth!.branchIds,
      permissions: [...request.auth!.permissions],
      forcePasswordChange: request.auth!.forcePasswordChange
    };
  }
}
