/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "./auth.guard.js";
import { DashboardService } from "./dashboard.service.js";
import type { ApiRequest } from "./http.js";
import { OwnedByModule } from "./module-ownership.js";

@ApiTags("dashboard")
@OwnedByModule("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get()
  @RequirePermissions("dashboard.read")
  get(@Req() request: ApiRequest) { return this.dashboard.get(request); }
}
