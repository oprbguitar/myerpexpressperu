import { z } from "zod";
import type {
  OcrExtractionRequest,
  OcrExtractionResult,
  OcrProvider,
  ProviderHealth
} from "@erp/contracts";
import { ProviderPolicyError, ProviderUnavailableError } from "./provider-errors.js";
import {
  assertAllowedExternalEndpoint,
  ProviderCircuitBreaker,
  readBoundedJson,
  withTimeout
} from "./provider-safety.js";

const externalOcrResponseSchema = z.object({
  engine: z.string().min(1),
  engineVersion: z.string().min(1),
  documentType: z.enum([
    "SUPPLIER_RECEIPT",
    "SUPPLIER_INVOICE",
    "IDENTITY_DOCUMENT",
    "CONTRACT",
    "PURCHASE_ORDER",
    "DELIVERY_EVIDENCE",
    "UNKNOWN"
  ]),
  plainText: z.string(),
  overallConfidence: z.number().min(0).max(1),
  fields: z.array(z.object({
    name: z.string().min(1),
    value: z.string(),
    confidence: z.number().min(0).max(1),
    sourcePage: z.number().int().positive(),
    boundingRegion: z.object({
      page: z.number().int().positive(),
      x: z.number().nonnegative(),
      y: z.number().nonnegative(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative()
    }).optional()
  }))
});

const prohibitedExternalCategories = new Set(["MEDICAL", "CREDENTIAL", "PROVIDER_SECRET"]);

function assertOcrPolicy(request: OcrExtractionRequest): void {
  if (request.dataCategories.some((category) => prohibitedExternalCategories.has(category))) {
    throw new ProviderPolicyError("OCR_EXTERNAL_DATA_PROHIBITED", "La clasificación impide enviar este documento a OCR externo.");
  }
  if (request.requestedDocumentType === "IDENTITY_DOCUMENT" && !request.identityDocumentAuthorized) {
    throw new ProviderPolicyError("OCR_IDENTITY_AUTHORIZATION_REQUIRED", "El documento de identidad requiere autorización explícita.");
  }
}

export class MockOcrProvider implements OcrProvider {
  healthCheck(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: "ocr-mock",
      state: "HEALTHY",
      mode: "MOCK",
      checkedAt: new Date().toISOString(),
      message: "Extracción sintética exclusiva para pruebas o demostración.",
      capabilities: ["extract"]
    });
  }

  extract(request: OcrExtractionRequest): Promise<OcrExtractionResult> {
    return Promise.resolve({
      providerId: "ocr-mock",
      engine: "deterministic-demo",
      engineVersion: "1",
      documentType: "UNKNOWN",
      plainText: `[DEMO MOCK OCR — SIN VALOR DOCUMENTAL] ${request.fileName}`,
      fields: [],
      overallConfidence: 0,
      processedAt: new Date().toISOString(),
      mock: true,
      requiresHumanReview: true
    });
  }
}

export interface LocalOcrEngineResult {
  readonly engine: string;
  readonly engineVersion: string;
  readonly plainText: string;
  readonly overallConfidence: number;
  readonly fields: OcrExtractionResult["fields"];
  readonly documentType: OcrExtractionResult["documentType"];
}

export type LocalOcrEngine = (
  content: Uint8Array,
  contentType: OcrExtractionRequest["contentType"],
  signal?: AbortSignal
) => Promise<LocalOcrEngineResult>;

export class LocalOcrAssistanceProvider implements OcrProvider {
  constructor(
    private readonly engine: LocalOcrEngine,
    private readonly timeoutMs = 30_000
  ) {}

