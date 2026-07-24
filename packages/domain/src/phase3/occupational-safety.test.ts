/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import {
  CorrectiveActionStatus,
  IncidentStatus,
  assertRestrictedMedicalAccess,
  calculateRiskLevel,
  transitionCorrectiveAction,
  transitionIncident,
  validateFitnessSummary
} from "./occupational-safety.js";

describe("dominio de seguridad y salud en el trabajo", () => {
  it("calcula el nivel de riesgo con matriz controlada", () => {
    expect(calculateRiskLevel(1, 3)).toEqual({ score: 3, level: "LOW" });
    expect(calculateRiskLevel(4, 5)).toEqual({ score: 20, level: "CRITICAL" });
    expect(() => calculateRiskLevel(0, 5)).toThrow("entre 1 y 5");
  });

  it("cierra acciones correctivas sólo con evidencia o excepción documentada", () => {
    expect(() => transitionCorrectiveAction(
      CorrectiveActionStatus.VERIFICATION_PENDING,
      CorrectiveActionStatus.CLOSED
    )).toThrow("evidencia");
    expect(transitionCorrectiveAction(
      CorrectiveActionStatus.VERIFICATION_PENDING,
      CorrectiveActionStatus.CLOSED,
      { evidenceDocumentIds: ["document-1"], verifiedByUserId: "sst-1" }
    )).toBe(CorrectiveActionStatus.CLOSED);
  });

  it("cierra incidentes sólo con evidencia y verificador", () => {
    expect(() => transitionIncident(
      IncidentStatus.UNDER_INVESTIGATION,
      IncidentStatus.CLOSED,
      { evidenceDocumentIds: [], documentedException: "Sin daño material", verifiedByUserId: "" }
    )).toThrow("verificador");
  });

  it("separa el detalle médico mediante permiso, auditoría y autorización de IA", () => {
    expect(() => assertRestrictedMedicalAccess({
      hasSpecialPermission: false,
      aiProcessingRequested: false,
      explicitAiAuthorization: false
    })).toThrow("permiso especial");
    expect(() => assertRestrictedMedicalAccess({
      hasSpecialPermission: true,
      auditAccessId: "audit-1",
      purpose: "Seguimiento ocupacional",
      aiProcessingRequested: true,
      explicitAiAuthorization: false
    })).toThrow("no se procesan con IA");
  });

  it("limita la vista general a un resumen de aptitud coherente", () => {
    expect(() => validateFitnessSummary({
      examinationCompleted: true,
      examinationDate: "2026-07-20",
      fitnessStatus: "FIT_WITH_RESTRICTIONS"
    })).toThrow("restricción laboral");
    expect(() => validateFitnessSummary({
      examinationCompleted: true,
      examinationDate: "2026-07-20",
      fitnessStatus: "FIT_WITH_RESTRICTIONS",
      authorizedWorkRestriction: "No trabajar en altura"
    })).not.toThrow();
  });
});
