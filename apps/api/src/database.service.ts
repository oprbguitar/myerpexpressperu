/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { AuthenticatedContext } from "@erp/contracts";
import { PostgresDatabase } from "@erp/database";
import { config } from "./config.js";

@Injectable()
export class DatabaseService extends PostgresDatabase implements OnModuleDestroy {
  constructor() {
    super(config.DATABASE_URL);
  }
  async scopedTransaction<T>(
    auth: AuthenticatedContext,
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    return this.transaction(async (client) => {
      await client.query("select set_config('app.tenant_id',$1,true),set_config('app.company_id',$2,true)", [
        auth.tenantId, auth.companyId
      ]);
      return operation(client);
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
