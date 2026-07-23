export const DATA_CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"] as const;

export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export const DATA_KINDS = [
  "general",
  "business-contact",
  "personal",
  "sensitive",
  "medical",
  "credential",
  "provider-secret",
  "audit"
] as const;

export type DataKind = (typeof DATA_KINDS)[number];

const classificationByKind: Readonly<Record<DataKind, DataClassification>> = {
  general: "internal",
  "business-contact": "confidential",
  personal: "confidential",
  sensitive: "restricted",
  medical: "restricted",
  credential: "restricted",
  "provider-secret": "restricted",
  audit: "confidential"
};

const fieldRules: ReadonlyArray<readonly [RegExp, DataKind]> = [
  [/password|passphrase|authorization|cookie|api[_-]?key|access[_-]?token|refresh[_-]?token/i, "credential"],
  [/secret|private[_-]?key|client[_-]?secret/i, "provider-secret"],
  [/diagnos|medical|salud|health|biometric|disability|incapacidad|blood/i, "medical"],
  [/dni|document[_-]?number|ruc|passport|birth|address|phone|email|location|latitude|longitude/i, "personal"],
  [/audit|before|after|user[_-]?agent|ip[_-]?address/i, "audit"]
];

export function classificationForDataKind(kind: DataKind): DataClassification {
  return classificationByKind[kind];
}

export function inferDataKind(fieldName: string): DataKind {
  for (const [pattern, kind] of fieldRules) {
    if (pattern.test(fieldName)) return kind;
  }
  return "general";
}

export interface ExternalProcessingRequest {
  readonly classification: DataClassification;
  readonly providerApproved: boolean;
  readonly purposeApproved: boolean;
  readonly minimised: boolean;
  readonly redacted: boolean;
}

export type ExternalProcessingDenial =
  | "RESTRICTED_DATA"
  | "PROVIDER_NOT_APPROVED"
  | "PURPOSE_NOT_APPROVED"
  | "NOT_MINIMISED"
  | "NOT_REDACTED";

export type ExternalProcessingDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: ExternalProcessingDenial };

export function authorizeExternalProcessing(request: ExternalProcessingRequest): ExternalProcessingDecision {
  if (request.classification === "restricted") return { allowed: false, reason: "RESTRICTED_DATA" };
  if (!request.providerApproved) return { allowed: false, reason: "PROVIDER_NOT_APPROVED" };
  if (!request.purposeApproved) return { allowed: false, reason: "PURPOSE_NOT_APPROVED" };
  if (!request.minimised) return { allowed: false, reason: "NOT_MINIMISED" };
  if (request.classification === "confidential" && !request.redacted) {
    return { allowed: false, reason: "NOT_REDACTED" };
  }
  return { allowed: true };
}
