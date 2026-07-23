import { DomainValidationError } from "../index.js";

export enum ProjectStatus {
  DRAFT = "DRAFT",
  PLANNED = "PLANNED",
  ACTIVE = "ACTIVE",
  ON_HOLD = "ON_HOLD",
  AT_RISK = "AT_RISK",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  ARCHIVED = "ARCHIVED"
}

export enum ApprovalStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  POSTED = "POSTED",
  CANCELLED = "CANCELLED"
}

export interface WeightedProgressItem {
  readonly id: string;
  readonly weightBasisPoints: number;
  readonly completionBasisPoints: number;
}

export interface ProjectBudgetVersion {
  readonly projectId: string;
  readonly version: number;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly reason: string;
  readonly approvedByUserId: string;
  readonly createdAt: Date;
}

export interface ApprovalRecord {
  readonly status: ApprovalStatus;
  readonly submittedByUserId: string;
  readonly approvedByUserId?: string | undefined;
  readonly rejectionReason?: string | undefined;
  readonly version: number;
}

const projectTransitions: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  DRAFT: [ProjectStatus.PLANNED, ProjectStatus.CANCELLED],
  PLANNED: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.CANCELLED],
  ACTIVE: [ProjectStatus.ON_HOLD, ProjectStatus.AT_RISK, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
  ON_HOLD: [ProjectStatus.ACTIVE, ProjectStatus.AT_RISK, ProjectStatus.CANCELLED],
  AT_RISK: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
  COMPLETED: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
  CANCELLED: [ProjectStatus.PLANNED, ProjectStatus.ARCHIVED],
  ARCHIVED: []
};

function nonEmpty(raw: string, code: string, message: string): string {
  const value = raw.trim();
  if (!value) throw new DomainValidationError(code, message);
  return value;
}

export function calculateWeightedProjectProgress(items: readonly WeightedProgressItem[]): number {
  if (items.length === 0) {
    throw new DomainValidationError("PROJECT_PROGRESS_ITEMS_REQUIRED", "El progreso requiere tareas o hitos ponderados.");
  }
  let totalWeight = 0;
  let weightedCompletion = 0;
  for (const item of items) {
    if (
      !Number.isInteger(item.weightBasisPoints) ||
      item.weightBasisPoints <= 0 ||
      !Number.isInteger(item.completionBasisPoints) ||
      item.completionBasisPoints < 0 ||
      item.completionBasisPoints > 10_000
    ) {
      throw new DomainValidationError("PROJECT_PROGRESS_INVALID", "Peso o avance fuera del rango permitido.");
    }
    totalWeight += item.weightBasisPoints;
    weightedCompletion += item.weightBasisPoints * item.completionBasisPoints;
  }
  if (totalWeight !== 10_000) {
    throw new DomainValidationError(
      "PROJECT_WEIGHT_TOTAL_INVALID",
      "Los pesos de tareas o hitos deben sumar exactamente 10 000 puntos básicos."
    );
  }
  return Math.round(weightedCompletion / totalWeight);
}

export function transitionProjectStatus(
  current: ProjectStatus,
  target: ProjectStatus,
  hasClosureEvidence = false
): ProjectStatus {
  if (!projectTransitions[current].includes(target)) {
    throw new DomainValidationError("PROJECT_TRANSITION_INVALID", `No se puede pasar de ${current} a ${target}.`);
  }
  if (target === ProjectStatus.COMPLETED && !hasClosureEvidence) {
    throw new DomainValidationError(
      "PROJECT_CLOSURE_EVIDENCE_REQUIRED",
      "El cierre del proyecto requiere evidencia de entregables."
    );
  }
  return target;
}

export function assertProjectAcceptsOperationalEntry(status: ProjectStatus, reopenedWithPermission = false): void {
  const closed = status === ProjectStatus.COMPLETED ||
    status === ProjectStatus.CANCELLED ||
    status === ProjectStatus.ARCHIVED;
  if (closed && !reopenedWithPermission) {
    throw new DomainValidationError(
      "PROJECT_OPERATION_CLOSED",
      "Un proyecto cerrado no admite tiempo ni gastos sin reapertura autorizada."
    );
  }
}

