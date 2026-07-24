/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import { authorizeDemoReset } from "./demo-reset.js";
import { authorizeSensitiveAction } from "./reauthentication.js";

describe("acciones sensibles", () => {
  it("exige reautenticación, MFA y aprobación para cambios críticos", () => {
    expect(
      authorizeSensitiveAction("provider-secret-change", {
        authenticatedAt: 0,
        now: 301_000,
        mfaVerified: true,
        approvalCount: 1
      })
    ).toEqual({ allowed: false, reason: "REAUTHENTICATION_REQUIRED" });
    expect(
      authorizeSensitiveAction("provider-secret-change", {
        authenticatedAt: 1_000,
        now: 2_000,
        mfaVerified: true,
        approvalCount: 0
      })
    ).toEqual({ allowed: false, reason: "INDEPENDENT_APPROVAL_REQUIRED" });
  });
});

describe("guardas de reinicio demo", () => {
  const validRequest = {
    runtimeMode: "demo" as const,
    resetEnabled: true,
    targetMarkedAsDemo: true,
    expectedTenantId: "tenant-demo",
    targetTenantId: "tenant-demo",
    confirmation: "RESET DEMO tenant-demo",
    actorId: "operator",
    reauthenticated: true,
    mfaVerified: true,
    approverIds: ["approver-a", "approver-b"]
  };

  it("permite únicamente el caso demo con doble aprobación independiente", () => {
    expect(authorizeDemoReset(validRequest)).toEqual({ allowed: true, violations: [] });
  });

  it("prohíbe producción aun si las demás guardas aparentan ser válidas", () => {
    const result = authorizeDemoReset({ ...validRequest, runtimeMode: "production" });
    expect(result.allowed).toBe(false);
    expect(result.violations).toContain("PRODUCTION_FORBIDDEN");
    expect(result.violations).toContain("DEMO_MODE_REQUIRED");
  });

  it("no cuenta al actor ni aprobadores duplicados", () => {
    const result = authorizeDemoReset({
      ...validRequest,
      approverIds: ["operator", "approver-a", "approver-a"]
    });
    expect(result.violations).toContain("TWO_INDEPENDENT_APPROVERS_REQUIRED");
  });
});
