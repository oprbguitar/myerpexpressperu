import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { PartyType } from "@erp/domain";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { PartiesService } from "./parties.service.js";

const roleSchema = z.enum(["CUSTOMER", "SUPPLIER", "TRANSPORT_PROVIDER", "CONTACT"]);
const partySchema = z.object({
  partyType: z.nativeEnum(PartyType),
  documentType: z.enum(["RUC", "DNI", "FOREIGN", "NONE"]).optional(),
  documentNumber: z.string().max(30).optional(),
  legalName: z.string().max(200).optional(),
  commercialName: z.string().max(200).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(150).optional(),
  email: z.email().optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  roles: z.array(roleSchema).min(1).max(4)
});

@ApiTags("parties")
@Controller()
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  @Get("parties")
  @RequirePermissions("parties.read")
  list(@Req() request: ApiRequest, @Query() query: unknown) {
    const input = z.object({
      role: roleSchema.optional(), search: z.string().max(120).optional(),
      status: z.enum(["active", "inactive"]).optional(), cursor: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25)
    }).parse(query);
    return this.parties.list(request, input);
  }

  @Get("customers")
  @RequirePermissions("parties.read")
  customers(@Req() request: ApiRequest, @Query() query: unknown) {
    const input = z.object({
      search: z.string().max(120).optional(), cursor: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25)
    }).parse(query);
    return this.parties.list(request, { ...input, role: "CUSTOMER", status: "active" });
  }

  @Get("suppliers")
  @RequirePermissions("parties.read")
  suppliers(@Req() request: ApiRequest, @Query() query: unknown) {
    const input = z.object({
      search: z.string().max(120).optional(), cursor: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25)
    }).parse(query);
    return this.parties.list(request, { ...input, role: "SUPPLIER", status: "active" });
  }

  @Get("parties/:id")
  @RequirePermissions("parties.read")
  get(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.parties.get(request, z.uuid().parse(id));
  }

  @Post("parties")
  @RequirePermissions("parties.create")
  create(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.parties.create(request, partySchema.parse(body));
  }

  @Patch("parties/:id")
  @RequirePermissions("parties.update")
  update(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.parties.update(request, z.uuid().parse(id), partySchema.extend({
      version: z.number().int().positive()
    }).parse(body));
  }

  @Post("parties/:id/roles/:role")
  @RequirePermissions("parties.update")
  role(@Req() request: ApiRequest, @Param("id") id: string, @Param("role") role: string, @Body() body: unknown) {
    const input = z.object({ active: z.boolean() }).parse(body);
    return this.parties.setRole(request, z.uuid().parse(id), roleSchema.parse(role), input.active);
  }

  @Patch("customers/:id/credit")
  @RequirePermissions("customer.credit.manage")
  credit(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({
      allowCredit: z.boolean(), creditLimit: z.string().regex(/^\d{1,16}(?:\.\d{1,2})?$/),
      currency: z.string().length(3), paymentTermId: z.uuid().optional()
    }).parse(body);
    return this.parties.setCredit(request, z.uuid().parse(id), input);
  }

  @Post("parties/:id/deactivate")
  @RequirePermissions("parties.deactivate")
  deactivate(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.parties.deactivate(request, z.uuid().parse(id));
  }
}
