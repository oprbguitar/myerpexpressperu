/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Controller, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { PdfService } from "./pdf.service.js";

const pdfType = z.enum([
  "quotation", "sales-order", "sale", "purchase",
  "customer-statement", "supplier-statement", "cash-closure"
]);

@ApiTags("pdf")
@Controller("pdf")
export class PdfController {
  constructor(private readonly pdf: PdfService) {}

  @Post(":type/:id")
  @RequirePermissions("documents.upload")
  generate(@Req() request: ApiRequest, @Param("type") type: string, @Param("id") id: string) {
    return this.pdf.generate(request, pdfType.parse(type), z.uuid().parse(id));
  }
}
