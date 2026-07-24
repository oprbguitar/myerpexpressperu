/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import {
  EmployeeStatus,
  allowedHrExportFields,
  completeEmployeeExit,
  createNextContractVersion,
  transitionEmployee,
  type EmployeeRecord
} from "./human-resources.js";

const employee: EmployeeRecord = {
  id: "employee-1",
  partyId: "party-1",
  status: EmployeeStatus.ACTIVE,
  version: 1
};

describe("dominio de recursos humanos", () => {
  it("mantiene usuario del sistema opcional y conserva historial al desactivar", () => {
    const result = transitionEmployee({
      employee,
      target: EmployeeStatus.INACTIVE,
      reason: "Fin de vínculo",
      changedByUserId: "hr-1",
      at: new Date("2026-07-23T10:00:00.000Z")
    });
    expect(result.employee.systemUserId).toBeUndefined();
    expect(result.history.previousStatus).toBe(EmployeeStatus.ACTIVE);
    expect(result.employee.version).toBe(2);
  });

  it("versiona contratos y valida sus fechas", () => {
    const first = createNextContractVersion(null, {
      employeeId: "employee-1",
      contractType: "PLAZO_FIJO",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      workingScheduleReference: "schedule-1",
      salaryReferenceMinorUnits: 250_000n,
      changeReason: "Alta"
    });
    const second = createNextContractVersion(first, {
      ...first,
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      changeReason: "Renovación"
    });
    expect(second.version).toBe(2);
    expect(() => createNextContractVersion(first, {
      ...first,
      startDate: "2027-12-31",
      endDate: "2027-01-01",
      changeReason: "Inválido"
    })).toThrow("anterior");
  });

  it("requiere completar la lista de salida", () => {
    const inactive = { ...employee, status: EmployeeStatus.INACTIVE };
    expect(() => completeEmployeeExit({
      employee: inactive,
      requiredChecklistItemIds: ["assets", "documents"],
      completedChecklistItemIds: ["assets"],
      reason: "Salida",
      changedByUserId: "hr-1",
      at: new Date()
    })).toThrow("pendientes");
    expect(completeEmployeeExit({
      employee: inactive,
      requiredChecklistItemIds: ["assets", "documents"],
      completedChecklistItemIds: ["assets", "documents"],
      reason: "Salida",
      changedByUserId: "hr-1",
      at: new Date()
    }).employee.status).toBe(EmployeeStatus.EXITED);
  });

  it("enmascara la referencia salarial en exportaciones sin permiso", () => {
    expect(allowedHrExportFields(["employeeCode", "salaryReference"], false)).toEqual(["employeeCode"]);
    expect(allowedHrExportFields(["employeeCode", "salaryReference"], true))
      .toEqual(["employeeCode", "salaryReference"]);
  });
});
