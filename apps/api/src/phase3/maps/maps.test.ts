/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import type { AuthenticatedContext } from "@erp/contracts";
import { MockGeocodingProvider } from "../providers/geocoding-providers.js";
import { ProviderManagementService } from "../providers/provider-management.service.js";
import { MapsService } from "./maps.service.js";

const auth: AuthenticatedContext = {
  userId: "user",
  tenantId: "tenant",
  companyId: "company",
  branchIds: [],
  permissions: new Set(["parties.read"]),
  sessionId: "session",
  forcePasswordChange: false
};

describe("privacidad geográfica", () => {
  it("reduce la precisión de domicilios de trabajadores y exige confirmación", async () => {
    const providers = new ProviderManagementService();
    providers.register({
      id: "geocoding-mock",
      category: "GEOCODING",
      displayName: "Mock",
      mode: "MOCK",
      capabilities: ["geocode"],
      affectedModules: ["maps"],
      adapter: new MockGeocodingProvider(),
      tenantId: auth.tenantId,
      companyId: auth.companyId
    });
    providers.activate("geocoding-mock", {
      appEnvironment: "test",
      productionConfirmation: false,
      tenantId: auth.tenantId,
      companyId: auth.companyId
    });
    const result = await new MapsService(providers).geocode({
      address: { countryCode: "PE", district: "Lima" },
      precision: "EXACT",
      locationKind: "EMPLOYEE_HOME"
    }, auth, "request");
    expect(result.privacyPrecisionApplied).toBe("DISTRICT");
    expect(result.requiresHumanConfirmation).toBe(true);
  });
});