export function createNextBudgetVersion(
  previous: ProjectBudgetVersion | null,
  input: {
    readonly projectId: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
    readonly reason: string;
    readonly approvedByUserId: string;
    readonly at: Date;
  }
): ProjectBudgetVersion {
  if (input.amountMinorUnits < 0n) {
    throw new DomainValidationError("PROJECT_BUDGET_NEGATIVE", "El presupuesto no puede ser negativo.");
  }
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new DomainValidationError("PROJECT_BUDGET_CURRENCY_INVALID", "La moneda del presupuesto no es válida.");
  }
  if (previous && previous.projectId !== input.projectId) {
    throw new DomainValidationError("PROJECT_BUDGET_PROJECT_MISMATCH", "La versión anterior pertenece a otro proyecto.");
  }
  if (Number.isNaN(input.at.getTime())) {
    throw new DomainValidationError("PROJECT_BUDGET_DATE_INVALID", "La fecha de versión no es válida.");
  }
  return {
    projectId: nonEmpty(input.projectId, "PROJECT_ID_REQUIRED", "El presupuesto requiere proyecto."),
    version: (previous?.version ?? 0) + 1,
    amountMinorUnits: input.amountMinorUnits,
    currency,
    reason: nonEmpty(input.reason, "PROJECT_BUDGET_REASON_REQUIRED", "El cambio de presupuesto requiere motivo."),
    approvedByUserId: nonEmpty(
      input.approvedByUserId,
      "PROJECT_BUDGET_APPROVER_REQUIRED",
      "El cambio de presupuesto requiere aprobación."
    ),
    createdAt: new Date(input.at)
  };
}

export function approveTimeEntry(record: ApprovalRecord, approverUserId: string): ApprovalRecord {
  if (record.status !== ApprovalStatus.SUBMITTED) {
    throw new DomainValidationError("TIME_APPROVAL_INVALID", "Sólo el tiempo enviado puede aprobarse.");
  }
  return {
    ...record,
    status: ApprovalStatus.APPROVED,
    approvedByUserId: nonEmpty(approverUserId, "TIME_APPROVER_REQUIRED", "La aprobación requiere responsable."),
    version: record.version + 1
  };
}

export function assertApprovedTimeEditable(status: ApprovalStatus, hasReversal: boolean): void {
  if ((status === ApprovalStatus.APPROVED || status === ApprovalStatus.POSTED) && !hasReversal) {
    throw new DomainValidationError(
      "TIME_REVERSAL_REQUIRED",
      "El tiempo aprobado no puede editarse sin reversión."
    );
  }
}

export function approveExpenseReport(record: ApprovalRecord, approverUserId: string): ApprovalRecord {
  if (record.status !== ApprovalStatus.SUBMITTED) {
    throw new DomainValidationError("EXPENSE_APPROVAL_INVALID", "Sólo un gasto enviado puede aprobarse.");
  }
  const approver = nonEmpty(approverUserId, "EXPENSE_APPROVER_REQUIRED", "La aprobación requiere responsable.");
  if (approver === record.submittedByUserId) {
    throw new DomainValidationError(
      "EXPENSE_SELF_APPROVAL_FORBIDDEN",
      "El usuario no puede aprobar su propio reporte de gastos."
    );
  }
  return { ...record, status: ApprovalStatus.APPROVED, approvedByUserId: approver, version: record.version + 1 };
}

export function approveScopeChange(input: {
  readonly reason: string;
  readonly requestedByUserId: string;
  readonly approvedByUserId: string;
}): Readonly<{ reason: string; requestedByUserId: string; approvedByUserId: string }> {
  const requestedByUserId = nonEmpty(
    input.requestedByUserId,
    "PROJECT_CHANGE_REQUESTER_REQUIRED",
    "El cambio de alcance requiere solicitante."
  );
  const approvedByUserId = nonEmpty(
    input.approvedByUserId,
    "PROJECT_CHANGE_APPROVER_REQUIRED",
    "El cambio de alcance requiere aprobación."
  );
  if (requestedByUserId === approvedByUserId) {
    throw new DomainValidationError(
      "PROJECT_CHANGE_SELF_APPROVAL_FORBIDDEN",
      "El solicitante no puede aprobar su propio cambio de alcance."
    );
  }
  return {
    reason: nonEmpty(input.reason, "PROJECT_CHANGE_REASON_REQUIRED", "El cambio de alcance requiere motivo."),
    requestedByUserId,
    approvedByUserId
  };
}
