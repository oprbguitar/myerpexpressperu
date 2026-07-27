/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { DomainValidationError } from "./index.js";

export const WASTE_LIFECYCLE_PHASES = [
  "GENERATION",
  "CLASSIFICATION",
  "SEGREGATION",
  "INITIAL_STORAGE",
  "INTERNAL_TRANSFER",
  "CENTRAL_STORAGE",
  "DISPATCH",
  "FINAL_DESTINATION",
  "DOCUMENTARY_CLOSURE"
] as const;

export type WasteLifecyclePhase = (typeof WASTE_LIFECYCLE_PHASES)[number];

export interface WasteGenerationInput {
  readonly source: string;
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  readonly hazardous: boolean;
  readonly generatedAt: string;
}

function normalizeRequiredText(raw: string, field: string, maximum: number): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value || value.length > maximum) {
    throw new DomainValidationError(
      "WASTE_GENERATION_INVALID",
      `${field} es obligatorio y no puede superar ${maximum} caracteres.`
    );
  }
  return value;
}

export function validateWasteGeneration(input: WasteGenerationInput): WasteGenerationInput {
  const quantity = input.quantity.trim();
  if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(quantity) || Number(quantity) <= 0) {
    throw new DomainValidationError(
      "WASTE_QUANTITY_INVALID",
      "La cantidad debe ser mayor que cero y usar hasta seis decimales."
    );
  }
  const generatedAt = new Date(input.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    throw new DomainValidationError("WASTE_DATE_INVALID", "La fecha de generación no es válida.");
  }
  if (generatedAt.getTime() > Date.now() + 5 * 60_000) {
    throw new DomainValidationError(
      "WASTE_DATE_IN_FUTURE",
      "La fecha de generación no puede estar en el futuro."
    );
  }
  return {
    source: normalizeRequiredText(input.source, "El origen", 200),
    description: normalizeRequiredText(input.description, "La descripción", 500),
    quantity,
    unit: normalizeRequiredText(input.unit, "La unidad", 30).toUpperCase(),
    hazardous: input.hazardous,
    generatedAt: generatedAt.toISOString()
  };
}

export function nextWasteLifecyclePhase(current: WasteLifecyclePhase): WasteLifecyclePhase | null {
  const currentIndex = WASTE_LIFECYCLE_PHASES.indexOf(current);
  return WASTE_LIFECYCLE_PHASES[currentIndex + 1] ?? null;
}

export function transitionWasteLifecycle(
  current: WasteLifecyclePhase,
  target: WasteLifecyclePhase,
  evidenceDocumentId?: string
): WasteLifecyclePhase {
  const expected = nextWasteLifecyclePhase(current);
  if (expected !== target) {
    throw new DomainValidationError(
      "WASTE_TRANSITION_INVALID",
      `No se puede pasar de ${current} a ${target}. La siguiente fase válida es ${expected ?? "ninguna"}.`
    );
  }
  if (target === "DOCUMENTARY_CLOSURE" && !evidenceDocumentId?.trim()) {
    throw new DomainValidationError(
      "WASTE_CLOSURE_EVIDENCE_REQUIRED",
      "El cierre documental requiere evidencia de destino final."
    );
  }
  return target;
}
