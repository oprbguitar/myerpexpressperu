/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { OrganizationService } from "./organization.service.js";
import { CoreEndpoint } from "./module-ownership.js";

const companySchema = z.object({
  legalName: z.string().min(2).max(200),
  commercialName: z.string().max(200).optional(),
  ruc: z.string().regex(/^\d{11}$/),
  fiscalAddress: z.string().max(500).optional(),
  ubigeo: z.string().regex(/^\d{6}$/).optional(),
  email: z.email().optional(),
  phone: z.string().max(40).optional(),
  mainCurrency: z.string().length(3),
  timeZone: z.string().min(1).max(80),
  classification: z.enum(["private_company", "public_company", "public_entity"]),
  economicActivityCode: z.string().max(20).optional(),
  version: z.number().int().positive()
});

@ApiTags("organization")
@CoreEndpoint()
@Controller()
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}
  @Get("companies/current")
  @RequirePermissions("organization.read")
  getCompany(@Req() request: ApiRequest) {
    return this.organization.getCompany(request);
  }
  @Patch("companies/current")
  @RequirePermissions("organization.manage")
  updateCompany(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.organization.updateCompany(request, companySchema.parse(body));
  }
  @Get("branches")
  @RequirePermissions("branches.read")
  listBranches(@Req() request: ApiRequest) {
    return this.organization.listBranches(request);
  }
}
