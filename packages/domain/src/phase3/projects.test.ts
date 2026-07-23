import { describe, expect, it } from "vitest";
import {
  ApprovalStatus,
  ProjectStatus,
  approveExpenseReport,
  approveTimeEntry,
  assertApprovedTimeEditable,
  assertProjectAcceptsOperationalEntry,
  calculateWeightedProjectProgress,
  createNextBudgetVersion,
  transitionProjectStatus,
  type ApprovalRecord
} from "./projects.js";

describe("dominio de proyectos, tiempo y gastos", () => {
  it("calcula avance mediante tareas ponderadas", () => {
    expect(calculateWeightedProjectProgress([
      { id: "design", weightBasisPoints: 4_000, completionBasisPoints: 10_000 },
      { id: "build", weightBasisPoints: 6_000, completionBasisPoints: 5_000 }
    ])).toBe(7_000);
    expect(() => calculateWeightedProjectProgress([
      { id: "manual", weightBasisPoints: 9_000, completionBasisPoints: 5_000 }
    ])).toThrow("sumar exactamente");
  });

  it("requiere evidencia para completar y autorización para operar tras el cierre", () => {
    expect(() => transitionProjectStatus(ProjectStatus.ACTIVE, ProjectStatus.COMPLETED)).toThrow("evidencia");
    expect(transitionProjectStatus(ProjectStatus.ACTIVE, ProjectStatus.COMPLETED, true))
      .toBe(ProjectStatus.COMPLETED);
    expect(() => assertProjectAcceptsOperationalEntry(ProjectStatus.COMPLETED)).toThrow("reapertura");
    expect(() => assertProjectAcceptsOperationalEntry(ProjectStatus.COMPLETED, true)).not.toThrow();
  });

  it("versiona el presupuesto con motivo y aprobador", () => {
    const first = createNextBudgetVersion(null, {
      projectId: "project-1",
      amountMinorUnits: 100_000n,
      currency: "pen",
      reason: "Presupuesto inicial",
      approvedByUserId: "manager-1",
      at: new Date("2026-07-23T00:00:00.000Z")
    });
    const second = createNextBudgetVersion(first, {
      projectId: "project-1",
      amountMinorUnits: 120_000n,
      currency: "PEN",
      reason: "Cambio de alcance aprobado",
      approvedByUserId: "manager-2",
      at: new Date("2026-07-24T00:00:00.000Z")
    });
    expect(second.version).toBe(2);
    expect(() => createNextBudgetVersion(first, {
      projectId: "project-1",
      amountMinorUnits: 120_000n,
      currency: "PEN",
      reason: "",
      approvedByUserId: "manager-2",
      at: new Date()
    })).toThrow("requiere motivo");
  });

  it("bloquea la autoaprobación de gastos", () => {
    const submitted: ApprovalRecord = {
      status: ApprovalStatus.SUBMITTED,
      submittedByUserId: "employee-1",
      version: 1
    };
    expect(() => approveExpenseReport(submitted, "employee-1")).toThrow("propio");
    expect(approveExpenseReport(submitted, "manager-1").status).toBe(ApprovalStatus.APPROVED);
  });

  it("protege el tiempo aprobado frente a edición sin reversión", () => {
    const submitted: ApprovalRecord = {
      status: ApprovalStatus.SUBMITTED,
      submittedByUserId: "employee-1",
      version: 1
    };
    const approved = approveTimeEntry(submitted, "manager-1");
    expect(() => assertApprovedTimeEditable(approved.status, false)).toThrow("reversión");
    expect(() => assertApprovedTimeEditable(approved.status, true)).not.toThrow();
  });
});
