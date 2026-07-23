import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  AuthenticatedContext,
  OcrExtractionResult,
  OcrHumanConfirmation
} from "@erp/contracts";
import { ProviderManagementService } from "../providers/provider-management.service.js";
import { ProviderPolicyError } from "../providers/provider-errors.js";
import { DatabaseService } from "../../database.service.js";
import type { CreateOcrJobInput, OcrReviewInput } from "./ocr.schemas.js";

type OcrJobState = "EXTRACTED_PENDING_REVIEW" | "DRAFT_APPROVED" | "REJECTED";

interface OcrJobRecord {
  readonly id: string;
  readonly extractionId: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly requestedByUserId: string;
  readonly documentId: string;
  readonly contentSha256: string;
  readonly idempotencyKey: string;
  readonly extraction: OcrExtractionResult;
  readonly createdAt: string;
  state: OcrJobState;
  confirmation?: OcrHumanConfirmation;
}

const MAX_OCR_BYTES = 10 * 1024 * 1024;

@Injectable()
export class OcrAssistanceService {
  private readonly jobs = new Map<string, OcrJobRecord>();
  private readonly jobByIdempotencyScope = new Map<string, string>();

  constructor(
    private readonly providers: ProviderManagementService,
    private readonly database: DatabaseService
  ) {}

  async createJob(input: CreateOcrJobInput, auth: AuthenticatedContext, requestId: string): Promise<{
    readonly id: string;
    readonly extractionId: string;
    readonly state: OcrJobState;
    readonly duplicateOf?: string;
    readonly extraction: OcrExtractionResult;
    readonly warning: string;
  }> {
    const content = decodeBase64(input.contentBase64);
    if (content.byteLength > MAX_OCR_BYTES) {
      throw new ProviderPolicyError("OCR_FILE_TOO_LARGE", "El archivo excede el límite de 10 MiB.");
    }
    const digest = createHash("sha256").update(content).digest("hex");
    if (digest !== input.contentSha256) {
      throw new ProviderPolicyError("OCR_HASH_MISMATCH", "El hash declarado no coincide con el archivo.");
    }
    const detectedContentType = detectContentType(content);
    if (detectedContentType !== input.contentType) {
      throw new ProviderPolicyError("OCR_CONTENT_TYPE_MISMATCH", "La firma del archivo no coincide con el tipo declarado.");
    }
    const documentMetadata = await this.database.scopedTransaction(auth, async (client) => {
      const [row] = (await client.query<{
        original_filename: string;
        mime_type: string;
        sha256: string;
        owner_entity_type: string;
      }>(
        `select original_filename,mime_type,sha256,owner_entity_type from documents
         where id=$1 and company_id=$2 and deleted_at is null`,
        [input.documentId, auth.companyId]
      )).rows;
      return row;
    });
    if (!documentMetadata) {
      throw new ProviderPolicyError("OCR_DOCUMENT_NOT_FOUND", "El documento no existe en la empresa activa.");
    }
    if (
      documentMetadata.mime_type !== detectedContentType ||
      documentMetadata.sha256 !== digest ||
      documentMetadata.original_filename !== input.fileName
    ) {
      throw new ProviderPolicyError(
        "OCR_DOCUMENT_METADATA_MISMATCH",
        "El archivo no coincide con los metadatos almacenados del documento."
      );
    }
    const serverDocumentType = documentTypeForOwner(documentMetadata.owner_entity_type);
    if (serverDocumentType === "UNKNOWN" || serverDocumentType !== input.requestedDocumentType) {
      throw new ProviderPolicyError(
        "OCR_DOCUMENT_CLASSIFICATION_UNRESOLVED",
        "El tipo documental no pudo validarse con el registro del servidor."
      );
    }
    const serverDataCategories = categoriesForDocumentType(serverDocumentType);
    if (serverDocumentType === "IDENTITY_DOCUMENT" && !auth.permissions.has("ocr.identity.process")) {
      throw new ProviderPolicyError(
        "OCR_IDENTITY_AUTHORIZATION_REQUIRED",
        "El procesamiento de un documento de identidad requiere un permiso restringido."
      );
    }
    const idempotencyScope = `${auth.tenantId}:${auth.companyId}:${input.idempotencyKey}`;
    const existingId = this.jobByIdempotencyScope.get(idempotencyScope);
    if (existingId) {
      const existing = this.requireScoped(existingId, auth);
      if (existing.contentSha256 !== digest || existing.documentId !== input.documentId) {
        throw new ProviderPolicyError(
          "OCR_IDEMPOTENCY_PAYLOAD_MISMATCH",
          "La clave de idempotencia ya fue utilizada con otro documento."
        );
      }
      return this.responseFor(existing);
    }

    const duplicate = [...this.jobs.values()].find((job) =>
      job.tenantId === auth.tenantId &&
      job.companyId === auth.companyId &&
      job.contentSha256 === digest
    );
    const provider = this.providers.getActiveOcrProvider(auth);
    const extraction = await provider.extract({
      context: {
        tenantId: auth.tenantId,
        companyId: auth.companyId,
        actorUserId: auth.userId,
        requestId,
        correlationId: requestId,
        timeoutMs: 30_000
      },
      documentId: input.documentId,
      fileName: input.fileName,
      requestedDocumentType: serverDocumentType,
      contentType: input.contentType,
      content,
      contentSha256: digest,
      dataCategories: serverDataCategories,
      identityDocumentAuthorized:
        serverDocumentType === "IDENTITY_DOCUMENT" && auth.permissions.has("ocr.identity.process")
    });
    const job: OcrJobRecord = {
      id: randomUUID(),
      extractionId: randomUUID(),
      tenantId: auth.tenantId,
      companyId: auth.companyId,
      requestedByUserId: auth.userId,
      documentId: input.documentId,
      contentSha256: digest,
      idempotencyKey: input.idempotencyKey,
      extraction,
      createdAt: new Date().toISOString(),
      state: "EXTRACTED_PENDING_REVIEW"
    };
    this.jobs.set(job.id, job);
    this.jobByIdempotencyScope.set(idempotencyScope, job.id);
    return {
      ...this.responseFor(job),
      ...(duplicate === undefined ? {} : { duplicateOf: duplicate.id })
    };
  }

