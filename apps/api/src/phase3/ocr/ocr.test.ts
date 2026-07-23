import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AuthenticatedContext } from "@erp/contracts";
import type { DatabaseService } from "../../database.service.js";
import { MockOcrProvider } from "../providers/ocr-providers.js";
import { ProviderManagementService } from "../providers/provider-management.service.js";
import { OcrAssistanceService } from "./ocr.service.js";

const auth: AuthenticatedContext = {
  userId: "reviewer",
  tenantId: "tenant-1",
  companyId: "company-1",
  branchIds: [],
  permissions: new Set(["ocr.execute", "ocr.review", "ocr.confirm"]),
  sessionId: "session",
  forcePasswordChange: false
};

describe("pipeline OCR asistido", () => {
  it("es idempotente y sólo produce un borrador confirmado por una persona", async () => {
    const providers = new ProviderManagementService();
    providers.register({
      id: "ocr-mock",
      category: "OCR",
      displayName: "Mock",
      mode: "MOCK",
      capabilities: ["extract"],
      affectedModules: ["ocr"],
      adapter: new MockOcrProvider(),
      tenantId: auth.tenantId,
      companyId: auth.companyId
    });
    providers.activate("ocr-mock", {
      appEnvironment: "test",
      productionConfirmation: false,
      tenantId: auth.tenantId,
      companyId: auth.companyId
    });
    const content = Buffer.from("%PDF-1.7\nsynthetic document");
    const digest = createHash("sha256").update(content).digest("hex");
    const service = new OcrAssistanceService(
      providers,
      documentDatabase("factura-demo.pdf", "application/pdf", digest, "supplier-invoice")
    );
    const request = {
      documentId: "79af4083-ece1-47f8-83f7-d3fbcd123c88",
      requestedDocumentType: "SUPPLIER_INVOICE" as const,
      fileName: "factura-demo.pdf",
      contentType: "application/pdf" as const,
      contentBase64: content.toString("base64"),
      contentSha256: digest,
      dataCategories: ["FINANCIAL" as const],
      identityDocumentAuthorized: false,
      idempotencyKey: "idempotency-0001"
    };
    const first = await service.createJob(request, auth, "request");
    const replay = await service.createJob(request, auth, "request");
    expect(replay.id).toBe(first.id);
    expect(first.extraction.requiresHumanReview).toBe(true);
    const confirmation = service.confirm(first.id, {
      corrections: [],
      outcome: "DRAFT_APPROVED"
    }, auth);
    expect(confirmation.handoff).toEqual({ kind: "REVIEWED_DRAFT_ONLY", recordCreationExecuted: false });
    expect(confirmation.confirmation.confirmedByUserId).toBe(auth.userId);
  });

  it("rechaza documentos de identidad sin el permiso restringido derivado del servidor", async () => {
    const content = Buffer.from("%PDF-1.7\nidentity");
    const digest = createHash("sha256").update(content).digest("hex");
    const service = new OcrAssistanceService(
      new ProviderManagementService(),
      documentDatabase("restricted.pdf", "application/pdf", digest, "identity-document")
    );
    await expect(service.createJob({
      documentId: "17f6f07f-8d33-47a2-9b03-fbe831fe822f",
      requestedDocumentType: "IDENTITY_DOCUMENT",
      fileName: "restricted.pdf",
      contentType: "application/pdf",
      contentBase64: content.toString("base64"),
      contentSha256: digest,
      dataCategories: ["INTERNAL"],
      identityDocumentAuthorized: true,
      idempotencyKey: "idempotency-0002"
    }, auth, "request")).rejects.toMatchObject({ code: "OCR_IDENTITY_AUTHORIZATION_REQUIRED" });
  });

  it("rechaza una clasificación declarada que no pueda verificarse en el documento almacenado", async () => {
    const content = Buffer.from("%PDF-1.7\nunclassified");
    const digest = createHash("sha256").update(content).digest("hex");
    const service = new OcrAssistanceService(
      new ProviderManagementService(),
      documentDatabase("unknown.pdf", "application/pdf", digest, "generic-upload")
    );
    await expect(service.createJob({
      documentId: "b05522db-e191-46b7-8105-2da61df630e5",
      requestedDocumentType: "SUPPLIER_INVOICE",
      fileName: "unknown.pdf",
      contentType: "application/pdf",
      contentBase64: content.toString("base64"),
      contentSha256: digest,
      dataCategories: ["INTERNAL"],
      identityDocumentAuthorized: false,
      idempotencyKey: "idempotency-0003"
    }, auth, "request")).rejects.toMatchObject({ code: "OCR_DOCUMENT_CLASSIFICATION_UNRESOLVED" });
  });
});

function documentDatabase(
  originalFilename: string,
  mimeType: string,
  sha256: string,
  ownerEntityType: string
): DatabaseService {
  return {
    scopedTransaction: (_auth: AuthenticatedContext, operation: (client: {
      query: () => Promise<{ rows: unknown[] }>;
    }) => Promise<unknown>) => operation({
      query: () => Promise.resolve({
        rows: [{
          original_filename: originalFilename,
          mime_type: mimeType,
          sha256,
          owner_entity_type: ownerEntityType
        }]
      })
    })
  } as unknown as DatabaseService;
}
