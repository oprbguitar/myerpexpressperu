import { z } from "zod";

export const createOcrJobSchema = z.object({
  documentId: z.string().uuid(),
  requestedDocumentType: z.enum([
    "SUPPLIER_RECEIPT",
    "SUPPLIER_INVOICE",
    "IDENTITY_DOCUMENT",
    "CONTRACT",
    "PURCHASE_ORDER",
    "DELIVERY_EVIDENCE",
    "UNKNOWN"
  ]).default("UNKNOWN"),
  fileName: z.string().trim().min(1).max(180).regex(/^[^\\/]+$/).refine(
    (value) => [...value].every((character) => character.charCodeAt(0) >= 32),
    "El nombre contiene caracteres de control."
  ),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/heic"]),
  contentBase64: z.string().min(4).max(14_000_000),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  dataCategories: z.array(z.enum([
    "PUBLIC",
    "INTERNAL",
    "BUSINESS_CONTACT",
    "PERSONAL",
    "FINANCIAL",
    "MEDICAL",
    "CREDENTIAL",
    "PROVIDER_SECRET"
  ])).max(8),
  identityDocumentAuthorized: z.boolean().default(false),
  idempotencyKey: z.string().min(12).max(100)
}).strict();

export type CreateOcrJobInput = z.infer<typeof createOcrJobSchema>;

export const ocrReviewSchema = z.object({
  corrections: z.array(z.object({
    fieldName: z.string().min(1).max(100),
    previousValue: z.string().max(2_000),
    correctedValue: z.string().max(2_000),
    reason: z.string().max(500).optional()
  }).strict()).max(100),
  outcome: z.enum(["DRAFT_APPROVED", "REJECTED"])
}).strict();

export type OcrReviewInput = z.infer<typeof ocrReviewSchema>;
