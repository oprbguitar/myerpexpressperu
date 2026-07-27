/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  transitionWasteLifecycle,
  validateWasteGeneration,
  type WasteGenerationInput,
  type WasteLifecyclePhase
} from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import {
  appendAudit,
  appendOutboxEvent,
  beginIdempotentOperation,
  completeIdempotentOperation
} from "./operations.js";

export interface WasteRecordRow {
  id: string;
  source: string;
  description: string;
  quantity: string;
  unit: string;
  hazardous: boolean;
  currentPhase: WasteLifecyclePhase;
  status: string;
  generatedAt: string;
  createdAt: string;
  version: number;
  responsible: string | null;
  openExceptions: number;
  evidenceCount: number;
}

@Injectable()
export class WasteService {
  constructor(private readonly database: DatabaseService) {}

  records(request: ApiRequest, input: { phase?: WasteLifecyclePhase | undefined; limit: number }) {
    return this.database.query<WasteRecordRow>(
      `select wr.id,wr.source,wr.description,wr.quantity::text,wr.unit,wr.hazardous,
       wr.current_phase as "currentPhase",wr.status,wr.generated_at as "generatedAt",
       wr.created_at as "createdAt",wr.version,up.full_name as responsible,
       count(distinct we.id) filter(where we.status in ('OPEN','IN_PROGRESS','VERIFICATION_PENDING'))::int as "openExceptions",
       count(distinct wle.evidence_document_id)::int as "evidenceCount"
       from waste_records wr
       left join user_profiles up on up.user_id=wr.assigned_to
       left join waste_exceptions we on we.waste_record_id=wr.id
       left join waste_lifecycle_events wle on wle.waste_record_id=wr.id
       where wr.tenant_id=$1 and wr.company_id=$2
         and ($3::text is null or wr.current_phase=$3)
       group by wr.id,up.full_name
       order by wr.generated_at desc,wr.id desc limit $4`,
      [request.auth!.tenantId, request.auth!.companyId, input.phase ?? null, input.limit]
    );
  }

  async overview(request: ApiRequest) {
    const [phases, attention] = await Promise.all([
      this.database.query<{ phase: WasteLifecyclePhase; records: number; quantity: string }>(
        `select current_phase as phase,count(*)::int as records,coalesce(sum(quantity),0)::text as quantity
         from waste_records where tenant_id=$1 and company_id=$2 and status<>'CLOSED'
         group by current_phase order by min(created_at)`,
        [request.auth!.tenantId, request.auth!.companyId]
      ),
      this.database.query<{
        id: string;
        recordId: string;
        severity: string;
        exceptionType: string;
        description: string;
        dueDate: string | null;
        status: string;
      }>(
        `select we.id,we.waste_record_id as "recordId",we.severity,
         we.exception_type as "exceptionType",we.description,we.due_date as "dueDate",we.status
         from waste_exceptions we join waste_records wr on wr.id=we.waste_record_id
         where we.tenant_id=$1 and we.company_id=$2
           and we.status in ('OPEN','IN_PROGRESS','VERIFICATION_PENDING')
         order by case we.severity when 'CRITICAL' then 1 when 'HIGH' then 2 when 'MEDIUM' then 3 else 4 end,
           we.due_date nulls last,we.created_at limit 25`,
        [request.auth!.tenantId, request.auth!.companyId]
      )
    ]);
    return { phases, requiresAttention: attention };
  }

  async detail(request: ApiRequest, id: string) {
    const [record] = await this.database.query<WasteRecordRow>(
      `select wr.id,wr.source,wr.description,wr.quantity::text,wr.unit,wr.hazardous,
       wr.current_phase as "currentPhase",wr.status,wr.generated_at as "generatedAt",
       wr.created_at as "createdAt",wr.version,up.full_name as responsible,
       (select count(*)::int from waste_exceptions we where we.waste_record_id=wr.id
         and we.status in ('OPEN','IN_PROGRESS','VERIFICATION_PENDING')) as "openExceptions",
       (select count(distinct evidence_document_id)::int from waste_lifecycle_events wle
         where wle.waste_record_id=wr.id) as "evidenceCount"
       from waste_records wr left join user_profiles up on up.user_id=wr.assigned_to
       where wr.id=$1 and wr.tenant_id=$2 and wr.company_id=$3`,
      [id, request.auth!.tenantId, request.auth!.companyId]
    );
    if (!record) throw new NotFoundException("El registro de residuo no existe.");
    const [events, exceptions] = await Promise.all([
      this.database.query(
        `select id,from_phase as "fromPhase",to_phase as "toPhase",occurred_at as "occurredAt",
         evidence_document_id as "evidenceDocumentId",notes
         from waste_lifecycle_events where waste_record_id=$1 and tenant_id=$2 and company_id=$3
         order by occurred_at,id`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      ),
      this.database.query(
        `select id,severity,exception_type as "exceptionType",description,immediate_action as "immediateAction",
         corrective_action as "correctiveAction",due_date as "dueDate",status,
         closure_verification as "closureVerification",evidence_document_id as "evidenceDocumentId",version
         from waste_exceptions where waste_record_id=$1 and tenant_id=$2 and company_id=$3
         order by created_at desc`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      )
    ]);
    return { record, events, exceptions };
  }

