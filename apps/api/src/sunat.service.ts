import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { ElectronicDocumentPayload } from "@erp/contracts";
import { DatabaseService } from "./database.service.js";
import { ManualElectronicInvoicingProvider, MockElectronicInvoicingProvider, type MockScenario } from "./invoicing.providers.js";
import type { ApiRequest } from "./http.js";
import {
  appendAudit, appendOutboxEvent, beginIdempotentOperation, completeIdempotentOperation, requestHash
} from "./operations.js";

const transitions: Readonly<Record<string, readonly string[]>> = {
  ISSUED: ["PENDING_SUBMISSION", "CANCELLED_INTERNAL"],
  PENDING_SUBMISSION: ["ACCEPTED", "ACCEPTED_WITH_OBSERVATIONS", "REJECTED", "FAILED", "VOID_PENDING"],
  ACCEPTED: ["VOID_PENDING"],
  ACCEPTED_WITH_OBSERVATIONS: ["VOID_PENDING"],
  REJECTED: [],
  FAILED: ["PENDING_SUBMISSION", "REJECTED"],
  VOID_PENDING: ["VOIDED", "FAILED"],
  VOIDED: [],
  CANCELLED_INTERNAL: []
};

@Injectable()
export class SunatService {
  constructor(private readonly database: DatabaseService) {}
  async configuration() {
    const manual = await new ManualElectronicInvoicingProvider().validateConfiguration();
    const mock = await new MockElectronicInvoicingProvider("ACCEPT").validateConfiguration();
    return {
      productionConnected: false,
      warning: "No existe conectividad directa con SUNAT. Use modo manual o demostración.",
      providers: [manual, mock],
      officialLinks: [
        { label: "Portal SUNAT", url: "https://www.sunat.gob.pe/" },
        { label: "Consulta de comprobantes", url: "https://e-consulta.sunat.gob.pe/" }
      ]
    };
  }
  documents(request: ApiRequest, input: { status?: string | undefined; limit: number }) {
    return this.database.query(
      `select cd.id,cd.document_type as "documentType",cd.series,cd.sequential_number as "number",
       cd.issue_date as "issueDate",cd.currency,cd.total::text,cd.status,cd.sunat_provider as "provider",
       cd.sunat_environment as "environment",cd.response_code as "responseCode",
       cd.response_message as "responseMessage",cd.submission_attempts as "submissionAttempts",
       cd.customer_snapshot->>'name' as "customerName"
       from commercial_documents cd where cd.tenant_id=$1 and cd.company_id=$2
       and ($3::text is null or cd.status=$3) order by cd.issue_date desc nulls last,cd.id desc limit $4`,
      [request.auth!.tenantId, request.auth!.companyId, input.status ?? null, input.limit]
    );
  }
  history(request: ApiRequest, documentId: string) {
    return Promise.all([
      this.database.query(
        `select previous_status as "previousStatus",new_status as "newStatus",comment,metadata,
         occurred_at as "occurredAt",actor_user_id as "actorUserId"
         from commercial_document_events where commercial_document_id=$1 and tenant_id=$2 and company_id=$3
         order by occurred_at`,
        [documentId, request.auth!.tenantId, request.auth!.companyId]
      ),
      this.database.query(
        `select provider,scenario,result_status as "resultStatus",response_code as "responseCode",
         response_message as "responseMessage",attempt_number as "attemptNumber",created_at as "createdAt"
         from electronic_submission_attempts where commercial_document_id=$1 and tenant_id=$2 and company_id=$3
         order by attempt_number`,
        [documentId, request.auth!.tenantId, request.auth!.companyId]
      )
    ]).then(([events, attempts]) => ({ events, attempts }));
  }
  async attach(request: ApiRequest, id: string, input: { type: "XML" | "PDF" | "CDR"; documentId: string }) {
    const permission = input.type === "XML" ? "sunat.upload-xml" : input.type === "CDR" ? "sunat.upload-cdr" : "sunat.manual-update";
    if (!request.auth!.permissions.has(permission)) throw new ConflictException("No tiene permiso para adjuntar este archivo.");
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const stored = await client.query<{ mime_type: string }>(
        `select mime_type from documents where id=$1 and tenant_id=$2 and company_id=$3 and deleted_at is null`,
        [input.documentId, request.auth!.tenantId, request.auth!.companyId]
      );
      if (!stored.rows[0]) throw new NotFoundException("El archivo no existe.");
      if (input.type !== "PDF" && !["application/xml", "text/xml"].includes(stored.rows[0].mime_type)) {
        throw new ConflictException(`${input.type} requiere un archivo XML.`);
      }
      if (input.type === "PDF" && stored.rows[0].mime_type !== "application/pdf") {
        throw new ConflictException("La representación requiere un archivo PDF.");
      }
      const column = input.type === "XML" ? "xml_document_id" : input.type === "PDF" ? "pdf_document_id" : "cdr_document_id";
      const result = await client.query(
        `update commercial_documents set ${column}=$4,updated_by=$5,updated_at=now(),version=version+1
         where id=$1 and tenant_id=$2 and company_id=$3 returning id`,
        [id, request.auth!.tenantId, request.auth!.companyId, input.documentId, request.auth!.userId]
      );
      if (!result.rows[0]) throw new NotFoundException("El documento comercial no existe.");
      await appendAudit(client, request, {
        action: `sunat.${input.type.toLowerCase()}.attached`, entityType: "commercial-document",
        entityId: id, newValues: { documentId: input.documentId }
      });
      return { success: true };
    });
  }
  async manualTransition(request: ApiRequest, id: string, input: {
    status: string; comment?: string | undefined; responseCode?: string | undefined;
    responseMessage?: string | undefined; externalReference?: string | undefined; submittedAt?: string | undefined;
  }) {
    const permissionByStatus: Record<string, string> = {
      ACCEPTED: "sunat.mark-accepted", ACCEPTED_WITH_OBSERVATIONS: "sunat.mark-accepted",
      REJECTED: "sunat.mark-rejected", VOIDED: "sunat.mark-voided"
    };
    const permission = permissionByStatus[input.status] ?? "sunat.manual-update";
    if (!request.auth!.permissions.has(permission)) throw new ConflictException("No tiene permiso para ese estado.");
    if (["REJECTED", "VOIDED"].includes(input.status) && !input.comment?.trim()) {
      throw new ConflictException("El rechazo o anulación requiere comentario.");
    }
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const result = await client.query<{ status: string }>(
        `select status from commercial_documents where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const current = result.rows[0];
      if (!current) throw new NotFoundException("El documento comercial no existe.");
      if (!(transitions[current.status] ?? []).includes(input.status)) {
        throw new ConflictException(`Transición SUNAT inválida: ${current.status} → ${input.status}.`);
      }
      await client.query(
        `update commercial_documents set status=$2,response_code=$3,response_message=$4,external_reference=$5,
          submitted_at=coalesce($6::timestamptz,submitted_at),sunat_provider='MANUAL',
          sunat_environment='MANUAL',updated_by=$7,updated_at=now(),version=version+1 where id=$1`,
        [
          id, input.status, input.responseCode ?? null, input.responseMessage ?? null,
          input.externalReference ?? null, input.submittedAt ?? null, request.auth!.userId
        ]
      );
      await client.query(
        `insert into commercial_document_events(tenant_id,company_id,commercial_document_id,
          previous_status,new_status,comment,metadata,actor_user_id)
         values($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
        [
          request.auth!.tenantId, request.auth!.companyId, id, current.status, input.status,
          input.comment?.trim() || null, JSON.stringify({
            responseCode: input.responseCode, responseMessage: input.responseMessage,
            externalReference: input.externalReference, provider: "MANUAL"
          }), request.auth!.userId
        ]
      );
      await appendAudit(client, request, {
        action: `sunat.manual.${input.status.toLowerCase()}`, entityType: "commercial-document",
        entityId: id, previousValues: current, newValues: input
      });
      if (["ACCEPTED", "ACCEPTED_WITH_OBSERVATIONS", "REJECTED"].includes(input.status)) {
        await appendOutboxEvent(client, request, {
          aggregateType: "CommercialDocument", aggregateId: id,
          eventType: input.status === "REJECTED" ? "CommercialDocumentRejected" : "CommercialDocumentAccepted",
          payload: { documentId: id, status: input.status }
        });
      }
      return { id, status: input.status };
    });
  }
  async submitMock(request: ApiRequest, id: string, scenario: MockScenario, key: string) {
    if (process.env.NODE_ENV === "production") throw new ConflictException("El proveedor mock está deshabilitado en producción.");
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "MockElectronicSubmission", key, { id, scenario });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{
        document_type: string; series: string; sequential_number: string; customer_snapshot: Record<string, unknown>;
        currency: string; total: string; status: string; submission_attempts: number;
      }>(
        `select document_type,series,sequential_number::text,customer_snapshot,currency,total::text,status,submission_attempts
         from commercial_documents where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const document = result.rows[0];
      if (!document || !["ISSUED", "FAILED", "PENDING_SUBMISSION"].includes(document.status)) {
        throw new ConflictException("El documento no admite envío de demostración.");
      }
      const contentHash = requestHash(document);
      const payload: ElectronicDocumentPayload = {
        documentId: id, documentType: document.document_type, series: document.series,
        number: Number(document.sequential_number), customer: document.customer_snapshot,
        currency: document.currency, total: document.total, contentHash
      };
      const provider = new MockElectronicInvoicingProvider(scenario);
      let submission: Awaited<ReturnType<typeof provider.submitDocument>>;
      try {
        submission = await provider.submitDocument(payload, key);
      } catch (error) {
        submission = {
          status: "FAILED", externalReference: `MOCK-TIMEOUT-${id.slice(0, 8)}`,
          responseCode: "TIMEOUT", responseMessage: String(error)
        };
      }
      const attempt = document.submission_attempts + 1;
      await client.query(
        `insert into electronic_submission_attempts(tenant_id,company_id,commercial_document_id,
          provider,scenario,request_hash,external_reference,result_status,response_code,response_message,attempt_number)
         values($1,$2,$3,'MOCK',$4,$5,$6,$7,$8,$9,$10)`,
        [
          request.auth!.tenantId, request.auth!.companyId, id, scenario, contentHash,
          submission.externalReference, submission.status, submission.responseCode ?? null,
          submission.responseMessage ?? null, attempt
        ]
      );
      await client.query(
        `update commercial_documents set status=$2,sunat_provider='MOCK',sunat_environment='DEMO',
          content_hash=$3,external_reference=$4,response_code=$5,response_message=$6,
          submission_attempts=$7,submitted_at=now(),updated_by=$8,updated_at=now(),version=version+1 where id=$1`,
        [
          id, submission.status, contentHash, submission.externalReference,
          submission.responseCode ?? null, submission.responseMessage ?? null, attempt, request.auth!.userId
        ]
      );
      await client.query(
        `insert into commercial_document_events(tenant_id,company_id,commercial_document_id,
          previous_status,new_status,comment,metadata,actor_user_id)
         values($1,$2,$3,$4,$5,'Resultado del proveedor de demostración',$6::jsonb,$7)`,
        [
          request.auth!.tenantId, request.auth!.companyId, id, document.status, submission.status,
          JSON.stringify({ scenario, externalReference: submission.externalReference }), request.auth!.userId
        ]
      );
      const response = { id, ...submission, demo: true };
      await appendAudit(client, request, {
        action: "sunat.mock.submitted", entityType: "commercial-document", entityId: id,
        newValues: { scenario, result: submission }
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }
}

