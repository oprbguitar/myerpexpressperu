/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { RequireModule, RequirePermissions } from "../../auth.guard.js";
import type { ApiRequest } from "../../http.js";
import { createOcrJobSchema, ocrReviewSchema } from "./ocr.schemas.js";
import { OcrAssistanceService } from "./ocr.service.js";
import { OwnedByModule } from "../../module-ownership.js";

const jobIdSchema = z.string().uuid();

@OwnedByModule("ocr")
@Controller("ocr")
export class OcrController {
  constructor(private readonly ocr: OcrAssistanceService) {}

  @Post("jobs")
  @RequirePermissions("ocr.execute")
  @RequireModule("ocr")
  async create(@Body() body: unknown, @Req() request: ApiRequest): Promise<unknown> {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.ocr.createJob(createOcrJobSchema.parse(body), request.auth, request.requestId);
  }

  @Get("jobs/:jobId")
  @RequirePermissions("ocr.read")
  @RequireModule("ocr")
  get(@Param("jobId") jobId: string, @Req() request: ApiRequest): unknown {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.ocr.getExtraction(jobIdSchema.parse(jobId), request.auth);
  }

  @Get("extractions/:jobId")
  @RequirePermissions("ocr.review")
  @RequireModule("ocr")
  extraction(@Param("jobId") jobId: string, @Req() request: ApiRequest): unknown {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.ocr.getExtraction(jobIdSchema.parse(jobId), request.auth);
  }

  @Post("extractions/:jobId/confirm")
  @RequirePermissions("ocr.confirm")
  @RequireModule("ocr")
  confirm(@Param("jobId") jobId: string, @Body() body: unknown, @Req() request: ApiRequest): unknown {
    if (!request.auth) throw new Error("AUTH_CONTEXT_REQUIRED");
    return this.ocr.confirm(jobIdSchema.parse(jobId), ocrReviewSchema.parse(body), request.auth);
  }
}
