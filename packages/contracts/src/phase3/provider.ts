export const PROVIDER_MODES = ["DISABLED", "MANUAL", "LOCAL", "MOCK", "CLOUD"] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];

export const PROVIDER_STATES = [
  "NOT_CONFIGURED",
  "CONFIGURED",
  "TESTING",
  "HEALTHY",
  "DEGRADED",
  "UNAVAILABLE",
  "DISABLED"
] as const;
export type ProviderState = (typeof PROVIDER_STATES)[number];

export const PROVIDER_CATEGORIES = [
  "AUTHENTICATION",
  "DATABASE_REFERENCE",
  "STORAGE",
  "EMAIL",
  "AI",
  "OCR",
  "MAPS",
  "GEOCODING",
  "ELECTRONIC_INVOICING",
  "DIGITAL_SIGNATURE",
  "QUEUE",
  "PDF",
  "MALWARE_SCANNING"
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export interface ProviderHealth {
  readonly providerId: string;
  readonly state: ProviderState;
  readonly mode: ProviderMode;
  readonly checkedAt: string;
  readonly latencyMs?: number;
  readonly message?: string;
  readonly capabilities: readonly string[];
}

export interface ProviderInvocationContext {
  readonly tenantId: string;
  readonly companyId: string;
  readonly actorUserId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly timeoutMs: number;
}

export interface ProviderDescriptor {
  readonly id: string;
  readonly category: ProviderCategory;
  readonly displayName: string;
  readonly mode: ProviderMode;
  readonly state: ProviderState;
  readonly capabilities: readonly string[];
  readonly affectedModules: readonly string[];
  readonly secretReferenceConfigured: boolean;
  readonly lastHealth?: ProviderHealth;
}

export interface ProviderLifecycle {
  healthCheck(signal?: AbortSignal): Promise<ProviderHealth>;
}

