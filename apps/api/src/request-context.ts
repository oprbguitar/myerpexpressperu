/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { PoolClient } from "pg";

/**
 * Contexto de petición con un cliente de base de datos dedicado sobre el que
 * ya se fijó el ámbito de tenant/empresa (`app.tenant_id` / `app.company_id`).
 *
 * Cualquier consulta emitida durante una petición autenticada usa este cliente,
 * de modo que las políticas RLS se aplican de verdad. Sin esto, al conectar con
 * el rol restringido `erp_app` (no propietario, sin BYPASSRLS) toda consulta sin
 * contexto devolvería cero filas.
 */
export interface RequestDatabaseContext {
  readonly client: PoolClient;
}

export const requestContext = new AsyncLocalStorage<RequestDatabaseContext>();

/** Cliente dedicado de la petición actual, si existe. */
export function currentRequestClient(): PoolClient | null {
  return requestContext.getStore()?.client ?? null;
}
