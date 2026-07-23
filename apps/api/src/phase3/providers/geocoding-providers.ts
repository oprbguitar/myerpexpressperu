import type {
  GeoPoint,
  GeocodingProvider,
  GeocodingRequest,
  GeocodingResult,
  ProviderHealth,
  StructuredAddress
} from "@erp/contracts";
import { ProviderUnavailableError } from "./provider-errors.js";

export class ManualGeocodingProvider implements GeocodingProvider {
  healthCheck(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: "geocoding-manual",
      state: "HEALTHY",
      mode: "MANUAL",
      checkedAt: new Date().toISOString(),
      message: "Las coordenadas se ingresan y confirman manualmente.",
      capabilities: ["manual-entry"]
    });
  }

  geocode(): Promise<GeocodingResult> {
    return Promise.resolve({ providerId: "geocoding-manual", candidates: [] });
  }
}

export class MockGeocodingProvider implements GeocodingProvider {
  healthCheck(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: "geocoding-mock",
      state: "HEALTHY",
      mode: "MOCK",
      checkedAt: new Date().toISOString(),
      message: "Coordenadas sintéticas exclusivas para pruebas o demostración.",
      capabilities: ["geocode", "reverse-geocode"]
    });
  }

  geocode(request: GeocodingRequest): Promise<GeocodingResult> {
    const seed = [...JSON.stringify(request.address)].reduce((total, character) => total + character.charCodeAt(0), 0);
    const latitude = -12.0464 + (seed % 100) / 100_000;
    const longitude = -77.0428 + (seed % 80) / 100_000;
    return Promise.resolve({
      providerId: "geocoding-mock",
      candidates: [{
        point: reducePrecision({ latitude, longitude }, request.precision),
        formattedAddress: `[DEMO MOCK] ${formatAddress(request.address)}`,
        confidence: 0,
        source: "synthetic-demo",
        capturedAt: new Date().toISOString(),
        requiresConfirmation: true,
        mock: true
      }]
    });
  }

  reverseGeocode(
    context: GeocodingRequest["context"],
    point: GeoPoint
  ): Promise<StructuredAddress> {
    void context;
    void point;
    return Promise.resolve({ countryCode: "PE", freeForm: "[DEMO MOCK] Ubicación sintética" });
  }
}

export class DisabledGeocodingProvider implements GeocodingProvider {
  healthCheck(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: "geocoding-disabled",
      state: "DISABLED",
      mode: "DISABLED",
      checkedAt: new Date().toISOString(),
      capabilities: []
    });
  }

  geocode(): Promise<GeocodingResult> {
    return Promise.reject(new ProviderUnavailableError("GEOCODING_DISABLED", "La geocodificación está deshabilitada."));
  }
}

export function reducePrecision(point: GeoPoint, precision: GeocodingRequest["precision"]): GeoPoint {
  const decimals = precision === "EXACT" ? 6 : precision === "DISTRICT" ? 3 : precision === "PROVINCE" ? 2 : 1;
  const factor = 10 ** decimals;
  return {
    latitude: Math.round(point.latitude * factor) / factor,
    longitude: Math.round(point.longitude * factor) / factor
  };
}

function formatAddress(address: StructuredAddress): string {
  return [
    address.street,
    address.district,
    address.province,
    address.department,
    address.countryCode
  ].filter((part): part is string => Boolean(part)).join(", ");
}
