/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { afterAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../packages/database/src/index.js";

const enabled = Boolean(process.env.DATABASE_URL);
const database = enabled ? new PostgresDatabase(process.env.DATABASE_URL!) : null;
const tables = ["waste_records", "waste_lifecycle_events", "waste_exceptions"] as const;

describe.skipIf(!enabled)("persistencia de gestión de residuos", () => {
  afterAll(() => database!.close());

  it("instala las tablas con RLS habilitado y forzado", async () => {
    const rows = await database!.query<{
      table_name: string;
      row_security: boolean;
      force_row_security: boolean;
    }>(
      `select c.relname table_name,c.relrowsecurity row_security,
       c.relforcerowsecurity force_row_security
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and c.relname=any($1::text[])`,
      [[...tables]]
    );
    expect(rows).toHaveLength(tables.length);
    expect(rows.every((row) => row.row_security && row.force_row_security)).toBe(true);
  });

  it("mantiene índices de ámbito para libro, eventos y cola de excepciones", async () => {
    const expected = [
      "waste_records_scope_phase_time",
      "waste_lifecycle_events_scope_record_time",
      "waste_exceptions_scope_queue"
    ];
    const rows = await database!.query<{ indexname: string }>(
      "select indexname from pg_indexes where schemaname='public' and indexname=any($1::text[])",
      [expected]
    );
    expect(new Set(rows.map((row) => row.indexname))).toEqual(new Set(expected));
  });

  it("restringe la cadena a fases consecutivas y exige evidencia para el cierre", async () => {
    const checks = await database!.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) definition from pg_constraint
       where conrelid='waste_lifecycle_events'::regclass and contype='c'`
    );
    const definition = checks.map((row) => row.definition).join(" ");
    expect(definition).toContain("FINAL_DESTINATION");
    expect(definition).toContain("DOCUMENTARY_CLOSURE");
    expect(definition).toContain("evidence_document_id IS NOT NULL");
  });
});
