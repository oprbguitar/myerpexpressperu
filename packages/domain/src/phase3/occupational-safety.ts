import { DomainValidationError } from "../index.js";

export enum CorrectiveActionStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  VERIFICATION_PENDING = "VERIFICATION_PENDING",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED"
}

export enum IncidentStatus {
  REPORTED = "REPORTED",
  UNDER_INVESTIGATION = "UNDER_INVESTIGATION",
  ACTION_REQUIRED = "ACTION_REQUIRED",
  CLOSED = "CLOSED"
}

export type OccupationalFitnessStatus =
  | "FIT"
  | "FIT_WITH_RESTRICTIONS"
  | "TEMPORARILY_UNFIT"
  | "UNFIT"
  | "PENDING";

export interface OccupationalFitnessSummary {
  readonly examinationCompleted: boolean;
  readonly examinationDate?: string | undefined;
  readonly expirationDate?: string | undefined;
  readonly fitnessStatus: OccupationalFitnessStatus;
  readonly authorizedWorkRestriction?: string | undefined;
  readonly nextExaminationDate?: string | undefined;
}

export interface ClosureEvidence {
  readonly evidenceDocumentIds: readonly string[];
  readonly documentedException?: string | undefined;
  readonly verifiedByUserId: string;
}

function requireClosureEvidence(evidence: ClosureEvidence): void {
  const hasEvidence = evidence.evidenceDocumentIds.some((id) => id.trim().length > 0);
  const hasException = Boolean(evidence.documentedException?.trim());
  if (!hasEvidence && !hasException) {
    throw new DomainValidationError(
      "SST_CLOSURE_EVIDENCE_REQUIRED",
      "El cierre requiere evidencia o una excepción documentada."
    );
  }
  if (!evidence.verifiedByUserId.trim()) {
    throw new DomainValidationError("SST_CLOSURE_VERIFIER_REQUIRED", "El cierre requiere verificador.");
  }
}

export function calculateRiskLevel(likelihood: number, consequence: number): {
  readonly score: number;
  readonly level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
} {
  if (
    !Number.isInteger(likelihood) ||
    !Number.isInteger(consequence) ||
    likelihood < 1 ||
    likelihood > 5 ||
    consequence < 1 ||
    consequence > 5
  ) {
    throw new DomainValidationError("SST_RISK_INPUT_INVALID", "Probabilidad y consecuencia deben estar entre 1 y 5.");
  }
  const score = likelihood * consequence;
  const level = score <= 4 ? "LOW" : score <= 9 ? "MODERATE" : score <= 16 ? "HIGH" : "CRITICAL";
  return { score, level };
}

const correctiveTransitions: Readonly<Record<CorrectiveActionStatus, readonly CorrectiveActionStatus[]>> = {
  OPEN: [CorrectiveActionStatus.IN_PROGRESS, CorrectiveActionStatus.CANCELLED],
  IN_PROGRESS: [CorrectiveActionStatus.VERIFICATION_PENDING, CorrectiveActionStatus.CANCELLED],
  VERIFICATION_PENDING: [CorrectiveActionStatus.IN_PROGRESS, CorrectiveActionStatus.CLOSED],
  CLOSED: [],
  CANCELLED: []
};

export function transitionCorrectiveAction(
  current: CorrectiveActionStatus,
  target: CorrectiveActionStatus,
  evidence?: ClosureEvidence
): CorrectiveActionStatus {
  if (!correctiveTransitions[current].includes(target)) {
    throw new DomainValidationError("SST_CORRECTIVE_TRANSITION_INVALID", `No se puede pasar de ${current} a ${target}.`);
  }
  if (target === CorrectiveActionStatus.CLOSED) {
    if (!evidence) {
      throw new DomainValidationError("SST_CLOSURE_EVIDENCE_REQUIRED", "El cierre requiere evidencia.");
    }
    requireClosureEvidence(evidence);
  }
  return target;
}

const incidentTransitions: Readonly<Record<IncidentStatus, readonly IncidentStatus[]>> = {
  REPORTED: [IncidentStatus.UNDER_INVESTIGATION],
  UNDER_INVESTIGATION: [IncidentStatus.ACTION_REQUIRED, IncidentStatus.CLOSED],
  ACTION_REQUIRED: [IncidentStatus.UNDER_INVESTIGATION, IncidentStatus.CLOSED],
  CLOSED: []
};

export function transitionIncident(
  current: IncidentStatus,
  target: IncidentStatus,
  evidence?: ClosureEvidence
): IncidentStatus {
  if (!incidentTransitions[current].includes(target)) {
    throw new DomainValidationError("SST_INCIDENT_TRANSITION_INVALID", `No se puede pasar de ${current} a ${target}.`);
  }
  if (target === IncidentStatus.CLOSED) {
    if (!evidence) {
      throw new DomainValidationError("SST_CLOSURE_EVIDENCE_REQUIRED", "El cierre requiere evidencia.");
    }
    requireClosureEvidence(evidence);
  }
  return target;
}

export function assertRestrictedMedicalAccess(input: {
  readonly hasSpecialPermission: boolean;
  readonly auditAccessId?: string | undefined;
  readonly purpose?: string | undefined;
  readonly aiProcessingRequested: boolean;
  readonly explicitAiAuthorization: boolean;
}): void {
  if (!input.hasSpecialPermission) {
    throw new DomainValidationError(
      "SST_MEDICAL_PERMISSION_REQUIRED",
      "El detalle médico requiere permiso especial."
    );
  }
  if (!input.auditAccessId?.trim() || !input.purpose?.trim()) {
    throw new DomainValidationError(
      "SST_MEDICAL_AUDIT_REQUIRED",
      "Cada acceso a detalle médico requiere auditoría y propósito."
    );
  }
  if (input.aiProcessingRequested && !input.explicitAiAuthorization) {
    throw new DomainValidationError(
      "SST_MEDICAL_AI_FORBIDDEN",
      "Los datos médicos no se procesan con IA por defecto."
    );
  }
}

export function validateFitnessSummary(summary: OccupationalFitnessSummary): void {
  if (!summary.examinationCompleted && summary.fitnessStatus !== "PENDING") {
    throw new DomainValidationError(
      "SST_FITNESS_SUMMARY_INVALID",
      "Un examen no completado sólo puede tener estado pendiente."
    );
  }
  if (summary.fitnessStatus === "FIT_WITH_RESTRICTIONS" && !summary.authorizedWorkRestriction?.trim()) {
    throw new DomainValidationError(
      "SST_WORK_RESTRICTION_REQUIRED",
      "La aptitud con restricciones requiere una restricción laboral autorizada."
    );
  }
}
