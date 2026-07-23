import { Body, Controller, Post, Req } from "@nestjs/common";
import { RequireModule, RequirePermissions } from "../../auth.guard.js";
import type { ApiRequest } from "../../http.js";
import { geocodeSchema } from "./maps.schemas.js";
import { MapsService } from "./maps.service.js";

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
