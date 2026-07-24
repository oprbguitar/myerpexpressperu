/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { requireIdempotencyKey } from "./operations.js";
import { SunatService } from "./sunat.service.js";
import { OwnedByModule } from "./module-ownership.js";

const documentStatus = z.enum([
  "ISSUED", "PENDING_SUBMISSION", "ACCEPTED", "ACCEPTED_WITH_OBSERVATIONS",
  "REJECTED", "VOID_PENDING", "VOIDED", "FAILED", "CANCELLED_INTERNAL"
]);

@ApiTags("sunat")
@OwnedByModule("sunat-basic")
@Controller("sunat")
export class SunatController {
  constructor(private readonly sunat: SunatService) {}
  @Get("configuration")
  @RequirePermissions("sunat.read")
  configuration() { return this.sunat.configuration(); }
  @Get("documents")
  @RequirePermissions("commercial-documents.read")
  documents(@Req() request: ApiRequest, @Query() query: unknown) {
    return this.sunat.documents(request, z.object({
      status: documentStatus.optional(), limit: z.coerce.number().int().min(1).max(100).default(50)
    }).parse(query));
  }
  @Get("submission-history/:id")
  @RequirePermissions("sunat.read")
  history(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.sunat.history(request, z.uuid().parse(id));
  }
  @Post("documents/:id/attachments")
  @RequirePermissions("sunat.manual-update")
  attach(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({ type: z.enum(["XML", "PDF", "CDR"]), documentId: z.uuid() }).parse(body);
    return this.sunat.attach(request, z.uuid().parse(id), input);
  }
  @Post("documents/:id/status")
  @RequirePermissions("sunat.manual-update")
  status(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({
      status: documentStatus, comment: z.string().max(1000).optional(),
      responseCode: z.string().max(60).optional(), responseMessage: z.string().max(1000).optional(),
      externalReference: z.string().max(200).optional(), submittedAt: z.iso.datetime().optional()
    }).parse(body);
    return this.sunat.manualTransition(request, z.uuid().parse(id), input);
  }
  @Post("documents/:id/mock-submit")
  @RequirePermissions("sunat.manual-update")
  mock(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({
      scenario: z.enum(["ACCEPT", "ACCEPT_WITH_OBSERVATIONS", "REJECT", "TIMEOUT", "TEMPORARY_FAILURE"])
    }).parse(body);
    return this.sunat.submitMock(request, z.uuid().parse(id), input.scenario, requireIdempotencyKey(request));
  }
}
