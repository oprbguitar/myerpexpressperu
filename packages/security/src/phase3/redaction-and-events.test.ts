/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import { redactStructured, redactText } from "./redaction.js";
import { sanitizeSecurityEvent } from "./security-events.js";

describe("redacción defensiva", () => {
  it("elimina secretos por clave y PII frecuente en texto", () => {
    const result = redactStructured({
      authorization: "Bearer should-never-leak",
      nested: {
        email: "persona@example.com",
        note: "contact persona@example.com from 192.168.1.4, DNI 12345678"
      }
    });
    expect(result).toEqual({
      authorization: "[REDACTED]",
      nested: {
        email: "[EMAIL]",
        note: "contact [EMAIL] from [IP], DNI [DOCUMENT]"
      }
    });
  });

  it("acota texto y maneja referencias circulares", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(redactStructured(circular)).toEqual({ self: "[CIRCULAR]" });
    expect(redactText("x".repeat(5_000))).toContain("[TRUNCATED]");
  });
});

describe("eventos de seguridad", () => {
  it("conserva el sobre mínimo y depura metadatos", () => {
    expect(
      sanitizeSecurityEvent({
        eventType: "auth.login.denied",
        outcome: "denied",
        occurredAt: 100,
        actorId: "user/123",
        ipAddress: "203.0.113.10",
        metadata: { password: "bad", attemptedEmail: "person@example.com" }
      })
    ).toEqual({
      eventType: "auth.login.denied",
      outcome: "denied",
      occurredAt: 100,
      actorId: "user_123",
      ipAddress: "[REDACTED_IP]",
      metadata: { password: "[REDACTED]", attemptedEmail: "[EMAIL]" }
    });
  });

  it("rechaza tipos de evento no normalizados", () => {
    expect(() =>
      sanitizeSecurityEvent({ eventType: "DROP TABLE", outcome: "failure", occurredAt: 100 })
    ).toThrowError("INVALID_SECURITY_EVENT_TYPE");
  });
});
