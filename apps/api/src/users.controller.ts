import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get()
  @RequirePermissions("users.read")
  list(@Req() request: ApiRequest, @Query() query: unknown) {
    const input = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25)
    }).parse(query);
    return this.users.list(request, input.page, input.pageSize);
  }
  @Post()
  @RequirePermissions("users.create")
  create(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      email: z.email(), fullName: z.string().min(2).max(160),
      roleIds: z.array(z.uuid()).max(10).default([])
    }).parse(body);
    return this.users.create(request, input);
  }
  @Post(":id/deactivate")
  @RequirePermissions("users.deactivate")
  deactivate(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.users.deactivate(request, z.uuid().parse(id));
  }
}
