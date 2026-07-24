/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
export const SENSITIVE_ACTIONS = [
  "provider-secret-change",
  "privacy-export",
  "privacy-erasure",
  "legal-hold-change",
  "medical-record-access",
  "role-grant",
  "demo-reset"
] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

export interface ReauthenticationEvidence {
  readonly authenticatedAt: number;
  readonly now: number;
  readonly mfaVerified: boolean;
  readonly approvalCount: number;
}

export type ReauthenticationDenial =
  | "INVALID_TIME"
  | "REAUTHENTICATION_REQUIRED"
  | "MFA_REQUIRED"
  | "INDEPENDENT_APPROVAL_REQUIRED";

export type ReauthenticationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: ReauthenticationDenial };

const FIVE_MINUTES = 5 * 60 * 1_000;
const CLOCK_SKEW = 30 * 1_000;

const criticalActions: ReadonlySet<SensitiveAction> = new Set([
  "provider-secret-change",
  "privacy-erasure",
  "legal-hold-change",
  "role-grant",
  "demo-reset"
]);

export function authorizeSensitiveAction(
  action: SensitiveAction,
  evidence: ReauthenticationEvidence
): ReauthenticationDecision {
  const age = evidence.now - evidence.authenticatedAt;
  if (age < -CLOCK_SKEW || !Number.isFinite(age)) return { allowed: false, reason: "INVALID_TIME" };
  if (age > FIVE_MINUTES) return { allowed: false, reason: "REAUTHENTICATION_REQUIRED" };
  if (!evidence.mfaVerified) return { allowed: false, reason: "MFA_REQUIRED" };
  if (criticalActions.has(action) && evidence.approvalCount < 1) {
    return { allowed: false, reason: "INDEPENDENT_APPROVAL_REQUIRED" };
  }
  return { allowed: true };
}
