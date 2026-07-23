import { describe, expect, it } from "vitest";
import type { AiCompletionRequest } from "@erp/contracts";
import {
  CustomOpenAiCompatibleProvider,
  LocalOpenAiCompatibleProvider,
  MockAiProvider,
  NoAiProvider
} from "./ai-providers.js";
import { MockGeocodingProvider } from "./geocoding-providers.js";
import { ProviderManagementService } from "./provider-management.service.js";

const completionRequest: AiCompletionRequest = {
  context: {
    tenantId: "tenant",
    companyId: "company",
    actorUserId: "user",
    requestId: "request",
    correlationId: "request",
    timeoutMs: 1_000
  },
  systemInstruction: "Asiste sin ejecutar acciones.",
  userPrompt: "Resumen",
  supportingContext: [],
  maximumOutputTokens: 100,
  allowedDataCategories: ["INTERNAL"]
};

describe("proveedores seguros de Fase 3", () => {
  it("mantiene IA deshabilitada como operación válida", async () => {
    const provider = new NoAiProvider();
    await expect(provider.healthCheck()).resolves.toMatchObject({ state: "DISABLED", mode: "DISABLED" });
    await expect(provider.complete()).rejects.toMatchObject({ code: "AI_DISABLED" });
  });

  it("rotula inequívocamente resultados mock", async () => {
    const result = await new MockAiProvider().complete(completionRequest);
    expect(result.mock).toBe(true);
    expect(result.content).toContain("DEMO MOCK AI");
  });

  it("restringe proveedores locales a loopback y cloud a orígenes permitidos", () => {
    expect(() => new LocalOpenAiCompatibleProvider({
      providerId: "bad",
      baseUrl: "https://example.test",
      model: "local",
      timeoutMs: 100
    })).toThrow("LOCAL_PROVIDER_REQUIRES_LOOPBACK_ENDPOINT");
    expect(() => new CustomOpenAiCompatibleProvider({
      providerId: "cloud",
      baseUrl: "https://unapproved.example",
      model: "remote",
      timeoutMs: 100,
      allowedExternalOrigins: new Set(["https://approved.example"])
    })).toThrow("EXTERNAL_PROVIDER_ENDPOINT_NOT_ALLOWED");
  });

  it("no activa un proveedor cloud en producción sin confirmación explícita", () => {
    const manager = new ProviderManagementService();
    manager.register({
      id: "maps-cloud-test",
      category: "GEOCODING",
      displayName: "Prueba externa",
      mode: "CLOUD",
      capabilities: ["geocode"],
      affectedModules: ["maps"],
      adapter: new MockGeocodingProvider(),
      secretReference: "secret://maps/test",
      tenantId: "tenant",
      companyId: "company"
    });
    expect(() => manager.activate("maps-cloud-test", {
      appEnvironment: "production",
      productionConfirmation: false,
      tenantId: "tenant",
      companyId: "company"
    })).toThrow("confirmación explícita");
    expect(manager.exportNonSecretConfiguration("maps-cloud-test", {
      tenantId: "tenant", companyId: "company"
    })).toMatchObject({
      secretReferenceConfigured: true
    });
    expect(JSON.stringify(manager.exportNonSecretConfiguration("maps-cloud-test", {
      tenantId: "tenant", companyId: "company"
    }))).not.toContain("secret://");
    expect(() => manager.activate("maps-cloud-test", {
      appEnvironment: "test",
      productionConfirmation: true,
      tenantId: "other-tenant",
      companyId: "other-company"
    })).toThrow("ámbito");
  });
});
