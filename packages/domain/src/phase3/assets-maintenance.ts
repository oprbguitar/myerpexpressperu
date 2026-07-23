import { DomainValidationError } from "../index.js";

export enum AssetStatus {
  AVAILABLE = "AVAILABLE",
  ASSIGNED = "ASSIGNED",
  IN_MAINTENANCE = "IN_MAINTENANCE",
  OUT_OF_SERVICE = "OUT_OF_SERVICE",
  RETIRED = "RETIRED"
}

export enum MaintenanceWorkOrderStatus {
  OPEN = "OPEN",
  SCHEDULED = "SCHEDULED",
  IN_PROGRESS = "IN_PROGRESS",
  VERIFICATION_PENDING = "VERIFICATION_PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export interface AssetAssignment {
  readonly id: string;
  readonly assetId: string;
  readonly responsibleUserId?: string | undefined;
  readonly locationId: string;
  readonly assignedAt: Date;
  readonly endedAt?: Date | undefined;
}

export interface MaintenanceClosure {
  readonly evidenceDocumentIds: readonly string[];
  readonly completedTaskIds: readonly string[];
  readonly requiredTaskIds: readonly string[];
  readonly verifiedByUserId: string;
  readonly downtimeMinutes: number;
}

function required(value: string | undefined, code: string, message: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new DomainValidationError(code, message);
  return normalized;
}

export function transferAsset(input: {
  readonly assetId: string;
  readonly status: AssetStatus;
  readonly currentAssignment: AssetAssignment;
  readonly destinationLocationId: string;
  readonly destinationResponsibleUserId?: string | undefined;
  readonly transferAt: Date;
  readonly nextAssignmentId: string;
}): { readonly previous: AssetAssignment; readonly next: AssetAssignment; readonly status: AssetStatus } {
  if (input.status === AssetStatus.RETIRED) {
    throw new DomainValidationError("ASSET_RETIRED_OPERATION_FORBIDDEN", "Un activo retirado no puede transferirse.");
  }
  if (input.currentAssignment.assetId !== input.assetId || input.currentAssignment.endedAt) {
    throw new DomainValidationError("ASSET_ASSIGNMENT_INVALID", "La asignación de origen no está activa para el activo.");
  }
  const destinationLocationId = required(
    input.destinationLocationId,
    "ASSET_DESTINATION_REQUIRED",
    "La transferencia requiere ubicación de destino."
  );
  required(input.currentAssignment.locationId, "ASSET_SOURCE_REQUIRED", "La transferencia requiere ubicación de origen.");
  if (input.currentAssignment.locationId === destinationLocationId) {
    throw new DomainValidationError(
      "ASSET_TRANSFER_DESTINATION_SAME",
      "El origen y el destino de la transferencia deben ser diferentes."
    );
  }
  if (Number.isNaN(input.transferAt.getTime()) || input.transferAt < input.currentAssignment.assignedAt) {
    throw new DomainValidationError("ASSET_TRANSFER_DATE_INVALID", "La fecha de transferencia no es válida.");
  }
  const previous: AssetAssignment = { ...input.currentAssignment, endedAt: new Date(input.transferAt) };
  const next: AssetAssignment = {
    id: required(input.nextAssignmentId, "ASSET_ASSIGNMENT_ID_REQUIRED", "La asignación requiere identificador."),
    assetId: input.assetId,
    ...(input.destinationResponsibleUserId?.trim()
      ? { responsibleUserId: input.destinationResponsibleUserId.trim() }
      : {}),
    locationId: destinationLocationId,
    assignedAt: new Date(input.transferAt)
  };
  return { previous, next, status: AssetStatus.ASSIGNED };
}

const workOrderTransitions: Readonly<Record<MaintenanceWorkOrderStatus, readonly MaintenanceWorkOrderStatus[]>> = {
  OPEN: [MaintenanceWorkOrderStatus.SCHEDULED, MaintenanceWorkOrderStatus.IN_PROGRESS, MaintenanceWorkOrderStatus.CANCELLED],
  SCHEDULED: [MaintenanceWorkOrderStatus.IN_PROGRESS, MaintenanceWorkOrderStatus.CANCELLED],
  IN_PROGRESS: [MaintenanceWorkOrderStatus.VERIFICATION_PENDING, MaintenanceWorkOrderStatus.CANCELLED],
  VERIFICATION_PENDING: [MaintenanceWorkOrderStatus.IN_PROGRESS, MaintenanceWorkOrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: []
};

export function transitionMaintenanceWorkOrder(
  current: MaintenanceWorkOrderStatus,
  target: MaintenanceWorkOrderStatus,
  closure?: MaintenanceClosure
): MaintenanceWorkOrderStatus {
  if (!workOrderTransitions[current].includes(target)) {
    throw new DomainValidationError(
      "MAINTENANCE_TRANSITION_INVALID",
      `No se puede pasar de ${current} a ${target}.`
    );
  }
  if (target === MaintenanceWorkOrderStatus.COMPLETED) {
    if (!closure || !closure.evidenceDocumentIds.some((id) => id.trim().length > 0)) {
      throw new DomainValidationError(
        "MAINTENANCE_EVIDENCE_REQUIRED",
        "El cierre de mantenimiento requiere evidencia del trabajo."
      );
    }
    const completed = new Set(closure.completedTaskIds);
    const pending = closure.requiredTaskIds.filter((taskId) => !completed.has(taskId));
    if (pending.length > 0) {
      throw new DomainValidationError(
        "MAINTENANCE_TASKS_PENDING",
        `Hay tareas de mantenimiento pendientes: ${pending.join(", ")}.`
      );
    }
    required(
      closure.verifiedByUserId,
      "MAINTENANCE_VERIFIER_REQUIRED",
      "El cierre de mantenimiento requiere verificador."
    );
    if (!Number.isInteger(closure.downtimeMinutes) || closure.downtimeMinutes < 0) {
      throw new DomainValidationError(
        "MAINTENANCE_DOWNTIME_INVALID",
        "El tiempo de indisponibilidad debe ser un entero no negativo."
      );
    }
  }
  return target;
}

export function retireAsset(status: AssetStatus, reason: string, evidenceDocumentId: string): AssetStatus {
  if (status === AssetStatus.RETIRED) {
    throw new DomainValidationError("ASSET_ALREADY_RETIRED", "El activo ya está retirado.");
  }
  required(reason, "ASSET_RETIREMENT_REASON_REQUIRED", "El retiro del activo requiere motivo.");
  required(evidenceDocumentId, "ASSET_RETIREMENT_EVIDENCE_REQUIRED", "El retiro del activo requiere evidencia.");
  return AssetStatus.RETIRED;
}

export function calculateNextMeterMaintenance(input: {
  readonly lastServiceReading: number;
  readonly interval: number;
  readonly currentReading: number;
}): { readonly nextServiceReading: number; readonly due: boolean } {
  if (
    !Number.isFinite(input.lastServiceReading) ||
    !Number.isFinite(input.interval) ||
    !Number.isFinite(input.currentReading) ||
    input.lastServiceReading < 0 ||
    input.interval <= 0 ||
    input.currentReading < input.lastServiceReading
  ) {
    throw new DomainValidationError("MAINTENANCE_METER_INVALID", "Las lecturas del plan de mantenimiento no son válidas.");
  }
  const nextServiceReading = input.lastServiceReading + input.interval;
  return { nextServiceReading, due: input.currentReading >= nextServiceReading };
}
