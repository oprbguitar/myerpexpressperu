/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../database.service.js";
import type { ApiRequest } from "../../http.js";
import { appendAudit } from "../../operations.js";

type WritableValue = string | number | boolean | null;

interface EntityDefinition {
  readonly table: string;
  readonly entityType: string;
  readonly select: string;
  readonly writable: readonly string[];
}

const definitions = {
  lead: {
    table: "leads",
    entityType: "lead",
    select: "id,full_name as \"fullName\",organization_name as \"organizationName\",email,phone,status,owner_user_id as \"ownerUserId\",created_at as \"createdAt\",version",
    writable: ["source_id", "party_id", "owner_user_id", "full_name", "organization_name", "email", "phone", "notes"]
  },
  opportunity: {
    table: "opportunities",
    entityType: "opportunity",
    select: "id,code,name,estimated_amount as \"estimatedAmount\",currency,probability,expected_close_date as \"expectedCloseDate\",status,loss_reason as \"lossReason\",stage_id as \"stageId\",customer_party_id as \"customerPartyId\",created_at as \"createdAt\",version",
    writable: ["pipeline_id", "stage_id", "lead_id", "customer_party_id", "owner_user_id", "code", "name", "currency", "estimated_amount", "probability", "expected_close_date"]
  },
  project: {
    table: "projects",
    entityType: "project",
    select: "id,code,name,description,customer_party_id as \"customerPartyId\",manager_user_id as \"managerUserId\",currency,planned_start as \"plannedStart\",planned_end as \"plannedEnd\",status,created_at as \"createdAt\",version",
    writable: ["code", "name", "description", "customer_party_id", "manager_user_id", "currency", "planned_start", "planned_end"]
  },
  employee: {
    table: "employees",
    entityType: "employee",
    select: "id,employee_code as \"employeeCode\",first_name as \"firstName\",last_name as \"lastName\",work_email as \"workEmail\",phone,hire_date as \"hireDate\",status,created_at as \"createdAt\",version",
    writable: ["party_id", "user_id", "employee_code", "first_name", "last_name", "document_type", "document_number", "work_email", "personal_email", "phone", "hire_date"]
  },
  inspection: {
    table: "sst_inspections",
    entityType: "sst-inspection",
    select: "id,branch_id as \"branchId\",area_id as \"areaId\",inspection_type as \"inspectionType\",scheduled_on as \"scheduledOn\",performed_on as \"performedOn\",inspector_user_id as \"inspectorUserId\",status,created_at as \"createdAt\",version",
    writable: ["branch_id", "area_id", "inspection_type", "scheduled_on", "performed_on", "inspector_user_id", "status"]
  },
  asset: {
    table: "assets",
    entityType: "asset",
    select: "id,category_id as \"categoryId\",location_id as \"locationId\",code,name,serial_number as \"serialNumber\",model,manufacturer,acquired_on as \"acquiredOn\",criticality,status,created_at as \"createdAt\",version",
    writable: ["category_id", "location_id", "code", "name", "serial_number", "model", "manufacturer", "acquired_on", "acquisition_cost", "currency", "criticality"]
  },
  workOrder: {
    table: "maintenance_work_orders",
    entityType: "maintenance-work-order",
    select: "id,asset_id as \"assetId\",code,maintenance_type as \"maintenanceType\",priority,assigned_user_id as \"assignedUserId\",scheduled_at as \"scheduledAt\",started_at as \"startedAt\",completed_at as \"completedAt\",status,created_at as \"createdAt\",version",
    writable: ["asset_id", "schedule_id", "code", "maintenance_type", "priority", "assigned_user_id", "scheduled_at", "status"]
  }
} as const satisfies Record<string, EntityDefinition>;

@Injectable()
export class Phase3OperationsService {
  constructor(private readonly database: DatabaseService) {}

