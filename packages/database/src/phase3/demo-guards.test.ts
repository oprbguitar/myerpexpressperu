/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import {
  DemoGuardError,
  assertDemoResetAllowed,
  assertDemoSeedAllowed,
  type DemoResetEnvironment,
  type ObservedDemoIdentity
} from "./demo-guards.js";

const environment: DemoResetEnvironment = {
  APP_ENVIRONMENT: "demo",
  DEMO_RESET_ENABLED: "true",
  DEMO_TENANT_ID: "30000000-0000-4000-8000-000000000001",
  DEMO_DATABASE_NAME: "erp_express_demo",
  DEMO_DATABASE_FINGERPRINT: "erp-express-peru-demo-db-v0.3.0"
};
const observed: ObservedDemoIdentity = {
  databaseName: "erp_express_demo",
  tenantId: "30000000-0000-4000-8000-000000000001",
  tenantCode: "demo-erp-express",
  profileStatus: "active",
  profileResetEnabled: true,
  profileFingerprint: "erp-express-peru-demo-db-v0.3.0"
};

describe("demo environment guards", () => {
  it("allows the dedicated demo identity", () => {
    expect(() => assertDemoSeedAllowed(environment, observed.databaseName)).not.toThrow();
    expect(() => assertDemoResetAllowed(environment, observed)).not.toThrow();
  });

  it.each([
    [{ ...environment, APP_ENVIRONMENT: "production" }, "DEMO_RESET_ENVIRONMENT_GUARD"],
    [{ ...environment, DEMO_RESET_ENABLED: "false" }, "DEMO_RESET_RUNTIME_GUARD"],
    [{ ...environment, DEMO_TENANT_ID: "40000000-0000-4000-8000-000000000001" }, "DEMO_RESET_TENANT_GUARD"],
    [{ ...environment, DEMO_DATABASE_NAME: "erp_production" }, "DEMO_RESET_DATABASE_GUARD"],
    [{ ...environment, DEMO_DATABASE_FINGERPRINT: "wrong-fingerprint-value" }, "DEMO_RESET_FINGERPRINT_GUARD"]
  ])("rejects an invalid reset identity", (invalid, code) => {
    expect.assertions(1);
    try {
      assertDemoResetAllowed(invalid, observed);
    } catch (error: unknown) {
      expect(error).toMatchObject<Partial<DemoGuardError>>({ code });
    }
  });

  it("rejects a production-marked tenant even if environment variables are forged", () => {
    expect(() => assertDemoResetAllowed(environment, { ...observed, tenantCode: "production-main" }))
      .toThrow("tenant no está marcado");
  });
});