  healthCheck(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: "ocr-local",
      state: "CONFIGURED",
      mode: "LOCAL",
      checkedAt: new Date().toISOString(),
      message: "Motor local inyectado; la extracción siempre requiere revisión humana.",
      capabilities: ["extract"]
    });
  }

  async extract(request: OcrExtractionRequest, signal?: AbortSignal): Promise<OcrExtractionResult> {
    const result = await withTimeout(
      Math.min(this.timeoutMs, request.context.timeoutMs),
      signal,
      (boundedSignal) => this.engine(request.content, request.contentType, boundedSignal)
    );
    return {
      providerId: "ocr-local",
      engine: result.engine,
      engineVersion: result.engineVersion,
      documentType: result.documentType,
      plainText: result.plainText,
      fields: result.fields,
      overallConfidence: Math.max(0, Math.min(1, result.overallConfidence)),
      processedAt: new Date().toISOString(),
      mock: false,
      requiresHumanReview: true
    };
  }
}

export interface CustomHttpOcrProviderOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly allowedExternalOrigins: ReadonlySet<string>;
  readonly credentialProvider?: () => Promise<string>;
  readonly fetchImplementation?: typeof fetch;
}

export class CustomHttpOcrProvider implements OcrProvider {
  private readonly endpoint: URL;
  private readonly fetchImplementation: typeof fetch;
  private readonly breaker = new ProviderCircuitBreaker({ failureThreshold: 3, resetAfterMs: 30_000 });

  constructor(private readonly options: CustomHttpOcrProviderOptions) {
    this.endpoint = assertAllowedExternalEndpoint(options.baseUrl, options.allowedExternalOrigins);
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async healthCheck(signal?: AbortSignal): Promise<ProviderHealth> {
    const startedAt = Date.now();
    try {
      await withTimeout(this.options.timeoutMs, signal, async (boundedSignal) => {
        const response = await this.fetchImplementation(new URL("health", this.endpoint), {
          signal: boundedSignal,
          headers: await this.authorizationHeaders()
        });
        if (!response.ok) throw new Error("OCR_HEALTH_FAILED");
      });
      return {
        providerId: "ocr-custom-http",
        state: "HEALTHY",
        mode: "CLOUD",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        capabilities: ["extract"]
      };
    } catch {
      return {
        providerId: "ocr-custom-http",
        state: "UNAVAILABLE",
        mode: "CLOUD",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: "No fue posible validar el proveedor OCR.",
        capabilities: ["extract"]
      };
    }
  }

  async extract(request: OcrExtractionRequest, signal?: AbortSignal): Promise<OcrExtractionResult> {
    assertOcrPolicy(request);
    return this.breaker.execute(() => withTimeout(
      Math.min(this.options.timeoutMs, request.context.timeoutMs),
      signal,
      async (boundedSignal) => {
        const response = await this.fetchImplementation(new URL("extract", this.endpoint), {
          method: "POST",
          headers: {
            "content-type": request.contentType,
            "x-document-id": request.documentId,
            "x-content-sha256": request.contentSha256,
            ...(await this.authorizationHeaders())
          },
          body: request.content,
          signal: boundedSignal
        });
        const parsed = externalOcrResponseSchema.parse(await readBoundedJson(response, 2_000_000));
        return {
          providerId: "ocr-custom-http",
          engine: parsed.engine,
          engineVersion: parsed.engineVersion,
          documentType: parsed.documentType,
          plainText: parsed.plainText,
          fields: parsed.fields.map((field) => ({
            name: field.name,
            value: field.value,
            confidence: field.confidence,
            sourcePage: field.sourcePage,
            ...(field.boundingRegion === undefined ? {} : { boundingRegion: field.boundingRegion })
          })),
          overallConfidence: parsed.overallConfidence,
          processedAt: new Date().toISOString(),
          mock: false,
          requiresHumanReview: true
        };
      }
    ));
  }

  private async authorizationHeaders(): Promise<Record<string, string>> {
    if (!this.options.credentialProvider) return {};
    return { authorization: `Bearer ${await this.options.credentialProvider()}` };
  }
}

export class DisabledOcrProvider implements OcrProvider {
  healthCheck(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: "ocr-disabled",
      state: "DISABLED",
      mode: "DISABLED",
      checkedAt: new Date().toISOString(),
      capabilities: []
    });
  }

  extract(): Promise<OcrExtractionResult> {
    return Promise.reject(new ProviderUnavailableError("OCR_DISABLED", "OCR está deshabilitado."));
  }
}
