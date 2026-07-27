/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../packages/database/src/index.js";

/**
 * Prueba de COMPORTAMIENTO de RLS (no de metadatos). Provisiona dos tenants con
 * el rol propietario y luego, conectada con el rol restringido de aplicación
 * (erp_app, sin SUPERUSER ni BYPASSRLS), verifica que:
 *   - sin contexto de tenant, una lectura devuelve 0 filas (deny por defecto);
 *   - con el contexto correcto, se ven los datos propios;
 *   - con el contexto de otro tenant, no se ven datos ajenos;
 *   - una escritura fuera de contexto es rechazada por la política.
 *
 * Esto cierra el hallazgo H-2: antes solo se comprobaba que la política EXISTÍA,
 * nunca que DENEGARA.
 */
const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
// Solo tiene sentido si el rol de aplicación es distinto y restringido.
const enabled = Boolean(ownerUrl && appUrl);

const owner = enabled ? new PostgresDatabase(ownerUrl!) : null;
const app = enabled ? new PostgresDatabase(appUrl!) : null;

const ids = {
  tenantA: randomUUID(),
  tenantB: randomUUID(),
  companyA: randomUUID(),
  companyB: randomUUID(),
  partyA: randomUUID(),
  partyB: randomUUID(),
  wasteA: randomUUID(),
  wasteB: randomUUID()
};

describe.skipIf(!enabled)("aislamiento RLS de comportamiento (erp_app)", () => {
  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);
    await owner!.transaction(async (client) => {
      await client.query(
        `insert into tenants(id,code,name,status) values ($1,$2,$3,'active'),($4,$5,$6,'active')`,
        [ids.tenantA, `rls-a-${suffix}`, "RLS A", ids.tenantB, `rls-b-${suffix}`, "RLS B"]
      );
      await client.query(
        `insert into companies(id,tenant_id,legal_name,ruc,status) values
          ($1,$2,$3,'20911111111','active'),($4,$5,$6,'20922222222','active')`,
        [ids.companyA, ids.tenantA, "RLS Company A", ids.companyB, ids.tenantB, "RLS Company B"]
      );
      await client.query(
        `insert into parties(id,tenant_id,company_id,party_type,document_type,document_number,legal_name,normalized_name,status) values
          ($1,$2,$3,'LEGAL_ENTITY','RUC','20911111111','Cliente A','cliente a','active'),
          ($4,$5,$6,'LEGAL_ENTITY','RUC','20922222222','Cliente B','cliente b','active')`,
        [ids.partyA, ids.tenantA, ids.companyA, ids.partyB, ids.tenantB, ids.companyB]
      );
      await client.query(
        `insert into waste_records(
          id,tenant_id,company_id,source,description,quantity,unit,hazardous,generated_at
        ) values
          ($1,$2,$3,'Área A','Residuo A',1,'KG',false,now()),
          ($4,$5,$6,'Área B','Residuo B',1,'KG',false,now())`,
        [ids.wasteA, ids.tenantA, ids.companyA, ids.wasteB, ids.tenantB, ids.companyB]
      );
    });
  });

  afterAll(async () => {
    await owner?.transaction(async (client) => {
      await client.query("delete from waste_records where id in ($1,$2)", [ids.wasteA, ids.wasteB]);
      await client.query("delete from parties where id in ($1,$2)", [ids.partyA, ids.partyB]);
      await client.query("delete from companies where id in ($1,$2)", [ids.companyA, ids.companyB]);
      await client.query("delete from tenants where id in ($1,$2)", [ids.tenantA, ids.tenantB]);
    });
    await owner?.close();
    await app?.close();
  });

  it("el rol de aplicación no es superusuario ni tiene BYPASSRLS", async () => {
    const [role] = await app!.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "select rolsuper,rolbypassrls from pg_roles where rolname=current_user"
    );
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);
  });

  it("sin contexto de tenant, una lectura devuelve cero filas", async () => {
    const rows = await app!.query<{ id: string }>("select id from parties where id=$1", [ids.partyA]);
    expect(rows.length).toBe(0);
  });

  it("con el contexto correcto, ve sus propios datos", async () => {
    await app!.transaction(async (client) => {
      await client.query("select set_config('app.tenant_id',$1,true),set_config('app.company_id',$2,true)", [
        ids.tenantA,
        ids.companyA
      ]);
      const rows = await client.query("select id from parties where id=$1", [ids.partyA]);
      expect(rows.rows.length).toBe(1);
    });
  });

  it("con el contexto de otro tenant, no ve datos ajenos", async () => {
    await app!.transaction(async (client) => {
      await client.query("select set_config('app.tenant_id',$1,true),set_config('app.company_id',$2,true)", [
        ids.tenantA,
        ids.companyA
      ]);
      const cross = await client.query("select id from parties where id=$1", [ids.partyB]);
      expect(cross.rows.length).toBe(0);
    });
  });

  it("la RLS de residuos también aísla tenant y empresa", async () => {
    await app!.transaction(async (client) => {
      await client.query("select set_config('app.tenant_id',$1,true),set_config('app.company_id',$2,true)", [
        ids.tenantA,
        ids.companyA
      ]);
      const own = await client.query("select id from waste_records where id=$1", [ids.wasteA]);
      const cross = await client.query("select id from waste_records where id=$1", [ids.wasteB]);
      expect(own.rows).toHaveLength(1);
      expect(cross.rows).toHaveLength(0);
    });
  });

  it("la RLS de residuos rechaza escrituras con ámbito ajeno", async () => {
    await expect(
      app!.transaction(async (client) => {
        await client.query("select set_config('app.tenant_id',$1,true),set_config('app.company_id',$2,true)", [
          ids.tenantA,
          ids.companyA
        ]);
        await client.query(
          `insert into waste_records(
            tenant_id,company_id,source,description,quantity,unit,hazardous,generated_at
          ) values($1,$2,'Intruso','Fuera de ámbito',1,'KG',false,now())`,
          [ids.tenantB, ids.companyB]
        );
      })
    ).rejects.toThrow();
  });

  it("una escritura con contexto de tenant ajeno es rechazada por la política", async () => {
    await expect(
      app!.transaction(async (client) => {
        await client.query("select set_config('app.tenant_id',$1,true),set_config('app.company_id',$2,true)", [
          ids.tenantA,
          ids.companyA
        ]);
        // Intenta insertar una parte marcada como del tenant B mientras el
        // contexto es del tenant A: la comprobación WITH CHECK debe rechazarla.
        await client.query(
          `insert into parties(id,tenant_id,company_id,party_type,document_type,document_number,legal_name,normalized_name,status)
           values(gen_random_uuid(),$1,$2,'LEGAL_ENTITY','RUC','20933333333','Intruso','intruso','active')`,
          [ids.tenantB, ids.companyB]
        );
      })
    ).rejects.toThrow();
  });
});
