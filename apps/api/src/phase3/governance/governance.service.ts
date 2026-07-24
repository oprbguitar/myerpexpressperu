/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseService } from "../../database.service.js";
import type { ApiRequest } from "../../http.js";
import { appendAudit } from "../../operations.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class GovernanceService {
  constructor(private readonly database: DatabaseService) {}

  legalDocuments(request: ApiRequest) {
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(
        `select ld.id,ld.code,ld.title,ld.document_type as "documentType",ld.audience,
           ld.current_version as "currentVersion",ld.status,
           ldv.id as "versionId",ldv.version_number as "versionNumber",
           ldv.effective_from as "effectiveFrom",ldv.acceptance_required as "acceptanceRequired",
           ldv.published_at as "publishedAt",ldv.checksum
         from legal_documents ld
         left join legal_document_versions ldv on ldv.legal_document_id=ld.id
           and ldv.version_number=ld.current_version
         where ld.company_id=$1 order by ld.title limit 100`,
        [request.auth!.companyId]
      )).rows
    );
  }

  createLegalDocument(request: ApiRequest, input: {
    code: string; title: string; documentType: string; audience: string;
    contentMarkdown: string; acceptanceRequired: boolean;
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const documentId = randomUUID();
      const versionId = randomUUID();
      const checksum = sha256(input.contentMarkdown);
      await client.query(
        `insert into legal_documents(
           id,tenant_id,company_id,code,title,document_type,audience,created_by,updated_by
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
        [documentId, request.auth!.tenantId, request.auth!.companyId, input.code, input.title, input.documentType, input.audience, request.auth!.userId]
      );
      const [row] = (await client.query(
        `insert into legal_document_versions(
           id,tenant_id,company_id,legal_document_id,version_number,content_markdown,checksum,
           acceptance_required,created_by,updated_by
         ) values($1,$2,$3,$4,1,$5,$6,$7,$8,$8)
         returning id,legal_document_id as "legalDocumentId",version_number as "versionNumber",
           checksum,acceptance_required as "acceptanceRequired",published_at as "publishedAt"`,
        [versionId, request.auth!.tenantId, request.auth!.companyId, documentId, input.contentMarkdown, checksum, input.acceptanceRequired, request.auth!.userId]
      )).rows;
      await appendAudit(client, request, {
        action: "legal.document.draft-created", entityType: "legal-document",
        entityId: documentId, newValues: { code: input.code, version: 1, checksum }
      });
      return row;
    });
  }

  publishLegalVersion(request: ApiRequest, versionId: string, effectiveFrom: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const result = await client.query<{
        id: string; legal_document_id: string; version_number: number; checksum: string; published_at: Date | null;
      }>(
        `select id,legal_document_id,version_number,checksum,published_at
         from legal_document_versions where id=$1 and company_id=$2 for update`,
        [versionId, request.auth!.companyId]
      );
      const version = result.rows[0];
      if (!version) throw new NotFoundException("Versión legal no encontrada.");
      if (version.published_at) throw new ConflictException("La versión legal ya fue publicada y es inmutable.");
      const [row] = (await client.query(
        `update legal_document_versions set effective_from=$3,published_at=now(),published_by=$4,
           updated_at=now(),updated_by=$4,version=version+1
         where id=$1 and company_id=$2
         returning id,legal_document_id as "legalDocumentId",version_number as "versionNumber",
           effective_from as "effectiveFrom",published_at as "publishedAt",checksum`,
        [versionId, request.auth!.companyId, effectiveFrom, request.auth!.userId]
      )).rows;
      await client.query(
        `update legal_documents set current_version=$2,status='active',updated_at=now(),updated_by=$3,version=version+1
         where id=$1 and company_id=$4`,
        [version.legal_document_id, version.version_number, request.auth!.userId, request.auth!.companyId]
      );
      await appendAudit(client, request, {
        action: "legal.document.published", entityType: "legal-document-version",
        entityId: versionId, newValues: { effectiveFrom, checksum: version.checksum }
      });
      return row;
    });
  }

  recordAcceptance(request: ApiRequest, versionId: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const [version] = (await client.query<{ checksum: string }>(
        `select checksum from legal_document_versions
         where id=$1 and company_id=$2 and published_at is not null`,
        [versionId, request.auth!.companyId]
      )).rows;
      if (!version) throw new NotFoundException("La versión legal no está publicada.");
      const acceptedAt = new Date().toISOString();
      const evidenceHash = sha256([
        versionId, version.checksum, request.auth!.userId, request.auth!.companyId, acceptedAt,
        request.ip, request.headers["user-agent"]?.slice(0, 500) ?? ""
      ].join("|"));
      const id = randomUUID();
      const [row] = (await client.query(
        `insert into legal_acceptances(
           id,tenant_id,company_id,legal_document_version_id,user_id,accepted_at,ip_address,
           user_agent,evidence_hash,created_by,updated_by
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$5,$5)
         returning id,legal_document_version_id as "legalDocumentVersionId",
           accepted_at as "acceptedAt",evidence_hash as "evidenceHash"`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, versionId, request.auth!.userId,
          acceptedAt, request.ip, request.headers["user-agent"]?.slice(0, 500) ?? null, evidenceHash
        ]
      )).rows;
      await appendAudit(client, request, {
        action: "legal.acceptance.recorded", entityType: "legal-acceptance",
        entityId: id, newValues: { versionId, evidenceHash }
      });
      return row;
    });
  }

  acceptanceHistory(request: ApiRequest) {
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(
        `select la.id,ld.title,ldv.version_number as "versionNumber",la.accepted_at as "acceptedAt",
           status.revoked_at as "revokedAt",status.active,la.evidence_hash as "evidenceHash"
         from legal_acceptances la
         join legal_acceptance_effective_status status on status.legal_acceptance_id=la.id
         join legal_document_versions ldv on ldv.id=la.legal_document_version_id
         join legal_documents ld on ld.id=ldv.legal_document_id
         where la.company_id=$1 and la.user_id=$2 order by la.accepted_at desc`,
        [request.auth!.companyId, request.auth!.userId]
      )).rows
    );
  }

  revokeAcceptance(request: ApiRequest, acceptanceId: string, reason: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const [acceptance] = (await client.query<{ id: string; evidence_hash: string }>(
        `select id,evidence_hash from legal_acceptances
         where id=$1 and company_id=$2 and user_id=$3`,
        [acceptanceId, request.auth!.companyId, request.auth!.userId]
      )).rows;
      if (!acceptance) throw new NotFoundException("Aceptación legal no encontrada.");
      const evidenceHash = sha256([acceptance.id, acceptance.evidence_hash, reason, request.auth!.userId].join("|"));
      const [row] = (await client.query(
        `insert into legal_acceptance_revocations(
           tenant_id,company_id,legal_acceptance_id,reason,revoked_by,evidence_hash,created_by
         ) values($1,$2,$3,$4,$5,$6,$5)
         returning id,legal_acceptance_id as "legalAcceptanceId",revoked_at as "revokedAt",evidence_hash as "evidenceHash"`,
        [request.auth!.tenantId, request.auth!.companyId, acceptanceId, reason, request.auth!.userId, evidenceHash]
      )).rows;
      await appendAudit(client, request, {
        action: "legal.acceptance.revoked", entityType: "legal-acceptance",
        entityId: acceptanceId, newValues: { evidenceHash }
      });
      return row;
    });
  }

  consents(request: ApiRequest) {
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(
        `select cr.id,cp.code,cp.name,cv.version_number as "versionNumber",cr.granted,
           cr.recorded_at as "recordedAt",status.withdrawn_at as "withdrawnAt",status.active,
           cr.evidence_hash as "evidenceHash"
         from consent_records cr
         join consent_record_effective_status status on status.consent_record_id=cr.id
         join consent_versions cv on cv.id=cr.consent_version_id
         join consent_purposes cp on cp.id=cv.consent_purpose_id
         where cr.company_id=$1 and cr.data_subject_type='user' and cr.data_subject_id=$2
         order by cr.recorded_at desc`,
        [request.auth!.companyId, request.auth!.userId]
      )).rows
    );
  }

  withdrawConsent(request: ApiRequest, consentRecordId: string, reason?: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const [consent] = (await client.query<{ id: string; evidence_hash: string }>(
        `select id,evidence_hash from consent_records
         where id=$1 and company_id=$2 and data_subject_type='user' and data_subject_id=$3`,
        [consentRecordId, request.auth!.companyId, request.auth!.userId]
      )).rows;
      if (!consent) throw new NotFoundException("Consentimiento no encontrado.");
      const evidenceHash = sha256([
        consent.id, consent.evidence_hash, reason ?? "", request.auth!.userId
      ].join("|"));
      const [row] = (await client.query(
        `insert into consent_withdrawals(
           tenant_id,company_id,consent_record_id,reason,withdrawn_by,evidence_hash,created_by
         ) values($1,$2,$3,$4,$5,$6,$5)
         returning id,consent_record_id as "consentRecordId",withdrawn_at as "withdrawnAt",
           evidence_hash as "evidenceHash"`,
        [
          request.auth!.tenantId, request.auth!.companyId, consentRecordId,
          reason ?? null, request.auth!.userId, evidenceHash
        ]
      )).rows;
      await appendAudit(client, request, {
        action: "privacy.consent.withdrawn", entityType: "consent-record",
        entityId: consentRecordId, newValues: { evidenceHash }
      });
      return row;
    });
  }

  recordConsent(request: ApiRequest, input: { consentVersionId: string; granted: boolean; source: string }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const [version] = (await client.query<{ checksum: string }>(
        "select checksum from consent_versions where id=$1 and company_id=$2 and effective_from<=now()",
        [input.consentVersionId, request.auth!.companyId]
      )).rows;
      if (!version) throw new NotFoundException("Versión de consentimiento no disponible.");
      const recordedAt = new Date().toISOString();
      const evidenceHash = sha256([
        input.consentVersionId, version.checksum, request.auth!.userId,
        String(input.granted), input.source, recordedAt
      ].join("|"));
      const id = randomUUID();
      const [row] = (await client.query(
        `insert into consent_records(
           id,tenant_id,company_id,consent_version_id,data_subject_type,data_subject_id,
           granted,recorded_at,source,evidence_hash,created_by,updated_by
         ) values($1,$2,$3,$4,'user',$5,$6,$7,$8,$9,$5,$5)
         returning id,consent_version_id as "consentVersionId",granted,
           recorded_at as "recordedAt",evidence_hash as "evidenceHash"`,
        [id, request.auth!.tenantId, request.auth!.companyId, input.consentVersionId, request.auth!.userId, input.granted, recordedAt, input.source, evidenceHash]
      )).rows;
      await appendAudit(client, request, {
        action: input.granted ? "privacy.consent.granted" : "privacy.consent.refused",
        entityType: "consent-record", entityId: id, newValues: { evidenceHash }
      });
      return row;
    });
  }

  privacyRequests(request: ApiRequest) {
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(
        `select id,request_number as "requestNumber",request_type as "requestType",
           received_at as "receivedAt",due_at as "dueAt",status,response_summary as "responseSummary",version
         from privacy_requests where company_id=$1 order by received_at desc,id desc limit 100`,
        [request.auth!.companyId]
      )).rows
    );
  }

  createPrivacyRequest(request: ApiRequest, input: {
    requestType: string; dataSubjectType: string; dataSubjectReference: string;
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const id = randomUUID();
      const requestNumber = `PR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`;
      const [row] = (await client.query(
        `insert into privacy_requests(
           id,tenant_id,company_id,request_number,request_type,data_subject_type,
           data_subject_reference,created_by,updated_by
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$8)
         returning id,request_number as "requestNumber",request_type as "requestType",
           received_at as "receivedAt",status,version`,
        [id, request.auth!.tenantId, request.auth!.companyId, requestNumber, input.requestType, input.dataSubjectType, input.dataSubjectReference, request.auth!.userId]
      )).rows;
      await appendAudit(client, request, {
        action: "privacy.request.created", entityType: "privacy-request",
        entityId: id, newValues: { requestNumber, requestType: input.requestType }
      });
      return row;
    });
  }

  retentionRules(request: ApiRequest) {
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(
        `select id,code,resource_type as "resourceType",retention_days as "retentionDays",
           action,legal_basis as "legalBasis",status,version
         from retention_rules where company_id=$1 order by code`,
        [request.auth!.companyId]
      )).rows
    );
  }

  legalHolds(request: ApiRequest) {
    return this.database.scopedTransaction(request.auth!, async (client) =>
      (await client.query(
        `select id,code,reason,resource_type as "resourceType",resource_id as "resourceId",
           starts_at as "startsAt",ends_at as "endsAt",status,approved_by as "approvedBy",version
         from legal_holds where company_id=$1 order by starts_at desc`,
        [request.auth!.companyId]
      )).rows
    );
  }

  health(request: ApiRequest) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const [database, providers, securityEvents, jobs] = await Promise.all([
        client.query<{ checkedAt: Date }>('select now() as "checkedAt"'),
        client.query(
          `select pd.code,pd.capability,coalesce(ph.status,'disabled') status,
             ph.checked_at as "checkedAt",ph.latency_ms as "latencyMs"
           from provider_definitions pd left join lateral(
             select status,checked_at,latency_ms from provider_health_checks ph
             join provider_configurations pc on pc.id=ph.provider_configuration_id
             where pc.provider_definition_id=pd.id order by ph.checked_at desc limit 1
           ) ph on true where pd.company_id=$1 order by pd.code`,
          [request.auth!.companyId]
        ),
        client.query<{ count: string }>(
          "select count(*)::text count from security_events where company_id=$1 and occurred_at>=now()-interval '24 hours'",
          [request.auth!.companyId]
        ),
        client.query<{ pending: string }>(
          `select (
             (select count(*) from ocr_jobs where company_id=$1 and status in ('queued','processing')) +
             (select count(*) from workflow_executions where company_id=$1 and status in ('queued','running'))
           )::text pending`,
          [request.auth!.companyId]
        )
      ]);
      return {
        status: "ok",
        database: database.rows[0],
        providers: providers.rows,
        securityEvents24h: securityEvents.rows[0]?.count ?? "0",
        pendingJobs: jobs.rows[0]?.pending ?? "0"
      };
    });
  }
}
