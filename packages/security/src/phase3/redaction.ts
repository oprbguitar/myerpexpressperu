/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
const sensitiveKey = /password|passphrase|authorization|cookie|secret|token|api[_-]?key|private[_-]?key|diagnos|medical|health/i;
const bearerValue = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const emailValue = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const peruDocumentValue = /\b(?:\d{8}|\d{11})\b/g;
const ipv4Value = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

const MAX_DEPTH = 12;
const MAX_TEXT_LENGTH = 4_096;

export function redactText(value: string): string {
  const bounded = value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH)}[TRUNCATED]` : value;
  return bounded
    .replace(bearerValue, "Bearer [REDACTED]")
    .replace(emailValue, "[EMAIL]")
    .replace(peruDocumentValue, "[DOCUMENT]")
    .replace(ipv4Value, "[IP]");
}

function redactUnknown(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return "[MAX_DEPTH]";
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return "[UNDEFINED]";
  if (typeof value === "symbol" || typeof value === "function") return "[UNSUPPORTED]";
  if (Array.isArray(value)) return value.map((entry) => redactUnknown(entry, depth + 1, seen));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = sensitiveKey.test(key) ? "[REDACTED]" : redactUnknown(nested, depth + 1, seen);
    }
    seen.delete(value);
    return output;
  }
  return "[UNSUPPORTED]";
}

export function redactStructured(value: unknown): unknown {
  return redactUnknown(value, 0, new WeakSet<object>());
}
