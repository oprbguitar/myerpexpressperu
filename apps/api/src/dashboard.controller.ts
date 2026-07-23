import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "./auth.guard.js";
import { DashboardService } from "./dashboard.service.js";
import type { ApiRequest } from "./http.js";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get()
  @RequirePermissions("dashboard.read")
  get(@Req() request: ApiRequest) { return this.dashboard.get(request); }
}
