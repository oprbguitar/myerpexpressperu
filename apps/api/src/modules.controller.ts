import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { ModulesService } from "./modules.service.js";

@ApiTags("modules")
@Controller("modules")
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}
  @Get()
  @RequirePermissions("modules.read")
  list(@Req() request: ApiRequest) { return this.modules.list(request); }
  @Post(":code/enable")
  @RequirePermissions("modules.manage")
  enable(@Req() request: ApiRequest, @Param("code") code: string) {
    return this.modules.enable(request, z.string().regex(/^[a-z][a-z0-9-]*$/).parse(code));
  }
  @Get(":code/disable-impact")
  @RequirePermissions("modules.manage")
  disableImpact(@Req() request: ApiRequest, @Param("code") code: string) {
    return this.modules.disableImpact(request, z.string().regex(/^[a-z][a-z0-9-]*$/).parse(code));
  }
  @Post(":code/disable")
  @RequirePermissions("modules.manage")
  disable(@Req() request: ApiRequest, @Param("code") code: string, @Body() body: unknown) {
    const input = z.object({ reason: z.string().trim().min(5).max(500) }).parse(body);
    return this.modules.disable(
      request,
      z.string().regex(/^[a-z][a-z0-9-]*$/).parse(code),
      input.reason
    );
  }
}