  async overview(request: ApiRequest) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const [modules, approvals, providers, configuration] = await Promise.all([
        client.query<{ total: string; healthy: string }>(
          `select count(*)::text total,
            count(*) filter(where cm.status='enabled' and m.implemented)::text healthy
           from modules m left join company_modules cm on cm.module_id=m.id and cm.company_id=$1`,
          [request.auth!.companyId]
        ),
        client.query<{ pending: string }>(
          "select count(*)::text pending from configuration_approvals where company_id=$1 and status='pending'",
          [request.auth!.companyId]
        ),
        client.query<{ total: string; healthy: string }>(
          `select count(*)::text total,
            count(*) filter(where status in ('active','degraded'))::text healthy
           from ai_providers where company_id=$1`,
          [request.auth!.companyId]
        ),
        client.query(
          `select configuration_key as "key",version_number as "versionNumber",state,
             created_at as "createdAt"
           from configuration_versions where company_id=$1
           order by created_at desc,id desc limit 20`,
          [request.auth!.companyId]
        )
      ]);
      return {
        environment: process.env.APP_ENVIRONMENT ?? "development",
        modules: modules.rows[0] ?? { total: "0", healthy: "0" },
        approvals: approvals.rows[0] ?? { pending: "0" },
        providers: providers.rows[0] ?? { total: "0", healthy: "0" },
        configuration: configuration.rows
      };
    });
  }

  listFeatures(request: ApiRequest) {
    return this.scopedList(
      request,
      `select id,code,description,enabled_by_default as "enabledByDefault",status,updated_at as "updatedAt",version
       from feature_flags where company_id=$1 order by code limit $2`
    );
  }

  createFeature(request: ApiRequest, input: {
    code: string; description: string; enabledByDefault: boolean;
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const id = randomUUID();
      const [row] = (await client.query(
        `insert into feature_flags(id,tenant_id,company_id,code,description,enabled_by_default,created_by,updated_by)
         values($1,$2,$3,$4,$5,$6,$7,$7)
         returning id,code,description,enabled_by_default as "enabledByDefault",status,version`,
        [id, request.auth!.tenantId, request.auth!.companyId, input.code, input.description, input.enabledByDefault, request.auth!.userId]
      )).rows;
      await appendAudit(client, request, { action: "admin.feature.created", entityType: "feature-flag", entityId: id, newValues: row });
      return row;
    });
  }

  listProfiles(request: ApiRequest) {
    return this.scopedList(
      request,
      `select id,code,name,description,sector,is_system as "isSystem",status,updated_at as "updatedAt",version
       from business_profiles where company_id=$1 order by name limit $2`
    );
  }

  createProfile(request: ApiRequest, input: {
    code: string; name: string; description?: string | undefined; sector?: string | undefined;
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const id = randomUUID();
      const [row] = (await client.query(
        `insert into business_profiles(id,tenant_id,company_id,code,name,description,sector,created_by,updated_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$8)
         returning id,code,name,description,sector,status,version`,
        [id, request.auth!.tenantId, request.auth!.companyId, input.code, input.name, input.description ?? null, input.sector ?? null, request.auth!.userId]
      )).rows;
      await appendAudit(client, request, { action: "admin.business-profile.created", entityType: "business-profile", entityId: id, newValues: row });
      return row;
    });
  }

  listConfigurationHistory(request: ApiRequest) {
    return this.scopedList(
      request,
      `select cv.id,cv.configuration_key as "configurationKey",cv.version_number as "versionNumber",
         cv.state,cv.checksum,cv.created_at as "createdAt",
         ca.status as "approvalStatus",ca.requested_by as "requestedBy",ca.decided_by as "decidedBy"
       from configuration_versions cv
       left join configuration_approvals ca on ca.configuration_version_id=cv.id
       where cv.company_id=$1 order by cv.created_at desc,cv.id desc limit $2`
    );
  }

  listLeads(request: ApiRequest) { return this.listEntity(request, definitions.lead); }
  createLead(request: ApiRequest, input: Record<string, WritableValue>) {
    return this.createEntity(request, definitions.lead, input);
  }
  listOpportunities(request: ApiRequest) { return this.listEntity(request, definitions.opportunity); }
  createOpportunity(request: ApiRequest, input: Record<string, WritableValue>) {
    return this.createEntity(request, definitions.opportunity, input);
  }
  listProjects(request: ApiRequest) { return this.listEntity(request, definitions.project); }
  createProject(request: ApiRequest, input: Record<string, WritableValue>) {
    return this.createEntity(request, definitions.project, input);
  }
  listEmployees(request: ApiRequest) { return this.listEntity(request, definitions.employee); }
  createEmployee(request: ApiRequest, input: Record<string, WritableValue>) {
    return this.createEntity(request, definitions.employee, input);
  }
  listInspections(request: ApiRequest) { return this.listEntity(request, definitions.inspection); }
  createInspection(request: ApiRequest, input: Record<string, WritableValue>) {
    return this.createEntity(request, definitions.inspection, input);
  }
  listAssets(request: ApiRequest) { return this.listEntity(request, definitions.asset); }
  createAsset(request: ApiRequest, input: Record<string, WritableValue>) {
    return this.createEntity(request, definitions.asset, input);
  }
  listWorkOrders(request: ApiRequest) { return this.listEntity(request, definitions.workOrder); }
  createWorkOrder(request: ApiRequest, input: Record<string, WritableValue>) {
    return this.createEntity(request, definitions.workOrder, input);
  }

  listProjectChildren(request: ApiRequest, projectId: string, kind: "tasks" | "time" | "expenses") {
    const queries = {
      tasks: `select id,code,title,priority,status,assignee_user_id as "assigneeUserId",
                planned_end as "plannedEnd",completed_at as "completedAt",version
              from project_tasks where company_id=$1 and project_id=$2 order by created_at,id limit 100`,
      time: `select id,user_id as "userId",task_id as "taskId",work_date as "workDate",
               minutes,billable,status,submitted_at as "submittedAt",approved_at as "approvedAt",version
             from project_time_entries where company_id=$1 and project_id=$2 order by work_date desc,id desc limit 100`,
      expenses: `select id,expense_id as "expenseId",user_id as "userId",amount,currency,
                   incurred_on as "incurredOn",status,submitted_at as "submittedAt",approved_at as "approvedAt",version
                 from project_expenses where company_id=$1 and project_id=$2 order by incurred_on desc,id desc limit 100`
    } as const;
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(queries[kind], [request.auth!.companyId, projectId])).rows
    );
  }

  addProjectTask(request: ApiRequest, projectId: string, input: {
    code: string; title: string; description?: string | undefined; priority: string;
    assigneeUserId?: string | undefined;
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      await this.requireRecord(client, "projects", request.auth!.companyId, projectId);
      const id = randomUUID();
      const [row] = (await client.query(
        `insert into project_tasks(id,tenant_id,company_id,project_id,code,title,description,priority,assignee_user_id,created_by,updated_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
         returning id,project_id as "projectId",code,title,priority,status,version`,
        [id, request.auth!.tenantId, request.auth!.companyId, projectId, input.code, input.title, input.description ?? null, input.priority, input.assigneeUserId ?? null, request.auth!.userId]
      )).rows;
      await appendAudit(client, request, { action: "project.task.created", entityType: "project-task", entityId: id, newValues: row });
      return row;
    });
  }

  addInspectionFinding(request: ApiRequest, inspectionId: string, input: {
    findingType: string; description: string; severity?: string | undefined;
    evidenceDocumentId?: string | undefined;
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      await this.requireRecord(client, "sst_inspections", request.auth!.companyId, inspectionId);
      const id = randomUUID();
      const [row] = (await client.query(
        `insert into sst_inspection_findings(
           id,tenant_id,company_id,inspection_id,finding_type,description,severity,evidence_document_id,created_by,updated_by
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
         returning id,inspection_id as "inspectionId",finding_type as "findingType",description,severity,evidence_document_id as "evidenceDocumentId",version`,
        [id, request.auth!.tenantId, request.auth!.companyId, inspectionId, input.findingType, input.description, input.severity ?? null, input.evidenceDocumentId ?? null, request.auth!.userId]
      )).rows;
      await appendAudit(client, request, { action: "sst.finding.created", entityType: "sst-finding", entityId: id, newValues: row });
      return row;
    });
  }

  async completeWorkOrder(request: ApiRequest, workOrderId: string, evidenceDocumentId: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const [row] = (await client.query(
        `update maintenance_work_orders set status='completed',completed_at=now(),updated_at=now(),
           updated_by=$3,version=version+1
         where id=$1 and company_id=$2 and status in ('scheduled','in_progress')
           and exists(select 1 from documents d where d.id=$4 and d.company_id=$2)
         returning id,code,status,completed_at as "completedAt",version`,
        [workOrderId, request.auth!.companyId, request.auth!.userId, evidenceDocumentId]
      )).rows;
      if (!row) throw new NotFoundException("Orden no encontrada, estado inválido o evidencia no autorizada.");
      await appendAudit(client, request, {
        action: "maintenance.work-order.completed",
        entityType: "maintenance-work-order",
        entityId: workOrderId,
        newValues: { evidenceDocumentId, status: "completed" }
      });
      return row;
    });
  }

  private async scopedList(request: ApiRequest, sql: string) {
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(sql, [request.auth!.companyId, 100])).rows
    );
  }

  private listEntity(request: ApiRequest, definition: EntityDefinition) {
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(
        `select ${definition.select} from ${definition.table}
         where company_id=$1 order by created_at desc,id desc limit $2`,
        [request.auth!.companyId, 100]
      )).rows
    );
  }

  private createEntity(
    request: ApiRequest,
    definition: EntityDefinition,
    input: Record<string, WritableValue>
  ) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const fields = definition.writable.filter((field) => Object.hasOwn(input, field));
      const id = randomUUID();
      const fixedColumns = ["id", "tenant_id", "company_id", "created_by", "updated_by"];
      const values: WritableValue[] = [
        id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, request.auth!.userId,
        ...fields.map((field) => input[field] ?? null)
      ];
      const columns = [...fixedColumns, ...fields];
      const placeholders = values.map((_, index) => `$${index + 1}`).join(",");
      const [row] = (await client.query(
        `insert into ${definition.table}(${columns.join(",")}) values(${placeholders})
         returning ${definition.select}`,
        values
      )).rows;
      await appendAudit(client, request, {
        action: `${definition.entityType}.created`,
        entityType: definition.entityType,
        entityId: id,
        newValues: row
      });
      return row;
    });
  }

  private async requireRecord(client: PoolClient, table: string, companyId: string, id: string) {
    const result = await client.query(`select id from ${table} where id=$1 and company_id=$2`, [id, companyId]);
    if (!result.rows[0]) throw new NotFoundException("El registro no existe en la empresa activa.");
  }
}
