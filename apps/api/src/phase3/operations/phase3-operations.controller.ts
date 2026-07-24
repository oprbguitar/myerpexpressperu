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
import { OwnedByModule } from "../../module-ownership.js";
import type { ApiRequest } from "../../http.js";
import { Phase3OperationsService } from "./phase3-operations.service.js";

const uuid = z.string().uuid();
const optionalUuid = uuid.optional();
const nullableText = z.string().trim().max(500).optional();

const featureSchema = z.object({
  code: z.string().trim().regex(/^[a-z][a-z0-9.-]{2,100}$/),
  description: z.string().trim().min(3).max(500),
  enabledByDefault: z.boolean().default(false)
});
const profileSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/),
  name: z.string().trim().min(2).max(160),
  description: nullableText,
  sector: z.string().trim().max(120).optional()
});
const leadSchema = z.object({
  sourceId: optionalUuid, partyId: optionalUuid, ownerUserId: optionalUuid,
  fullName: z.string().trim().min(2).max(200),
  organizationName: z.string().trim().max(200).optional(),
  email: z.string().email().optional(), phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(4000).optional()
});
const opportunitySchema = z.object({
  pipelineId: uuid, stageId: uuid, leadId: optionalUuid, customerPartyId: optionalUuid,
  ownerUserId: optionalUuid, code: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(200), currency: z.string().regex(/^[A-Z]{3}$/).default("PEN"),
  estimatedAmount: z.number().nonnegative().default(0), probability: z.number().min(0).max(100).default(0),
  expectedCloseDate: z.string().date().optional()
});
const projectSchema = z.object({
  code: z.string().trim().min(2).max(60), name: z.string().trim().min(2).max(200),
  description: nullableText, customerPartyId: optionalUuid, managerUserId: optionalUuid,
  currency: z.string().regex(/^[A-Z]{3}$/).default("PEN"),
  plannedStart: z.string().date().optional(), plannedEnd: z.string().date().optional()
}).refine((value) => !value.plannedStart || !value.plannedEnd || value.plannedEnd >= value.plannedStart, {
  message: "La fecha final no puede ser anterior a la inicial."
});
const employeeSchema = z.object({
  partyId: optionalUuid, userId: optionalUuid, employeeCode: z.string().trim().min(2).max(60),
  firstName: z.string().trim().min(2).max(120), lastName: z.string().trim().min(2).max(120),
  documentType: z.string().trim().max(30).optional(), documentNumber: z.string().trim().max(30).optional(),
  workEmail: z.string().email().optional(), personalEmail: z.string().email().optional(),
  phone: z.string().trim().max(30).optional(), hireDate: z.string().date()
});
const inspectionSchema = z.object({
  branchId: optionalUuid, areaId: optionalUuid,
  inspectionType: z.string().trim().min(2).max(120), scheduledOn: z.string().date().optional(),
  performedOn: z.string().date().optional(), inspectorUserId: optionalUuid,
  status: z.enum(["planned", "in_progress", "completed", "cancelled"]).default("planned")
});
const assetSchema = z.object({
  categoryId: uuid, locationId: optionalUuid, code: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(200), serialNumber: z.string().trim().max(160).optional(),
  model: z.string().trim().max(160).optional(), manufacturer: z.string().trim().max(160).optional(),
  acquiredOn: z.string().date().optional(), acquisitionCost: z.number().nonnegative().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("PEN"),
  criticality: z.enum(["low", "medium", "high", "critical"]).default("medium")
});
const workOrderSchema = z.object({
  assetId: uuid, scheduleId: optionalUuid, code: z.string().trim().min(2).max(60),
  maintenanceType: z.enum(["preventive", "corrective", "predictive", "inspection"]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assignedUserId: optionalUuid, scheduledAt: z.string().datetime().optional(),
  status: z.enum(["draft", "scheduled", "in_progress"]).default("draft")
});

function snakeCase(input: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && !["string", "number", "boolean"].includes(typeof value)) {
      throw new TypeError(`Campo no escalar: ${key}`);
    }
    result[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] =
      value === undefined ? null : value as string | number | boolean | null;
  }
  return result;
}

@ApiTags("phase3-administration")
@Controller("admin")
@OwnedByModule("admin-control-plane")
export class Phase3AdminController {
  constructor(private readonly operations: Phase3OperationsService) {}

  @Get("settings")
  @RequirePermissions("admin.settings.read")
  @RequireModule("admin-control-plane")
  overview(@Req() request: ApiRequest) { return this.operations.overview(request); }

  @Get("features")
  @RequirePermissions("admin.features.read")
  @RequireModule("admin-control-plane")
  features(@Req() request: ApiRequest) { return this.operations.listFeatures(request); }

  @Post("features")
  @RequirePermissions("admin.features.manage")
  @RequireModule("admin-control-plane")
  createFeature(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createFeature(request, featureSchema.parse(body));
  }

  @Get("business-profiles")
  @RequirePermissions("admin.business-profiles.read")
  @RequireModule("business-profiles")
  profiles(@Req() request: ApiRequest) { return this.operations.listProfiles(request); }

  @Post("business-profiles")
  @RequirePermissions("admin.business-profiles.manage")
  @RequireModule("business-profiles")
  createProfile(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createProfile(request, profileSchema.parse(body));
  }

