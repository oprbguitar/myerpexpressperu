/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import { assertSafePhase3Draft } from "./draftSafety";

describe("Phase 3 draft safety", () => {
  it("accepts operational SST fields without medical detail", () => {
    expect(() => assertSafePhase3Draft({
      area: "Almacén",
      finding: "Pasillo obstruido",
      evidenceName: "hallazgo.jpg"
    })).not.toThrow();
  });

  it.each(["token", "refreshToken", "password", "providerSecret", "diagnosis", "detalleMedico"])(
    "rejects forbidden key %s at any depth",
    (key) => {
      expect(() => assertSafePhase3Draft({ nested: { [key]: "sensitive" } })).toThrow(/campo no permitido/);
    }
  );
});
