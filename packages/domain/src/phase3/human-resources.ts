/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { DomainValidationError } from "../index.js";

export enum EmployeeStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  INACTIVE = "INACTIVE",
  EXITED = "EXITED"
}

export interface EmployeeRecord {
  readonly id: string;
  readonly partyId: string;
  readonly systemUserId?: string | undefined;
  readonly status: EmployeeStatus;
  readonly version: number;
}

export interface EmploymentContractVersion {
  readonly employeeId: string;
  readonly version: number;
  readonly contractType: string;
  readonly startDate: string;
  readonly endDate?: string | undefined;
  readonly workingScheduleReference: string;
  readonly salaryReferenceMinorUnits?: bigint | undefined;
  readonly changeReason: string;
}

export interface EmployeeStatusHistory {
  readonly employeeId: string;
  readonly previousStatus: EmployeeStatus;
  readonly status: EmployeeStatus;
  readonly reason: string;
  readonly changedByUserId: string;
  readonly changedAt: Date;
}

const employeeTransitions: Readonly<Record<EmployeeStatus, readonly EmployeeStatus[]>> = {
  DRAFT: [EmployeeStatus.ACTIVE, EmployeeStatus.INACTIVE],
  ACTIVE: [EmployeeStatus.SUSPENDED, EmployeeStatus.INACTIVE],
  SUSPENDED: [EmployeeStatus.ACTIVE, EmployeeStatus.INACTIVE],
  INACTIVE: [EmployeeStatus.ACTIVE, EmployeeStatus.EXITED],
  EXITED: []
};

function required(raw: string | undefined, code: string, message: string): string {
  const value = raw?.trim();
  if (!value) throw new DomainValidationError(code, message);
  return value;
}

function assertIsoDate(raw: string, code: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00.000Z`))) {
    throw new DomainValidationError(code, "La fecha debe usar el formato ISO YYYY-MM-DD.");
  }
}

export function transitionEmployee(input: {
  readonly employee: EmployeeRecord;
  readonly target: EmployeeStatus;
  readonly reason: string;
  readonly changedByUserId: string;
  readonly at: Date;
}): { readonly employee: EmployeeRecord; readonly history: EmployeeStatusHistory } {
  if (!employeeTransitions[input.employee.status].includes(input.target)) {
    throw new DomainValidationError(
      "HR_EMPLOYEE_TRANSITION_INVALID",
      `No se puede pasar de ${input.employee.status} a ${input.target}.`
    );
  }
  if (Number.isNaN(input.at.getTime())) {
    throw new DomainValidationError("HR_STATUS_DATE_INVALID", "La fecha del cambio no es válida.");
  }
  const reason = required(input.reason, "HR_STATUS_REASON_REQUIRED", "El cambio de estado requiere motivo.");
  const changedByUserId = required(
    input.changedByUserId,
    "HR_STATUS_ACTOR_REQUIRED",
    "El cambio de estado requiere responsable."
  );
  return {
    employee: { ...input.employee, status: input.target, version: input.employee.version + 1 },
    history: {
      employeeId: input.employee.id,
      previousStatus: input.employee.status,
      status: input.target,
      reason,
      changedByUserId,
      changedAt: new Date(input.at)
    }
  };
}

export function createNextContractVersion(
  previous: EmploymentContractVersion | null,
  input: Omit<EmploymentContractVersion, "version">
): EmploymentContractVersion {
  if (previous && previous.employeeId !== input.employeeId) {
    throw new DomainValidationError("HR_CONTRACT_EMPLOYEE_MISMATCH", "El contrato previo pertenece a otro empleado.");
  }
  assertIsoDate(input.startDate, "HR_CONTRACT_START_DATE_INVALID");
  if (input.endDate) {
    assertIsoDate(input.endDate, "HR_CONTRACT_END_DATE_INVALID");
    if (input.endDate < input.startDate) {
      throw new DomainValidationError(
        "HR_CONTRACT_DATE_RANGE_INVALID",
        "La fecha final del contrato no puede ser anterior a la inicial."
      );
    }
  }
  if (input.salaryReferenceMinorUnits !== undefined && input.salaryReferenceMinorUnits < 0n) {
    throw new DomainValidationError("HR_SALARY_REFERENCE_INVALID", "La referencia salarial no puede ser negativa.");
  }
  return {
    employeeId: required(input.employeeId, "HR_EMPLOYEE_ID_REQUIRED", "El contrato requiere empleado."),
    version: (previous?.version ?? 0) + 1,
    contractType: required(input.contractType, "HR_CONTRACT_TYPE_REQUIRED", "El contrato requiere tipo."),
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    workingScheduleReference: required(
      input.workingScheduleReference,
      "HR_WORKING_SCHEDULE_REQUIRED",
      "El contrato requiere horario de trabajo."
    ),
    ...(input.salaryReferenceMinorUnits !== undefined
      ? { salaryReferenceMinorUnits: input.salaryReferenceMinorUnits }
      : {}),
    changeReason: required(
      input.changeReason,
      "HR_CONTRACT_CHANGE_REASON_REQUIRED",
      "Cada versión contractual requiere motivo."
    )
  };
}

export function assertSalaryReferenceAccess(hasRestrictedPermission: boolean): void {
  if (!hasRestrictedPermission) {
    throw new DomainValidationError(
      "HR_SALARY_REFERENCE_FORBIDDEN",
      "La referencia salarial requiere permiso restringido."
    );
  }
}

export function completeEmployeeExit(input: {
  readonly employee: EmployeeRecord;
  readonly requiredChecklistItemIds: readonly string[];
  readonly completedChecklistItemIds: readonly string[];
  readonly reason: string;
  readonly changedByUserId: string;
  readonly at: Date;
}): { readonly employee: EmployeeRecord; readonly history: EmployeeStatusHistory } {
  if (input.employee.status !== EmployeeStatus.INACTIVE) {
    throw new DomainValidationError("HR_EXIT_STATUS_INVALID", "El empleado debe estar inactivo antes de completar la salida.");
  }
  const completed = new Set(input.completedChecklistItemIds);
  const pending = input.requiredChecklistItemIds.filter((item) => !completed.has(item));
  if (pending.length > 0) {
    throw new DomainValidationError(
      "HR_EXIT_CHECKLIST_PENDING",
      `La lista de salida tiene elementos pendientes: ${pending.join(", ")}.`
    );
  }
  return transitionEmployee({
    employee: input.employee,
    target: EmployeeStatus.EXITED,
    reason: input.reason,
    changedByUserId: input.changedByUserId,
    at: input.at
  });
}

export type HrExportField =
  | "employeeCode"
  | "displayName"
  | "position"
  | "area"
  | "branch"
  | "contractType"
  | "salaryReference";

export function allowedHrExportFields(
  requested: readonly HrExportField[],
  canExportSalaryReference: boolean
): readonly HrExportField[] {
  return requested.filter((field) => field !== "salaryReference" || canExportSalaryReference);
}