  getExtraction(jobId: string, auth: AuthenticatedContext): ReturnType<OcrAssistanceService["responseFor"]> {
    return this.responseFor(this.requireScoped(jobId, auth));
  }

  confirm(jobId: string, input: OcrReviewInput, auth: AuthenticatedContext): {
    readonly jobId: string;
    readonly state: OcrJobState;
    readonly confirmation: OcrHumanConfirmation;
    readonly handoff: { readonly kind: "REVIEWED_DRAFT_ONLY"; readonly recordCreationExecuted: false };
  } {
    const job = this.requireScoped(jobId, auth);
    if (job.state !== "EXTRACTED_PENDING_REVIEW") {
      throw new ProviderPolicyError("OCR_ALREADY_REVIEWED", "La extracción ya fue revisada.");
    }
    const confirmation: OcrHumanConfirmation = {
      extractionId: job.extractionId,
      confirmedByUserId: auth.userId,
      confirmedAt: new Date().toISOString(),
      corrections: input.corrections.map((correction) => ({
        fieldName: correction.fieldName,
        previousValue: correction.previousValue,
        correctedValue: correction.correctedValue,
        ...(correction.reason === undefined ? {} : { reason: correction.reason })
      })),
      outcome: input.outcome
    };
    job.confirmation = confirmation;
    job.state = input.outcome;
    return {
      jobId: job.id,
      state: job.state,
      confirmation,
      handoff: { kind: "REVIEWED_DRAFT_ONLY", recordCreationExecuted: false }
    };
  }

  private requireScoped(jobId: string, auth: AuthenticatedContext): OcrJobRecord {
    const job = this.jobs.get(jobId);
    if (!job || job.tenantId !== auth.tenantId || job.companyId !== auth.companyId) {
      throw new ProviderPolicyError("OCR_JOB_NOT_FOUND", "El trabajo OCR no existe en este ámbito.");
    }
    return job;
  }

  private responseFor(job: OcrJobRecord): {
    readonly id: string;
    readonly extractionId: string;
    readonly state: OcrJobState;
    readonly extraction: OcrExtractionResult;
    readonly warning: string;
  } {
    return {
      id: job.id,
      extractionId: job.extractionId,
      state: job.state,
      extraction: job.extraction,
      warning: "Extracción asistida: requiere revisión y confirmación humana; no crea registros finales."
    };
  }
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new ProviderPolicyError("OCR_BASE64_INVALID", "El contenido no es base64 válido.");
  }
  return Buffer.from(value, "base64");
}

function detectContentType(content: Uint8Array): CreateOcrJobInput["contentType"] | null {
  const bytes = Buffer.from(content);
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes.subarray(1, 4).toString("ascii") === "PNG") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.subarray(4, 12).toString("ascii").includes("ftyphei")) return "image/heic";
  return null;
}

function categoriesForDocumentType(
  documentType: CreateOcrJobInput["requestedDocumentType"]
): CreateOcrJobInput["dataCategories"] {
  if (documentType === "IDENTITY_DOCUMENT") return ["PERSONAL"];
  if (documentType === "SUPPLIER_INVOICE" || documentType === "SUPPLIER_RECEIPT") return ["FINANCIAL"];
  if (documentType === "CONTRACT") return ["INTERNAL", "PERSONAL"];
  return ["INTERNAL"];
}

function documentTypeForOwner(ownerEntityType: string): CreateOcrJobInput["requestedDocumentType"] {
  const normalized = ownerEntityType.trim().toLowerCase();
  if (["supplier-invoice", "supplier-document"].includes(normalized)) return "SUPPLIER_INVOICE";
  if (normalized === "supplier-receipt") return "SUPPLIER_RECEIPT";
  if (["identity-document", "party-identity", "employee-identity"].includes(normalized)) return "IDENTITY_DOCUMENT";
  if (["contract", "employee-contract", "project-contract"].includes(normalized)) return "CONTRACT";
  if (normalized === "purchase-order") return "PURCHASE_ORDER";
  if (normalized === "delivery-evidence") return "DELIVERY_EVIDENCE";
  return "UNKNOWN";
}
