import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { RequireModule, RequirePermissions } from "../../auth.guard.js";
import { ProviderManagementService } from "./provider-management.service.js";
import type { ApiRequest } from "../../http.js";

const providerIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const activationSchema = z.object({ productionConfirmation: z.boolean().default(false) }).strict();

@Controller("admin/providers")
export class ProviderManagementController {
  constructor(private readonly providers: ProviderManagementService) {}

  @Get()
  @RequirePermissions("admin.providers.read")
  @RequireModule("provider-management")
  list(@Req() request: ApiRequest): { readonly providers: ReturnType<ProviderManagementService["list"]> } {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return { providers: this.providers.list(request.auth) };
  }

  @Post(":providerId/test")
  @RequirePermissions("admin.providers.manage")
  @RequireModule("provider-management")
  async test(@Param("providerId") providerId: string, @Req() request: ApiRequest): Promise<unknown> {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.providers.testConnection(providerIdSchema.parse(providerId), request.auth);
  }

  @Post(":providerId/activate")
  @RequirePermissions("admin.providers.activate")
  @RequireModule("provider-management")
  activate(@Param("providerId") providerId: string, @Body() body: unknown, @Req() request: ApiRequest): unknown {
    const input = activationSchema.parse(body);
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.providers.activate(providerIdSchema.parse(providerId), {
      appEnvironment: process.env.APP_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
      productionConfirmation: input.productionConfirmation,
      tenantId: request.auth.tenantId,
      companyId: request.auth.companyId
    });
  }

  @Post(":providerId/deactivate")
  @RequirePermissions("admin.providers.activate")
  @RequireModule("provider-management")
  deactivate(@Param("providerId") providerId: string, @Req() request: ApiRequest): unknown {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.providers.deactivate(providerIdSchema.parse(providerId), request.auth);
  }

  @Get(":providerId/export")
  @RequirePermissions("admin.providers.read")
  @RequireModule("provider-management")
  exportConfiguration(@Param("providerId") providerId: string, @Req() request: ApiRequest): Readonly<Record<string, unknown>> {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.providers.exportNonSecretConfiguration(providerIdSchema.parse(providerId), request.auth);
  }
}
