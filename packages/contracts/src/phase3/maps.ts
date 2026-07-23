import type { ProviderInvocationContext, ProviderLifecycle } from "./provider.js";

export interface StructuredAddress {
  readonly countryCode: string;
  readonly department?: string;
  readonly province?: string;
  readonly district?: string;
  readonly street?: string;
  readonly postalCode?: string;
  readonly freeForm?: string;
}

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface GeocodingCandidate {
  readonly point: GeoPoint;
  readonly formattedAddress: string;
  readonly confidence: number;
  readonly source: string;
  readonly capturedAt: string;
  readonly requiresConfirmation: boolean;
  readonly mock: boolean;
}

export interface GeocodingRequest {
  readonly context: ProviderInvocationContext;
  readonly address: StructuredAddress;
  readonly precision: "EXACT" | "DISTRICT" | "PROVINCE" | "DEPARTMENT";
}

export interface GeocodingResult {
  readonly providerId: string;
  readonly candidates: readonly GeocodingCandidate[];
}

export interface GeocodingProvider extends ProviderLifecycle {
  geocode(request: GeocodingRequest, signal?: AbortSignal): Promise<GeocodingResult>;
  reverseGeocode?(
    context: ProviderInvocationContext,
    point: GeoPoint,
    signal?: AbortSignal
  ): Promise<StructuredAddress>;
}

