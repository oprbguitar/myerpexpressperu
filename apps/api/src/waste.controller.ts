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
import { WASTE_LIFECYCLE_PHASES } from "@erp/domain";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { OwnedByModule } from "./module-ownership.js";
import { requireIdempotencyKey } from "./operations.js";
import { WasteService } from "./waste.service.js";

const phase = z.enum(WASTE_LIFECYCLE_PHASES);
const generation = z.object({
  source: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  quantity: z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/),
  unit: z.string().min(1).max(30),
  hazardous: z.boolean(),
  generatedAt: z.iso.datetime({ offset: true })
});

@ApiTags("waste-management")
@OwnedByModule("waste-management")
@Controller("waste")
export class WasteController {
  constructor(private readonly waste: WasteService) {}

  @Get("overview")
  @RequirePermissions("waste.read")
  overview(@Req() request: ApiRequest) {
    return this.waste.overview(request);
  }

  @Get("records")
  @RequirePermissions("waste.read")
  records(@Req() request: ApiRequest, @Query() query: unknown) {
    return this.waste.records(request, z.object({
      phase: phase.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50)
    }).parse(query));
  }

  @Get("records/:id")
  @RequirePermissions("waste.read")
  detail(@Req() request: ApiRequest, @Param("id") id: unknown) {
    return this.waste.detail(request, z.uuid().parse(id));
  }

  @Post("records")
  @RequirePermissions("waste.create")
  create(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.waste.create(request, generation.parse(body), requireIdempotencyKey(request));
  }

  @Post("records/:id/advance")
  @RequirePermissions("waste.transition")
  advance(@Req() request: ApiRequest, @Param("id") id: unknown, @Body() body: unknown) {
    const input = z.object({
      targetPhase: phase,
      version: z.number().int().positive(),
      notes: z.string().max(1000).optional()
    }).parse(body);
    return this.waste.advance(request, z.uuid().parse(id), input, requireIdempotencyKey(request));
  }

  @Post("records/:id/exceptions")
  @RequirePermissions("waste.exceptions.manage")
  exception(@Req() request: ApiRequest, @Param("id") id: unknown, @Body() body: unknown) {
    const input = z.object({
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      exceptionType: z.enum([
        "INCORRECT_SEGREGATION",
        "MIXED_WASTE",
        "CONTAINER_OVERFLOW",
        "DAMAGED_CONTAINER",
        "MISSING_LABEL",
        "MISSING_DESTINATION_EVIDENCE",
        "QUANTITY_DIFFERENCE",
        "EXPIRED_AUTHORIZATION",
        "OVERDUE_CORRECTIVE_ACTION",
        "MISSING_SUBMISSION_DOCUMENTATION",
        "BLOCKED_WORKFLOW",
        "OTHER"
      ]),
      description: z.string().min(3).max(1000),
      immediateAction: z.string().max(1000).optional(),
      correctiveAction: z.string().max(1000).optional(),
      dueDate: z.iso.date().optional()
    }).parse(body);
    return this.waste.createException(
      request,
      z.uuid().parse(id),
      input,
      requireIdempotencyKey(request)
    );
  }
}
