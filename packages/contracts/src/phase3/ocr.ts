import type { AiDataCategory } from "./ai.js";
import type { ProviderInvocationContext, ProviderLifecycle } from "./provider.js";

export const OCR_DOCUMENT_TYPES = [
  "SUPPLIER_RECEIPT",
  "SUPPLIER_INVOICE",
  "IDENTITY_DOCUMENT",
  "CONTRACT",
  "PURCHASE_ORDER",
  "DELIVERY_EVIDENCE",
  "UNKNOWN"
] as const;
export type OcrDocumentType = (typeof OCR_DOCUMENT_TYPES)[number];

export interface OcrExtractionRequest {
  readonly context: ProviderInvocationContext;
  readonly documentId: string;
  readonly fileName: string;
  readonly requestedDocumentType: OcrDocumentType;
  readonly contentType: "application/pdf" | "image/jpeg" | "image/png" | "image/heic";
  readonly content: Uint8Array;
  readonly contentSha256: string;
  readonly dataCategories: readonly AiDataCategory[];
  readonly identityDocumentAuthorized: boolean;
}

export interface OcrBoundingRegion {
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface OcrExtractedField {
  readonly name: string;
  readonly value: string;
  readonly confidence: number;
  readonly sourcePage: number;
  readonly boundingRegion?: OcrBoundingRegion;
}

export interface OcrExtractionResult {
  readonly providerId: string;
  readonly engine: string;
  readonly engineVersion: string;
  readonly documentType: OcrDocumentType;
  readonly plainText: string;
  readonly fields: readonly OcrExtractedField[];
  readonly overallConfidence: number;
  readonly processedAt: string;
  readonly mock: boolean;
  readonly requiresHumanReview: true;
}

export interface OcrProvider extends ProviderLifecycle {
  extract(request: OcrExtractionRequest, signal?: AbortSignal): Promise<OcrExtractionResult>;
}

export interface OcrReviewCorrection {
  readonly fieldName: string;
  readonly previousValue: string;
  readonly correctedValue: string;
  readonly reason?: string;
}

export interface OcrHumanConfirmation {
  readonly extractionId: string;
  readonly confirmedByUserId: string;
  readonly confirmedAt: string;
  readonly corrections: readonly OcrReviewCorrection[];
  readonly outcome: "DRAFT_APPROVED" | "REJECTED";
}
