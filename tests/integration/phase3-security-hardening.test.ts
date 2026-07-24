/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../packages/database/src/index.js";

// Estas pruebas verifican restricciones de esquema (claves foráneas compuestas,
// triggers de solo-anexado), no aislamiento RLS. Provisionan datos de varios
// tenants, por lo que usan el rol propietario (DATABASE_MIGRATION_URL). El
// aislamiento RLS se prueba por separado en rls-isolation.test.ts con erp_app.
const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
const enabled = Boolean(ownerUrl);
const database = enabled ? new PostgresDatabase(ownerUrl!) : null;

interface TestScopes {
  tenantA: string;
  tenantB: string;
  companyA: string;
  companyB: string;
  userA: string;
  userB: string;
}

async function createScopes(client: PoolClient): Promise<TestScopes> {
  const values: TestScopes = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    companyA: randomUUID(),
    companyB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID()
  };
  const suffix = randomUUID().slice(0, 8);
  await client.query(
    `insert into tenants(id,code,name,status) values
      ($1,$2,$3,'active'),($4,$5,$6,'active')`,
    [values.tenantA, `hard-a-${suffix}`, "Hardening A", values.tenantB, `hard-b-${suffix}`, "Hardening B"]
  );
  await client.query(
    `insert into companies(id,tenant_id,legal_name,ruc,status) values
      ($1,$2,$3,'20999999991','active'),($4,$5,$6,'20999999992','active')`,
    [values.companyA, values.tenantA, "Hardening Company A", values.companyB, values.tenantB, "Hardening Company B"]
  );
  await client.query(
    `insert into users(id,tenant_id,email,password_hash,force_password_change,status) values
      ($1,$2,$3,'test-only',false,'active'),($4,$5,$6,'test-only',false,'active')`,
    [
      values.userA, values.tenantA, `hard-a-${suffix}@example.invalid`,
      values.userB, values.tenantB, `hard-b-${suffix}@example.invalid`
    ]
  );
  return values;
}

async function expectRejected(
  client: PoolClient,
  query: string,
  values: readonly unknown[]
): Promise<void> {
  await client.query("savepoint expected_rejection");
  let rejected = false;
  try {
    await client.query(query, [...values]);
  } catch {
    rejected = true;
  }
  await client.query("rollback to savepoint expected_rejection");
  expect(rejected).toBe(true);
}

