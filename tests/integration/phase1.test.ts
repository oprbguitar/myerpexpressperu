import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../packages/database/src/index.js";

const enabled = Boolean(process.env.DATABASE_URL);
const database = enabled ? new PostgresDatabase(process.env.DATABASE_URL!) : null;

describe.skipIf(!enabled)("aislamiento y migraciones", () => {
  beforeAll(async () => {
    const [row] = await database!.query<{ exists: boolean }>(
      "select exists(select 1 from information_schema.tables where table_name='audit_events')"
    );
    expect(row?.exists).toBe(true);
  });
  afterAll(() => database!.close());
  it("mantiene RUC único dentro del tenant", async () => {
    const constraints = await database!.query<{ constraint_name: string }>(
      `select constraint_name from information_schema.table_constraints
       where table_name='companies' and constraint_type='UNIQUE'`
    );
    expect(constraints.length).toBeGreaterThan(0);
  });
  it("protege auditoría contra actualización normal", async () => {
    const rules = await database!.query<{ rulename: string }>(
      "select rulename from pg_rules where tablename='audit_events'"
    );
    expect(rules.map((row) => row.rulename)).toContain("audit_no_update");
  });
  it("instala políticas de aislamiento por tenant y empresa", async () => {
    const policies = await database!.query<{ policyname: string }>(
      `select policyname from pg_policies
       where schemaname='public' and tablename in ('companies','branches','documents','audit_events')`
    );
    expect(policies.map((row) => row.policyname)).toEqual(
      expect.arrayContaining([
        "company_tenant_isolation",
        "branch_company_isolation",
        "document_company_isolation",
        "audit_company_isolation"
      ])
    );
  });
});
