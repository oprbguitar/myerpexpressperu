/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
export interface RetentionCandidate {
  readonly id: string;
  readonly createdAt: number;
  readonly legalHold: boolean;
  readonly explicitRetentionUntil?: number;
}

export interface RetentionPreview {
  readonly eligibleIds: readonly string[];
  readonly protectedIds: readonly string[];
  readonly invalidIds: readonly string[];
  readonly cutoff: number;
}

export interface RetentionPolicy {
  readonly now: number;
  readonly retentionDays: number;
}

const DAY = 24 * 60 * 60 * 1_000;

export function previewRetention(
  candidates: readonly RetentionCandidate[],
  policy: RetentionPolicy
): RetentionPreview {
  if (!Number.isFinite(policy.now) || !Number.isInteger(policy.retentionDays) || policy.retentionDays < 1) {
    throw new Error("INVALID_RETENTION_POLICY");
  }
  const cutoff = policy.now - policy.retentionDays * DAY;
  const eligibleIds: string[] = [];
  const protectedIds: string[] = [];
  const invalidIds: string[] = [];
  for (const candidate of candidates) {
    if (!candidate.id || !Number.isFinite(candidate.createdAt) || candidate.createdAt > policy.now) {
      invalidIds.push(candidate.id);
      continue;
    }
    if (
      candidate.legalHold ||
      (candidate.explicitRetentionUntil !== undefined && candidate.explicitRetentionUntil > policy.now)
    ) {
      protectedIds.push(candidate.id);
      continue;
    }
    if (candidate.createdAt < cutoff) eligibleIds.push(candidate.id);
    else protectedIds.push(candidate.id);
  }
  return { eligibleIds, protectedIds, invalidIds, cutoff };
}
