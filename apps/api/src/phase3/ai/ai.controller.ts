/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { ApiRequest } from "../../http.js";
import { RequireModule, RequirePermissions } from "../../auth.guard.js";
import { aiFeedbackSchema, aiQuerySchema } from "./ai.schemas.js";
import { AiAssistanceService } from "./ai.service.js";

@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiAssistanceService) {}

  @Post("query")
  @RequirePermissions("ai.use")
  @RequireModule("artificial-intelligence")
  async query(@Body() body: unknown, @Req() request: ApiRequest): Promise<unknown> {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.ai.query(aiQuerySchema.parse(body), request.auth, request.requestId);
  }

  @Post("documents")
  @RequirePermissions("ai.documents.use")
  @RequireModule("artificial-intelligence")
  async documents(@Body() body: unknown, @Req() request: ApiRequest): Promise<unknown> {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.ai.query(aiQuerySchema.parse(body), request.auth, request.requestId);
  }

  @Post("feedback")
  @RequirePermissions("ai.feedback.submit")
  @RequireModule("artificial-intelligence")
  feedback(@Body() body: unknown, @Req() request: ApiRequest): { readonly accepted: true } {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    this.ai.recordFeedback(aiFeedbackSchema.parse(body), request.auth);
    return { accepted: true };
  }

  @Get("usage")
  @RequirePermissions("ai.audit.read")
  @RequireModule("artificial-intelligence")
  usage(@Req() request: ApiRequest): unknown {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.ai.usageSummary(request.auth);
  }

  @Get("incidents")
  @RequirePermissions("ai.audit.read")
  @RequireModule("artificial-intelligence")
  incidents(): { readonly incidents: readonly unknown[]; readonly contentLogged: false } {
    return { incidents: [], contentLogged: false };
  }
}