  async create(request: ApiRequest, rawInput: WasteGenerationInput, key: string) {
    const input = validateWasteGeneration(rawInput);
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "CreateWasteRecord", key, input);
      if (idempotency.replay) return idempotency.replay;
      const id = randomUUID();
      await client.query(
        `insert into waste_records(
           id,tenant_id,company_id,branch_id,source,description,quantity,unit,hazardous,
           current_phase,status,generated_at,assigned_to,created_by,updated_by
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'GENERATION','ACTIVE',$10,$11,$11,$11)`,
        [
          id,
          request.auth!.tenantId,
          request.auth!.companyId,
          request.auth!.branchIds[0] ?? null,
          input.source,
          input.description,
          input.quantity,
          input.unit,
          input.hazardous,
          input.generatedAt,
          request.auth!.userId
        ]
      );
      await client.query(
        `insert into waste_lifecycle_events(
           tenant_id,company_id,waste_record_id,to_phase,responsible_user_id,notes,created_by
         ) values($1,$2,$3,'GENERATION',$4,'Registro de generación creado',$4)`,
        [request.auth!.tenantId, request.auth!.companyId, id, request.auth!.userId]
      );
      const response = { id, currentPhase: "GENERATION", status: "ACTIVE", version: 1 };
      await appendAudit(client, request, {
        action: "waste.record.created",
        entityType: "waste-record",
        entityId: id,
        newValues: input
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "WasteRecord",
        aggregateId: id,
        eventType: "WasteGenerated",
        payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async advance(request: ApiRequest, id: string, input: {
    targetPhase: WasteLifecyclePhase;
    version: number;
    notes?: string | undefined;
  }, key: string) {
    if (input.targetPhase === "DOCUMENTARY_CLOSURE") {
      throw new ConflictException(
        "El cierre documental requiere un flujo separado de aprobación y evidencia vinculada."
      );
    }
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "AdvanceWasteRecord", key, { id, ...input });
      if (idempotency.replay) return idempotency.replay;
      const current = await client.query<{
        current_phase: WasteLifecyclePhase;
        version: number;
        status: string;
      }>(
        `select current_phase,version,status from waste_records
         where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const record = current.rows[0];
      if (!record) throw new NotFoundException("El registro de residuo no existe.");
      if (record.status === "CLOSED") throw new ConflictException("El registro ya está cerrado.");
      if (record.version !== input.version) {
        throw new ConflictException("El registro cambió. Actualice la vista antes de continuar.");
      }
      transitionWasteLifecycle(record.current_phase, input.targetPhase);
      await client.query(
        `update waste_records set current_phase=$2,status='ACTIVE',
         updated_at=now(),updated_by=$3,version=version+1 where id=$1`,
        [id, input.targetPhase, request.auth!.userId]
      );
      await client.query(
        `insert into waste_lifecycle_events(
           tenant_id,company_id,waste_record_id,from_phase,to_phase,responsible_user_id,
           evidence_document_id,notes,created_by
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$6)`,
        [
          request.auth!.tenantId,
          request.auth!.companyId,
          id,
          record.current_phase,
          input.targetPhase,
          request.auth!.userId,
          null,
          input.notes?.trim() || null
        ]
      );
      const response = {
        id,
        currentPhase: input.targetPhase,
        status: "ACTIVE",
        version: record.version + 1
      };
      await appendAudit(client, request, {
        action: "waste.record.advanced",
        entityType: "waste-record",
        entityId: id,
        previousValues: { currentPhase: record.current_phase, version: record.version },
        newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "WasteRecord",
        aggregateId: id,
        eventType: "WasteLifecycleAdvanced",
        payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async createException(request: ApiRequest, recordId: string, input: {
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    exceptionType: string;
    description: string;
    immediateAction?: string | undefined;
    correctiveAction?: string | undefined;
    dueDate?: string | undefined;
  }, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(
        client,
        request,
        "CreateWasteException",
        key,
        { recordId, ...input }
      );
      if (idempotency.replay) return idempotency.replay;
      const record = await client.query<{ id: string }>(
        `select id from waste_records where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [recordId, request.auth!.tenantId, request.auth!.companyId]
      );
      if (!record.rows[0]) throw new NotFoundException("El registro de residuo no existe.");
      const id = randomUUID();
      await client.query(
        `insert into waste_exceptions(
           id,tenant_id,company_id,waste_record_id,severity,exception_type,description,
           immediate_action,corrective_action,responsible_user_id,due_date,status,created_by,updated_by
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'OPEN',$10,$10)`,
        [
          id,
          request.auth!.tenantId,
          request.auth!.companyId,
          recordId,
          input.severity,
          input.exceptionType,
          input.description.trim(),
          input.immediateAction?.trim() || null,
          input.correctiveAction?.trim() || null,
          request.auth!.userId,
          input.dueDate ?? null
        ]
      );
      await appendAudit(client, request, {
        action: "waste.exception.created",
        entityType: "waste-exception",
        entityId: id,
        newValues: { recordId, ...input }
      });
      const response = { id, recordId, status: "OPEN" };
      await appendOutboxEvent(client, request, {
        aggregateType: "WasteRecord",
        aggregateId: recordId,
        eventType: "WasteExceptionCreated",
        payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }
}
