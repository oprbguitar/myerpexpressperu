/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import {
  nextWasteLifecyclePhase,
  transitionWasteLifecycle,
  validateWasteGeneration
} from "./waste-management.js";

describe("dominio de gestión de residuos", () => {
  it("normaliza un registro de generación sin inventar su clasificación", () => {
    expect(validateWasteGeneration({
      source: "  Área de mantenimiento ",
      description: " Paños usados ",
      quantity: "2.500",
      unit: "kg",
      hazardous: false,
      generatedAt: "2026-07-27T10:30:00-05:00"
    })).toEqual({
      source: "Área de mantenimiento",
      description: "Paños usados",
      quantity: "2.500",
      unit: "KG",
      hazardous: false,
      generatedAt: "2026-07-27T15:30:00.000Z"
    });
  });

  it("rechaza cantidades vacías, negativas o no decimales", () => {
    for (const quantity of ["", "0", "-1", "1,5"]) {
      expect(() => validateWasteGeneration({
        source: "Área",
        description: "Material",
        quantity,
        unit: "kg",
        hazardous: false,
        generatedAt: "2026-07-27T10:30:00-05:00"
      })).toThrow("cantidad");
    }
  });

  it("rechaza una fecha de generación futura", () => {
    expect(() => validateWasteGeneration({
      source: "Área",
      description: "Material",
      quantity: "1",
      unit: "kg",
      hazardous: false,
      generatedAt: new Date(Date.now() + 10 * 60_000).toISOString()
    })).toThrow("futuro");
  });

  it("solo permite avanzar una fase a la vez", () => {
    expect(nextWasteLifecyclePhase("GENERATION")).toBe("CLASSIFICATION");
    expect(transitionWasteLifecycle("GENERATION", "CLASSIFICATION")).toBe("CLASSIFICATION");
    expect(() => transitionWasteLifecycle("GENERATION", "SEGREGATION")).toThrow("siguiente fase");
  });

  it("requiere evidencia antes del cierre documental", () => {
    expect(() => transitionWasteLifecycle("FINAL_DESTINATION", "DOCUMENTARY_CLOSURE")).toThrow("evidencia");
    expect(transitionWasteLifecycle(
      "FINAL_DESTINATION",
      "DOCUMENTARY_CLOSURE",
      "00000000-0000-4000-8000-000000000111"
    )).toBe("DOCUMENTARY_CLOSURE");
  });
});
