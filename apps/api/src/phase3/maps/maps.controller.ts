/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Post, Req } from "@nestjs/common";
import { RequireModule, RequirePermissions } from "../../auth.guard.js";
import type { ApiRequest } from "../../http.js";
import { geocodeSchema } from "./maps.schemas.js";
import { MapsService } from "./maps.service.js";
import { OwnedByModule } from "../../module-ownership.js";

@OwnedByModule("maps")
@Controller("maps")
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  @Post("geocode")
  @RequirePermissions("maps.read")
  @RequireModule("maps")
  async geocode(@Body() body: unknown, @Req() request: ApiRequest): Promise<unknown> {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.maps.geocode(geocodeSchema.parse(body), request.auth, request.requestId);
  }
}