describe.skipIf(!enabled)("endurecimiento de ámbito e historia de fase 3", () => {
  afterAll(() => database!.close());

  it("instala claves compuestas para todas las relaciones sensibles exigidas", async () => {
    const expected = [
      "occupational_exam_medical_details_exam_scope_fk",
      "provider_configurations_definition_scope_fk",
      "ocr_jobs_document_scope_fk",
      "legal_acceptances_version_scope_fk",
      "consent_records_version_scope_fk",
      "demo_reset_jobs_profile_scope_fk",
      "demo_reset_jobs_snapshot_scope_fk"
    ];
    const rows = await database!.query<{ conname: string }>(
      `select conname from pg_constraint where conname=any($1::text[])`,
      [expected]
    );
    expect(new Set(rows.map((row) => row.conname))).toEqual(new Set(expected));
    const views = await database!.query<{ relname: string; reloptions: string[] | null }>(
      `select relname,reloptions from pg_class
       where relname=any($1::text[]) and relkind='v'`,
      [["legal_acceptance_effective_status", "consent_record_effective_status"]]
    );
    expect(views).toHaveLength(2);
    expect(views.every((view) => view.reloptions?.includes("security_invoker=true"))).toBe(true);
  });

  it("rechaza referencias cruzadas entre empresas en límites críticos", async () => {
    const client = await database!.pool.connect();
    try {
      await client.query("begin");
      const scope = await createScopes(client);

      const documentId = randomUUID();
      await client.query(
        `insert into documents(
          id,tenant_id,company_id,storage_key,original_filename,normalized_filename,
          mime_type,size_bytes,sha256,owner_entity_type,uploaded_by
        ) values($1,$2,$3,$4,'test.pdf','test.pdf','application/pdf',10,$5,'test',$6)`,
        [documentId, scope.tenantA, scope.companyA, `hardening/${documentId}`, "a".repeat(64), scope.userA]
      );
      await expectRejected(
        client,
        `insert into ocr_jobs(tenant_id,company_id,document_id,provider_code,requested_by,document_classification)
         values($1,$2,$3,'mock',$4,'internal')`,
        [scope.tenantB, scope.companyB, documentId, scope.userB]
      );

      const providerId = randomUUID();
      await client.query(
        `insert into provider_definitions(id,tenant_id,company_id,code,name,capability,adapter_type)
         values($1,$2,$3,'mock-provider','Mock provider','ocr','mock')`,
        [providerId, scope.tenantA, scope.companyA]
      );
      await expectRejected(
        client,
        `insert into provider_configurations(
          tenant_id,company_id,provider_definition_id,configuration_name,secret_reference
        ) values($1,$2,$3,'cross-scope','secret/test')`,
        [scope.tenantB, scope.companyB, providerId]
      );

      const employeeId = randomUUID();
      const examId = randomUUID();
      await client.query(
        `insert into employees(id,tenant_id,company_id,employee_code,first_name,last_name,hire_date)
         values($1,$2,$3,'EMP-A','Test','Employee',current_date)`,
        [employeeId, scope.tenantA, scope.companyA]
      );
      await client.query(
        `insert into occupational_exams(id,tenant_id,company_id,employee_id,exam_type)
         values($1,$2,$3,$4,'entry')`,
        [examId, scope.tenantA, scope.companyA, employeeId]
      );
      await expectRejected(
        client,
        `insert into occupational_exam_medical_details(
          tenant_id,company_id,occupational_exam_id,encrypted_payload,encryption_key_reference
        ) values($1,$2,$3,$4,'kms/test')`,
        [scope.tenantB, scope.companyB, examId, Buffer.from("ciphertext")]
      );

      const legalDocumentId = randomUUID();
      const legalVersionId = randomUUID();
      await client.query(
        `insert into legal_documents(id,tenant_id,company_id,code,title,document_type)
         values($1,$2,$3,'terms-test','Terms','terms')`,
        [legalDocumentId, scope.tenantA, scope.companyA]
      );
      await client.query(
        `insert into legal_document_versions(
          id,tenant_id,company_id,legal_document_id,version_number,content_markdown,checksum
        ) values($1,$2,$3,$4,1,'Draft',$5)`,
        [legalVersionId, scope.tenantA, scope.companyA, legalDocumentId, "b".repeat(64)]
      );
      await expectRejected(
        client,
        `insert into legal_acceptances(
          tenant_id,company_id,legal_document_version_id,user_id,evidence_hash
        ) values($1,$2,$3,$4,$5)`,
        [scope.tenantB, scope.companyB, legalVersionId, scope.userB, "c".repeat(64)]
      );

      const purposeId = randomUUID();
      const consentVersionId = randomUUID();
      await client.query(
        `insert into consent_purposes(
          id,tenant_id,company_id,code,name,description,lawful_basis
        ) values($1,$2,$3,'analytics','Analytics','Test purpose','consent')`,
        [purposeId, scope.tenantA, scope.companyA]
      );
      await client.query(
        `insert into consent_versions(
          id,tenant_id,company_id,consent_purpose_id,version_number,notice_text,checksum,effective_from
        ) values($1,$2,$3,$4,1,'Notice',$5,now())`,
        [consentVersionId, scope.tenantA, scope.companyA, purposeId, "d".repeat(64)]
      );
      await expectRejected(
        client,
        `insert into consent_records(
          tenant_id,company_id,consent_version_id,data_subject_type,data_subject_id,granted,source,evidence_hash
        ) values($1,$2,$3,'user',$4,true,'test',$5)`,
        [scope.tenantB, scope.companyB, consentVersionId, scope.userB, "e".repeat(64)]
      );

      const demoProfileId = randomUUID();
      const demoSnapshotId = randomUUID();
      await client.query(
        `insert into demo_profiles(
          id,tenant_id,company_id,code,name,data_disclaimer,environment_fingerprint,status,reset_enabled
        ) values($1,$2,$3,'scope-test','Scope test','Synthetic',$4,'active',true)`,
        [demoProfileId, scope.tenantA, scope.companyA, "hardening-fingerprint-a"]
      );
      await client.query(
        `insert into demo_snapshots(
          id,tenant_id,company_id,demo_profile_id,storage_reference,checksum,database_version
        ) values($1,$2,$3,$4,'snapshot/test',$5,'0011')`,
        [demoSnapshotId, scope.tenantA, scope.companyA, demoProfileId, "f".repeat(64)]
      );
      await client.query("set local app.environment='demo'");
      await client.query("set local app.demo_reset_enabled='true'");
      await client.query("set local app.environment_fingerprint='hardening-fingerprint-a'");
      await expectRejected(
        client,
        `insert into demo_reset_jobs(
          tenant_id,company_id,demo_profile_id,snapshot_id,requested_by,confirmation_phrase,
          environment_name,environment_fingerprint
        ) values($1,$2,$3,$4,$5,'RESET DEMO DATA','demo','hardening-fingerprint-a')`,
        [scope.tenantB, scope.companyB, demoProfileId, demoSnapshotId, scope.userB]
      );
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("registra revocación y retiro sin modificar la historia original", async () => {
    const client = await database!.pool.connect();
    try {
      await client.query("begin");
      const scope = await createScopes(client);
      const legalDocumentId = randomUUID();
      const legalVersionId = randomUUID();
      const acceptanceId = randomUUID();
      await client.query(
        `insert into legal_documents(id,tenant_id,company_id,code,title,document_type)
         values($1,$2,$3,'terms-events','Terms','terms')`,
        [legalDocumentId, scope.tenantA, scope.companyA]
      );
      await client.query(
        `insert into legal_document_versions(
          id,tenant_id,company_id,legal_document_id,version_number,content_markdown,checksum
        ) values($1,$2,$3,$4,1,'Draft',$5)`,
        [legalVersionId, scope.tenantA, scope.companyA, legalDocumentId, "1".repeat(64)]
      );
      await client.query(
        `insert into legal_acceptances(
          id,tenant_id,company_id,legal_document_version_id,user_id,evidence_hash
        ) values($1,$2,$3,$4,$5,$6)`,
        [acceptanceId, scope.tenantA, scope.companyA, legalVersionId, scope.userA, "2".repeat(64)]
      );
      await expectRejected(
        client,
        `insert into legal_acceptance_revocations(
          tenant_id,company_id,legal_acceptance_id,reason,revoked_by
        ) values($1,$2,$3,'Cross-company revocation',$4)`,
        [scope.tenantB, scope.companyB, acceptanceId, scope.userB]
      );
      const revocation = await client.query<{ id: string }>(
        `insert into legal_acceptance_revocations(
          tenant_id,company_id,legal_acceptance_id,reason,revoked_by
        ) values($1,$2,$3,'User requested revocation',$4) returning id`,
        [scope.tenantA, scope.companyA, acceptanceId, scope.userA]
      );
      await expectRejected(
        client,
        "update legal_acceptances set revoked_at=now() where id=$1",
        [acceptanceId]
      );
      await expectRejected(
        client,
        "update legal_acceptance_revocations set reason='Tampered reason' where id=$1",
        [revocation.rows[0]!.id]
      );
      const acceptanceStatus = await client.query<{ active: boolean }>(
        "select active from legal_acceptance_effective_status where legal_acceptance_id=$1",
        [acceptanceId]
      );
      expect(acceptanceStatus.rows[0]?.active).toBe(false);

      const purposeId = randomUUID();
      const consentVersionId = randomUUID();
      const consentRecordId = randomUUID();
      await client.query(
        `insert into consent_purposes(
          id,tenant_id,company_id,code,name,description,lawful_basis
        ) values($1,$2,$3,'events','Events','Test purpose','consent')`,
        [purposeId, scope.tenantA, scope.companyA]
      );
      await client.query(
        `insert into consent_versions(
          id,tenant_id,company_id,consent_purpose_id,version_number,notice_text,checksum,effective_from
        ) values($1,$2,$3,$4,1,'Notice',$5,now())`,
        [consentVersionId, scope.tenantA, scope.companyA, purposeId, "3".repeat(64)]
      );
      await client.query(
        `insert into consent_records(
          id,tenant_id,company_id,consent_version_id,data_subject_type,data_subject_id,granted,source,evidence_hash
        ) values($1,$2,$3,$4,'user',$5,true,'test',$6)`,
        [consentRecordId, scope.tenantA, scope.companyA, consentVersionId, scope.userA, "4".repeat(64)]
      );
      await expectRejected(
        client,
        `insert into consent_withdrawals(
          tenant_id,company_id,consent_record_id,reason,withdrawn_by
        ) values($1,$2,$3,'Cross-company withdrawal',$4)`,
        [scope.tenantB, scope.companyB, consentRecordId, scope.userB]
      );
      const withdrawal = await client.query<{ id: string }>(
        `insert into consent_withdrawals(
          tenant_id,company_id,consent_record_id,reason,withdrawn_by
        ) values($1,$2,$3,'User withdrew consent',$4) returning id`,
        [scope.tenantA, scope.companyA, consentRecordId, scope.userA]
      );
      await expectRejected(
        client,
        "update consent_records set withdrawn_at=now() where id=$1",
        [consentRecordId]
      );
      await expectRejected(
        client,
        "delete from consent_withdrawals where id=$1",
        [withdrawal.rows[0]!.id]
      );
      const consentStatus = await client.query<{ active: boolean }>(
        "select active from consent_record_effective_status where consent_record_id=$1",
        [consentRecordId]
      );
      expect(consentStatus.rows[0]?.active).toBe(false);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
