/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { hashPassword } from "@erp/security";
import { AuthService } from "./auth.service.js";
import { PublicRoute } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { config } from "./config.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @PublicRoute()
  @Post("login")
  async login(@Body() body: unknown, @Req() request: ApiRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const input = z.object({ email: z.email(), password: z.string().min(1).max(200) }).parse(body);
    const result = await this.auth.login(input.email, input.password, request);
    reply.setCookie("erp_session", result.token, {
      httpOnly: true, sameSite: "lax", secure: config.COOKIE_SECURE,
      path: "/", maxAge: config.SESSION_TTL
    });
    return { user: result.user };
  }

  @Post("logout")
  async logout(@Req() request: ApiRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(request.cookies.erp_session, request.requestId);
    reply.clearCookie("erp_session", { path: "/" });
    return { success: true };
  }

  @PublicRoute()
  @Post("password-reset/request")
  requestReset(@Body() body: unknown) {
    const input = z.object({ email: z.email() }).parse(body);
    return this.auth.requestPasswordReset(input.email);
  }

  @PublicRoute()
  @Post("password-reset/confirm")
  async reset(@Body() body: unknown) {
    const input = z.object({ token: z.string().min(20), password: z.string().min(12).max(200) }).parse(body);
    await this.auth.resetPassword(input.token, await hashPassword(input.password));
    return { success: true };
  }

  @Get("sessions")
  sessions(@Req() request: ApiRequest) {
    return this.auth.listSessions(request.auth!.userId);
  }

  @Post("change-password")
  async changePassword(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      currentPassword: z.string().min(1).max(200),
      password: z.string().min(12).max(200)
    }).parse(body);
    await this.auth.changePassword(
      request.auth!.userId, input.currentPassword, input.password, request.auth!.sessionId
    );
    return { success: true };
  }
}
