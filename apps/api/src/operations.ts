/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { ConflictException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { redactSensitive } from "@erp/security";
import type { ApiRequest } from "./http.js";

export function requestHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function requireIdempotencyKey(request: ApiRequest): string {
  const key = request.headers["idempotency-key"]?.toString().trim();
  if (!key || key.length < 8 || key.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new ConflictException("La operación requiere un Idempotency-Key válido.");
  }
  return key;
}

export async function beginIdempotentOperation(
  client: PoolClient,
  request: ApiRequest,
  operation: string,
  key: string,
  payload: unknown
): Promise<{ id: string; replay: Readonly<Record<string, unknown>> | null }> {
  const hash = requestHash(payload);
  const id = randomUUID();
  const inserted = await client.query<{ id: string }>(
    `insert into idempotency_keys(id,tenant_id,company_id,user_id,operation,idempotency_key,request_hash)
     values($1,$2,$3,$4,$5,$6,$7)
     on conflict(tenant_id,company_id,user_id,operation,idempotency_key) do nothing returning id`,
    [id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, operation, key, hash]
  );
  if (inserted.rows[0]) return { id, replay: null };
  const existing = await client.query<{
    id: string; request_hash: string; status: string; response_reference: Readonly<Record<string, unknown>> | null;
  }>(
    `select id,request_hash,status,response_reference from idempotency_keys
     where tenant_id=$1 and company_id=$2 and user_id=$3 and operation=$4 and idempotency_key=$5 for update`,
    [request.auth!.tenantId, request.auth!.companyId, request.auth!.userId, operation, key]
  );
  const row = existing.rows[0];
  if (!row || row.request_hash !== hash) {
    throw new ConflictException("El Idempotency-Key ya fue usado con otro contenido.");
  }
  if (row.status === "COMPLETED" && row.response_reference) return { id: row.id, replay: row.response_reference };
  throw new ConflictException("Una operación con este Idempotency-Key continúa en proceso.");
}

export async function completeIdempotentOperation(
  client: PoolClient,
  id: string,
  response: Readonly<Record<string, unknown>>
): Promise<void> {
  await client.query(
    "update idempotency_keys set status='COMPLETED',response_reference=$2::jsonb where id=$1",
    [id, JSON.stringify(response)]
  );
}

export async function appendAudit(
  client: PoolClient,
  request: ApiRequest,
  input: {
    action: string;
    entityType: string;
    entityId?: string | undefined;
    previousValues?: unknown;
    newValues?: unknown;
  }
): Promise<void> {
  await client.query(
    `insert into audit_events(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,
      previous_values,new_values,ip_address,user_agent,request_id)
     values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11)`,
    [
      request.auth!.tenantId, request.auth!.companyId, request.auth!.userId,
      input.action, input.entityType, input.entityId ?? null,
      input.previousValues === undefined ? null : JSON.stringify(redactSensitive(input.previousValues)),
      input.newValues === undefined ? null : JSON.stringify(redactSensitive(input.newValues)),
      request.ip, request.headers["user-agent"]?.slice(0, 500), request.requestId
    ]
  );
}

export async function appendOutboxEvent(
  client: PoolClient,
  request: ApiRequest,
  input: { aggregateType: string; aggregateId: string; eventType: string; payload: unknown }
): Promise<void> {
  await client.query(
    `insert into outbox_events(tenant_id,company_id,aggregate_type,aggregate_id,event_type,payload)
     values($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      request.auth!.tenantId, request.auth!.companyId, input.aggregateType,
      input.aggregateId, input.eventType, JSON.stringify(input.payload)
    ]
  );
}
