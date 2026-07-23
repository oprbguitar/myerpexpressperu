import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PublicRoute } from "./auth.guard.js";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";

@ApiTags("system")
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
