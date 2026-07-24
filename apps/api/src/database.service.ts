/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import type { AuthenticatedContext } from "@erp/contracts";
import { PostgresDatabase } from "@erp/database";
import { config } from "./config.js";
import { currentRequestClient, requestContext } from "./request-context.js";

@Injectable()
export class DatabaseService extends PostgresDatabase implements OnModuleDestroy {
  constructor() {
    super(config.DATABASE_URL);
  }

  /**
   * Emite una consulta. Si la petición actual tiene un cliente dedicado con el
   * ámbito de tenant ya fijado, la consulta corre sobre él (para que RLS se
   * aplique). En otro caso —peticiones no autenticadas como el login— usa el
   * pool directamente, alcanzando solo tablas de sistema sin política RLS.
   */
  override async query<T extends QueryResultRow>(
    text: string,
    values: readonly unknown[] = []
  ): Promise<readonly T[]> {
    const client = currentRequestClient();
    if (client) {
      const result = await client.query<T>(text, [...values]);
      return result.rows;
    }
    return super.query<T>(text, values);
  }

  /**
   * Ejecuta una transacción. Reutiliza el cliente dedicado de la petición cuando
   * existe, de modo que la transacción hereda el ámbito de tenant ya fijado a
   * nivel de sesión. No anida BEGIN sobre una transacción abierta ajena.
   */
  override async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const requestClient = currentRequestClient();
    if (!requestClient) return super.transaction(operation);
    await requestClient.query("begin");
    try {
      const result = await operation(requestClient);
      await requestClient.query("commit");
      return result;
    } catch (error) {
      await requestClient.query("rollback");
      throw error;
    }
  }

  /**
   * Ejecuta una operación con el ámbito de tenant/empresa fijado. Cuando la
   * petición ya tiene cliente dedicado (caso normal en la API), el ámbito ya
   * está fijado a nivel de sesión, por lo que solo abre la transacción sobre
   * ese cliente. En contextos sin petición (jobs, pruebas) fija el ámbito de
   * forma local dentro de su propia transacción.
   */
  async scopedTransaction<T>(
    auth: AuthenticatedContext,
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const requestClient = currentRequestClient();
    if (requestClient) {
      return this.transaction(operation);
    }
    return super.transaction(async (client) => {
      await client.query("select set_config('app.tenant_id',$1,true),set_config('app.company_id',$2,true)", [
        auth.tenantId,
        auth.companyId
      ]);
      return operation(client);
    });
  }

  /**
   * Establece el contexto de tenant para toda una petición sobre un cliente
   * dedicado del pool, y lo mantiene disponible vía AsyncLocalStorage. Al
   * terminar, limpia el ámbito y devuelve el cliente al pool.
   */
  async runWithTenantContext<T>(auth: AuthenticatedContext, run: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      // Ámbito a nivel de sesión (is_local=false): persiste entre las
      // transacciones que abran los servicios sobre este mismo cliente.
      await client.query("select set_config('app.tenant_id',$1,false),set_config('app.company_id',$2,false)", [
        auth.tenantId,
        auth.companyId
      ]);
      return await requestContext.run({ client }, run);
    } finally {
      try {
        await client.query("select set_config('app.tenant_id','',false),set_config('app.company_id','',false)");
      } catch {
        // Si el cliente quedó inutilizable, el pool lo descartará igualmente.
      }
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
