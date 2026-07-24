/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { describe, expect, it } from "vitest";
import {
  AssetStatus,
  MaintenanceWorkOrderStatus,
  calculateNextMeterMaintenance,
  retireAsset,
  transferAsset,
  transitionMaintenanceWorkOrder,
  type AssetAssignment
} from "./assets-maintenance.js";

const assignment: AssetAssignment = {
  id: "assignment-1",
  assetId: "asset-1",
  responsibleUserId: "employee-1",
  locationId: "warehouse-1",
  assignedAt: new Date("2026-07-01T00:00:00.000Z")
};

describe("dominio de activos y mantenimiento", () => {
  it("transfiere creando una nueva asignación y cerrando la anterior", () => {
    const result = transferAsset({
      assetId: "asset-1",
      status: AssetStatus.ASSIGNED,
      currentAssignment: assignment,
      destinationLocationId: "branch-2",
      destinationResponsibleUserId: "employee-2",
      transferAt: new Date("2026-07-23T00:00:00.000Z"),
      nextAssignmentId: "assignment-2"
    });
    expect(result.previous.endedAt).toEqual(new Date("2026-07-23T00:00:00.000Z"));
    expect(result.next.locationId).toBe("branch-2");
    expect(assignment.endedAt).toBeUndefined();
  });

  it("exige origen y destino diferentes e impide transferir retirados", () => {
    expect(() => transferAsset({
      assetId: "asset-1",
      status: AssetStatus.ASSIGNED,
      currentAssignment: assignment,
      destinationLocationId: "warehouse-1",
      transferAt: new Date(),
      nextAssignmentId: "assignment-2"
    })).toThrow("diferentes");
    expect(() => transferAsset({
      assetId: "asset-1",
      status: AssetStatus.RETIRED,
      currentAssignment: assignment,
      destinationLocationId: "branch-2",
      transferAt: new Date(),
      nextAssignmentId: "assignment-2"
    })).toThrow("retirado");
  });

  it("cierra mantenimiento con tareas, evidencia y verificación", () => {
    expect(() => transitionMaintenanceWorkOrder(
      MaintenanceWorkOrderStatus.VERIFICATION_PENDING,
      MaintenanceWorkOrderStatus.COMPLETED,
      {
        evidenceDocumentIds: [],
        completedTaskIds: ["task-1"],
        requiredTaskIds: ["task-1"],
        verifiedByUserId: "manager-1",
        downtimeMinutes: 30
      }
    )).toThrow("evidencia");
    expect(transitionMaintenanceWorkOrder(
      MaintenanceWorkOrderStatus.VERIFICATION_PENDING,
      MaintenanceWorkOrderStatus.COMPLETED,
      {
        evidenceDocumentIds: ["document-1"],
        completedTaskIds: ["task-1"],
        requiredTaskIds: ["task-1"],
        verifiedByUserId: "manager-1",
        downtimeMinutes: 30
      }
    )).toBe(MaintenanceWorkOrderStatus.COMPLETED);
  });

  it("mantiene activos retirados como estado auditable", () => {
    expect(retireAsset(AssetStatus.OUT_OF_SERVICE, "Fin de vida útil", "document-1"))
      .toBe(AssetStatus.RETIRED);
  });

  it("calcula mantenimiento preventivo por lectura", () => {
    expect(calculateNextMeterMaintenance({
      lastServiceReading: 10_000,
      interval: 5_000,
      currentReading: 15_100
    })).toEqual({ nextServiceReading: 15_000, due: true });
  });
});
