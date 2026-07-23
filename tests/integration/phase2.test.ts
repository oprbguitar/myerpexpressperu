import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../packages/database/src/index.js";

const enabled = Boolean(process.env.DATABASE_URL);
const database = enabled ? new PostgresDatabase(process.env.DATABASE_URL!) : null;

describe.skipIf(!enabled)("fundación transaccional de fase 2", () => {
  beforeAll(async () => {
    const rows = await database!.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema='public' and table_name=any($1::text[])`,
      [["parties", "items", "quotations", "sales", "purchases", "accounts_receivable",
        "accounts_payable", "payments", "cash_sessions", "stock_movements",
        "commercial_documents", "idempotency_keys", "outbox_events"]]
    );
    expect(rows).toHaveLength(13);
  });

  afterAll(() => database!.close());

  it("protege movimientos financieros y de stock como historial append-only", async () => {
    const rules = await database!.query<{ tablename: string; trigger_name: string }>(
      `select event_object_table tablename,trigger_name from information_schema.triggers
       where event_object_schema='public' and event_object_table=any($1::text[])
         and trigger_name like '%no_update'`,
      [["payments", "payment_applications", "cash_movements", "stock_movements", "stock_movement_lines"]]
    );
    expect(new Set(rules.map((row) => row.tablename))).toEqual(new Set([
      "payment_applications", "cash_movements", "stock_movements", "stock_movement_lines"
    ]));
    const paymentDelete = await database!.query<{ trigger_name: string }>(
      `select trigger_name from information_schema.triggers
       where event_object_table='payments' and trigger_name='payments_no_delete'`
    );
    expect(paymentDelete).toHaveLength(1);
  });

  it("mantiene unicidad para documentos de proveedor y claves idempotentes", async () => {
    const indexes = await database!.query<{ indexname: string; indexdef: string }>(
      `select indexname,indexdef from pg_indexes
       where schemaname='public' and tablename=any($1::text[])`,
      [["supplier_documents", "idempotency_keys"]]
    );
    expect(indexes.some((row) => row.indexdef.includes("supplier_documents") && row.indexdef.includes("UNIQUE"))).toBe(true);
    expect(indexes.some((row) => row.indexdef.includes("idempotency_keys") && row.indexdef.includes("UNIQUE"))).toBe(true);
  });

  it("instala aislamiento RLS en agregados comerciales sensibles", async () => {
    const policies = await database!.query<{ tablename: string }>(
      `select distinct tablename from pg_policies where schemaname='public'
       and tablename=any($1::text[])`,
      [["parties", "items", "sales", "purchases", "payments", "commercial_documents"]]
    );
    expect(new Set(policies.map((row) => row.tablename))).toEqual(new Set([
      "parties", "items", "sales", "purchases", "payments", "commercial_documents"
    ]));
  });

  it("indexa claves foráneas de consulta operativa", async () => {
    const indexes = await database!.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname='public' and indexname=any($1::text[])`,
      [["quotation_lines_item", "sales_order_lines_item", "sale_lines_item", "purchase_lines_item",
        "payment_applications_reversal", "stock_movements_linked", "payments_reversed_payment"]]
    );
    expect(indexes).toHaveLength(7);
  });
});