  @Get("configuration-history")
  @RequirePermissions("admin.settings.read")
  @RequireModule("admin-control-plane")
  history(@Req() request: ApiRequest) { return this.operations.listConfigurationHistory(request); }
}

@ApiTags("phase3-crm")
@Controller("crm")
@OwnedByModule("crm")
export class Phase3CrmController {
  constructor(private readonly operations: Phase3OperationsService) {}
  @Get("leads") @RequirePermissions("crm.read") @RequireModule("crm")
  leads(@Req() request: ApiRequest) { return this.operations.listLeads(request); }
  @Post("leads") @RequirePermissions("crm.create") @RequireModule("crm")
  createLead(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createLead(request, snakeCase(leadSchema.parse(body)));
  }
  @Get("opportunities") @RequirePermissions("crm.read") @RequireModule("crm")
  opportunities(@Req() request: ApiRequest) { return this.operations.listOpportunities(request); }
  @Post("opportunities") @RequirePermissions("crm.create") @RequireModule("crm")
  createOpportunity(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createOpportunity(request, snakeCase(opportunitySchema.parse(body)));
  }
}

@ApiTags("phase3-projects")
@Controller("projects")
@OwnedByModule("projects")
export class Phase3ProjectsController {
  constructor(private readonly operations: Phase3OperationsService) {}
  @Get() @RequirePermissions("projects.read") @RequireModule("projects")
  projects(@Req() request: ApiRequest) { return this.operations.listProjects(request); }
  @Post() @RequirePermissions("projects.create") @RequireModule("projects")
  create(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createProject(request, snakeCase(projectSchema.parse(body)));
  }
  @Get(":id/tasks") @RequirePermissions("projects.read") @RequireModule("projects")
  tasks(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.operations.listProjectChildren(request, uuid.parse(id), "tasks");
  }
  @Post(":id/tasks") @RequirePermissions("projects.update") @RequireModule("projects")
  addTask(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({
      code: z.string().trim().min(2).max(60), title: z.string().trim().min(2).max(200),
      description: nullableText, priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      assigneeUserId: optionalUuid
    }).parse(body);
    return this.operations.addProjectTask(request, uuid.parse(id), input);
  }
  @Get(":id/time") @RequirePermissions("projects.read") @RequireModule("time-and-expenses")
  time(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.operations.listProjectChildren(request, uuid.parse(id), "time");
  }
  @Get(":id/expenses") @RequirePermissions("projects.read") @RequireModule("time-and-expenses")
  expenses(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.operations.listProjectChildren(request, uuid.parse(id), "expenses");
  }
}

@ApiTags("phase3-hr-sst")
@Controller()
@OwnedByModule("human-resources")
export class Phase3PeopleController {
  constructor(private readonly operations: Phase3OperationsService) {}
  @Get("hr/employees") @RequirePermissions("hr.read") @RequireModule("human-resources")
  employees(@Req() request: ApiRequest) { return this.operations.listEmployees(request); }
  @Post("hr/employees") @RequirePermissions("hr.create") @RequireModule("human-resources")
  createEmployee(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createEmployee(request, snakeCase(employeeSchema.parse(body)));
  }
  @Get("sst/inspections") @RequirePermissions("sst.read") @RequireModule("occupational-safety")
  inspections(@Req() request: ApiRequest) { return this.operations.listInspections(request); }
  @Post("sst/inspections") @RequirePermissions("sst.inspections.manage") @RequireModule("occupational-safety")
  createInspection(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createInspection(request, snakeCase(inspectionSchema.parse(body)));
  }
  @Post("sst/inspections/:id/findings")
  @RequirePermissions("sst.inspections.manage") @RequireModule("occupational-safety")
  addFinding(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({
      findingType: z.enum(["conformity", "observation", "nonconformity"]),
      description: z.string().trim().min(3).max(4000),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      evidenceDocumentId: optionalUuid
    }).parse(body);
    return this.operations.addInspectionFinding(request, uuid.parse(id), input);
  }
}

@ApiTags("phase3-assets")
@Controller()
@OwnedByModule("assets")
export class Phase3AssetsController {
  constructor(private readonly operations: Phase3OperationsService) {}
  @Get("assets") @RequirePermissions("assets.read") @RequireModule("assets")
  assets(@Req() request: ApiRequest) { return this.operations.listAssets(request); }
  @Post("assets") @RequirePermissions("assets.create") @RequireModule("assets")
  createAsset(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createAsset(request, snakeCase(assetSchema.parse(body)));
  }
  @Get("maintenance/work-orders") @RequirePermissions("maintenance.read") @RequireModule("maintenance")
  workOrders(@Req() request: ApiRequest) { return this.operations.listWorkOrders(request); }
  @Post("maintenance/work-orders") @RequirePermissions("maintenance.manage") @RequireModule("maintenance")
  createWorkOrder(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.operations.createWorkOrder(request, snakeCase(workOrderSchema.parse(body)));
  }
  @Post("maintenance/work-orders/:id/complete")
  @RequirePermissions("maintenance.close") @RequireModule("maintenance")
  complete(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const { evidenceDocumentId } = z.object({ evidenceDocumentId: uuid }).parse(body);
    return this.operations.completeWorkOrder(request, uuid.parse(id), evidenceDocumentId);
  }
}
