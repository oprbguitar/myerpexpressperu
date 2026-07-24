/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequireModule, RequirePermissions } from "../../auth.guard.js";
import type { ApiRequest } from "../../http.js";
import { GovernanceService } from "./governance.service.js";
import { OwnedByModule } from "../../module-ownership.js";

const uuid = z.string().uuid();

@ApiTags("phase3-legal-privacy")
@OwnedByModule("legal-compliance")
@Controller()
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Get("legal/documents") @RequirePermissions("legal.read") @RequireModule("legal-compliance")
  documents(@Req() request: ApiRequest) { return this.governance.legalDocuments(request); }

  @Post("legal/documents") @RequirePermissions("legal.draft") @RequireModule("legal-compliance")
  createDocument(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      code: z.string().trim().regex(/^[a-z][a-z0-9.-]{2,100}$/),
      title: z.string().trim().min(3).max(240),
      documentType: z.enum(["terms", "privacy_notice", "ai_notice", "ocr_notice", "support_policy", "complaints", "other"]),
      audience: z.enum(["users", "customers", "employees", "public"]).default("users"),
      contentMarkdown: z.string().trim().min(20).max(500_000),
      acceptanceRequired: z.boolean().default(false)
    }).parse(body);
    return this.governance.createLegalDocument(request, input);
  }

  @Post("legal/documents/versions/:id/publish")
  @RequirePermissions("legal.publish") @RequireModule("legal-compliance")
  publish(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const { effectiveFrom } = z.object({ effectiveFrom: z.string().datetime() }).parse(body);
    return this.governance.publishLegalVersion(request, uuid.parse(id), effectiveFrom);
  }

  @Post("legal/acceptances") @RequirePermissions("legal.read") @RequireModule("legal-compliance")
  accept(@Req() request: ApiRequest, @Body() body: unknown) {
    const { legalDocumentVersionId } = z.object({ legalDocumentVersionId: uuid }).parse(body);
    return this.governance.recordAcceptance(request, legalDocumentVersionId);
  }

  @Get("legal/acceptances") @RequirePermissions("legal.read") @RequireModule("legal-compliance")
  acceptances(@Req() request: ApiRequest) { return this.governance.acceptanceHistory(request); }

  @Post("legal/acceptances/:id/revoke") @RequirePermissions("legal.read") @RequireModule("legal-compliance")
  revokeAcceptance(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(1000) }).parse(body);
    return this.governance.revokeAcceptance(request, uuid.parse(id), reason);
  }

  @Get("privacy/consents") @RequirePermissions("privacy.read") @RequireModule("privacy-governance")
  consents(@Req() request: ApiRequest) { return this.governance.consents(request); }

  @Post("privacy/consents") @RequirePermissions("privacy.consent.manage") @RequireModule("privacy-governance")
  recordConsent(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      consentVersionId: uuid, granted: z.boolean(), source: z.string().trim().min(2).max(100)
    }).parse(body);
    return this.governance.recordConsent(request, input);
  }

  @Post("privacy/consents/:id/withdraw")
  @RequirePermissions("privacy.consent.manage") @RequireModule("privacy-governance")
  withdrawConsent(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(1000).optional() }).parse(body);
    return this.governance.withdrawConsent(request, uuid.parse(id), reason);
  }

  @Get("privacy/requests") @RequirePermissions("privacy.read") @RequireModule("privacy-governance")
  privacyRequests(@Req() request: ApiRequest) { return this.governance.privacyRequests(request); }

  @Post("privacy/requests") @RequirePermissions("privacy.requests.manage") @RequireModule("privacy-governance")
  createPrivacyRequest(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      requestType: z.enum(["access", "rectification", "cancellation", "opposition", "information", "withdraw_consent"]),
      dataSubjectType: z.enum(["user", "party", "employee"]),
      dataSubjectReference: z.string().trim().min(2).max(240)
    }).parse(body);
    return this.governance.createPrivacyRequest(request, input);
  }

  @Get("privacy/retention") @RequirePermissions("privacy.read") @RequireModule("privacy-governance")
  retention(@Req() request: ApiRequest) { return this.governance.retentionRules(request); }

  @Get("privacy/legal-holds") @RequirePermissions("privacy.read") @RequireModule("privacy-governance")
  holds(@Req() request: ApiRequest) { return this.governance.legalHolds(request); }

  @Get("observability/health") @RequirePermissions("admin.settings.read") @RequireModule("observability")
  health(@Req() request: ApiRequest) { return this.governance.health(request); }
}
