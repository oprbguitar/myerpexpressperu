import type { ProviderInvocationContext, ProviderLifecycle } from "./provider.js";

export const AI_DATA_CATEGORIES = [
  "PUBLIC",
  "INTERNAL",
  "BUSINESS_CONTACT",
  "PERSONAL",
  "FINANCIAL",
  "MEDICAL",
  "CREDENTIAL",
  "PROVIDER_SECRET"
] as const;
export type AiDataCategory = (typeof AI_DATA_CATEGORIES)[number];

export interface AiCitation {
  readonly sourceId: string;
  readonly label: string;
  readonly sourceType: "TOOL" | "DOCUMENT" | "SYSTEM_RECORD";
  readonly retrievedAt: string;
}

export interface AiUntrustedDocumentContext {
  readonly sourceId: string;
  readonly content: string;
  readonly trust: "UNTRUSTED_DOCUMENT_CONTENT";
  readonly dataCategories: readonly AiDataCategory[];
}

export interface AiCompletionRequest {
  readonly context: ProviderInvocationContext;
  readonly systemInstruction: string;
  readonly userPrompt: string;
  readonly supportingContext: readonly AiUntrustedDocumentContext[];
  readonly maximumOutputTokens: number;
  readonly allowedDataCategories: readonly AiDataCategory[];
}

export interface AiCompletionResult {
  readonly providerId: string;
  readonly model: string;
  readonly content: string;
  readonly citations: readonly AiCitation[];
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly mock: boolean;
  readonly completedAt: string;
}

export interface EmbeddingRequest {
  readonly context: ProviderInvocationContext;
  readonly inputs: readonly string[];
}

export interface EmbeddingResult {
  readonly providerId: string;
  readonly vectors: readonly (readonly number[])[];
}

export interface ClassificationRequest {
  readonly context: ProviderInvocationContext;
  readonly content: string;
  readonly labels: readonly string[];
}

export interface ClassificationResult {
  readonly providerId: string;
  readonly label: string;
  readonly confidence: number;
}

export interface ArtificialIntelligenceProvider extends ProviderLifecycle {
  complete(request: AiCompletionRequest, signal?: AbortSignal): Promise<AiCompletionResult>;
  embed?(request: EmbeddingRequest, signal?: AbortSignal): Promise<EmbeddingResult>;
  classify?(request: ClassificationRequest, signal?: AbortSignal): Promise<ClassificationResult>;
}

export interface AiToolScope {
  readonly tenantId: string;
  readonly companyId: string;
  readonly branchIds: readonly string[];
}

export interface AiToolPolicy {
  readonly requiredPermissions: readonly string[];
  readonly allowedDataCategories: readonly AiDataCategory[];
  readonly maximumRows: number;
  readonly maximumOutputCharacters: number;
  readonly consequence: "READ_ONLY";
  readonly citationsRequired: true;
}

export interface AiToolCitation {
  readonly recordType: string;
  readonly recordId: string;
  readonly label: string;
}

export interface AiToolResult<TOutput = unknown> {
  readonly output: TOutput;
  readonly citations: readonly AiToolCitation[];
  readonly rowCount: number;
  readonly truncated: boolean;
}

