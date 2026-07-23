import { redactStructured, redactText } from "./redaction.js";

export const SECURITY_EVENT_OUTCOMES = ["success", "denied", "failure"] as const;
export type SecurityEventOutcome = (typeof SECURITY_EVENT_OUTCOMES)[number];

export interface SecurityEventInput {
  readonly eventType: string;
  readonly outcome: SecurityEventOutcome;
  readonly occurredAt: number;
  readonly actorId?: string;
  readonly tenantId?: string;
  readonly companyId?: string;
  readonly ipAddress?: string;
  readonly metadata?: unknown;
}

export interface SanitizedSecurityEvent {
  readonly eventType: string;
  readonly outcome: SecurityEventOutcome;
  readonly occurredAt: number;
  readonly actorId?: string;
  readonly tenantId?: string;
  readonly companyId?: string;
  readonly ipAddress?: "[REDACTED_IP]";
  readonly metadata?: unknown;
}

function sanitizeIdentifier(value: string): string {
  return redactText(value).replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 128);
}

export function sanitizeSecurityEvent(input: SecurityEventInput): SanitizedSecurityEvent {
  if (!/^[a-z][a-z0-9._-]{2,80}$/.test(input.eventType)) throw new Error("INVALID_SECURITY_EVENT_TYPE");
  if (!Number.isFinite(input.occurredAt)) throw new Error("INVALID_SECURITY_EVENT_TIME");
  const output: {
    eventType: string;
    outcome: SecurityEventOutcome;
    occurredAt: number;
    actorId?: string;
    tenantId?: string;
    companyId?: string;
    ipAddress?: "[REDACTED_IP]";
    metadata?: unknown;
  } = {
    eventType: input.eventType,
    outcome: input.outcome,
    occurredAt: input.occurredAt
  };
  if (input.actorId !== undefined) output.actorId = sanitizeIdentifier(input.actorId);
  if (input.tenantId !== undefined) output.tenantId = sanitizeIdentifier(input.tenantId);
  if (input.companyId !== undefined) output.companyId = sanitizeIdentifier(input.companyId);
  if (input.ipAddress !== undefined) output.ipAddress = "[REDACTED_IP]";
  if (input.metadata !== undefined) output.metadata = redactStructured(input.metadata);
  return output;
}
