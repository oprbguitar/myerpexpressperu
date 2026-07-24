/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
export interface DemoResetRequest {
  readonly runtimeMode: "development" | "test" | "demo" | "production";
  readonly resetEnabled: boolean;
  readonly targetMarkedAsDemo: boolean;
  readonly expectedTenantId: string;
  readonly targetTenantId: string;
  readonly confirmation: string;
  readonly actorId: string;
  readonly reauthenticated: boolean;
  readonly mfaVerified: boolean;
  readonly approverIds: readonly string[];
}

export type DemoResetViolation =
  | "PRODUCTION_FORBIDDEN"
  | "DEMO_MODE_REQUIRED"
  | "RESET_DISABLED"
  | "TARGET_NOT_DEMO"
  | "TENANT_MISMATCH"
  | "CONFIRMATION_MISMATCH"
  | "REAUTHENTICATION_REQUIRED"
  | "MFA_REQUIRED"
  | "TWO_INDEPENDENT_APPROVERS_REQUIRED";

export interface DemoResetDecision {
  readonly allowed: boolean;
  readonly violations: readonly DemoResetViolation[];
}

export function authorizeDemoReset(request: DemoResetRequest): DemoResetDecision {
  const violations: DemoResetViolation[] = [];
  if (request.runtimeMode === "production") violations.push("PRODUCTION_FORBIDDEN");
  if (request.runtimeMode !== "demo") violations.push("DEMO_MODE_REQUIRED");
  if (!request.resetEnabled) violations.push("RESET_DISABLED");
  if (!request.targetMarkedAsDemo) violations.push("TARGET_NOT_DEMO");
  if (!request.expectedTenantId || request.targetTenantId !== request.expectedTenantId) violations.push("TENANT_MISMATCH");
  if (request.confirmation !== `RESET DEMO ${request.expectedTenantId}`) violations.push("CONFIRMATION_MISMATCH");
  if (!request.reauthenticated) violations.push("REAUTHENTICATION_REQUIRED");
  if (!request.mfaVerified) violations.push("MFA_REQUIRED");
  const independentApprovers = new Set(request.approverIds.filter((id) => id && id !== request.actorId));
  if (independentApprovers.size < 2) violations.push("TWO_INDEPENDENT_APPROVERS_REQUIRED");
  return { allowed: violations.length === 0, violations };
}
