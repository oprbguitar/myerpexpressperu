export type SafeAttributeValue = string | number | boolean;
export type SafeAttributes = Readonly<Record<string, SafeAttributeValue>>;

export interface MetricRecord {
  readonly name: string;
  readonly value: number;
  readonly unit: "count" | "milliseconds" | "bytes" | "tokens" | "currency_minor";
  readonly attributes: SafeAttributes;
}

export interface MetricsProvider {
  increment(name: string, attributes?: SafeAttributes): void;
  observe(record: MetricRecord): void;
}

export interface TraceSpan {
  readonly traceId: string;
  readonly spanId: string;
  setAttributes(attributes: SafeAttributes): void;
  end(status: "OK" | "ERROR"): void;
}

export interface TraceProvider {
  startSpan(
    name: string,
    context: { readonly requestId: string; readonly correlationId: string },
    attributes?: SafeAttributes
  ): TraceSpan;
}

export interface SafeErrorReport {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly attributes: SafeAttributes;
}

export interface ErrorReportingProvider {
  capture(report: SafeErrorReport): void;
}

export const PROHIBITED_OBSERVABILITY_FIELDS = [
  "authorization",
  "cookie",
  "password",
  "token",
  "secret",
  "prompt",
  "documentContent",
  "medicalDetail",
  "diagnosis",
  "financialDocumentContent"
] as const;

