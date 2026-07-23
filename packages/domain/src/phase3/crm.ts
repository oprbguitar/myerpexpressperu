import { DomainValidationError, type DomainEvent } from "../index.js";

export enum LeadStatus {
  NEW = "NEW",
  QUALIFIED = "QUALIFIED",
  DISQUALIFIED = "DISQUALIFIED",
  CONVERTED = "CONVERTED"
}

export enum OpportunityStatus {
  OPEN = "OPEN",
  WON = "WON",
  LOST = "LOST"
}

export type ProbabilitySource = "MANUAL" | "PIPELINE_STAGE";
export type OpportunityDecisionSource = "USER" | "AI_RECOMMENDATION";

export interface PipelineStage {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly probabilityBasisPoints: number;
  readonly terminalStatus?: OpportunityStatus.WON | OpportunityStatus.LOST | undefined;
}

export interface Lead {
  readonly id: string;
  readonly status: LeadStatus;
  readonly sourceId: string;
  readonly responsibleUserId: string;
  readonly version: number;
}

export interface Opportunity {
  readonly id: string;
  readonly pipelineId: string;
  readonly stageId: string;
  readonly status: OpportunityStatus;
  readonly probabilityBasisPoints: number;
  readonly probabilitySource: ProbabilitySource;
  readonly customerId?: string | undefined;
  readonly convertedPartyId?: string | undefined;
  readonly lostReason?: string | undefined;
  readonly version: number;
}

export interface OpportunityTransitionResult {
  readonly opportunity: Opportunity;
  readonly events: readonly DomainEvent[];
}

function requiredText(value: string | undefined, code: string, message: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new DomainValidationError(code, message);
  return normalized;
}

function assertProbability(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new DomainValidationError(
      "CRM_PROBABILITY_INVALID",
      "La probabilidad debe expresarse entre 0 y 10 000 puntos básicos."
    );
  }
}

export function validatePipeline(stages: readonly PipelineStage[]): void {
  if (stages.length === 0) {
    throw new DomainValidationError("CRM_PIPELINE_EMPTY", "El pipeline requiere al menos una etapa.");
  }
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const stage of stages) {
    requiredText(stage.id, "CRM_STAGE_ID_REQUIRED", "La etapa requiere identificador.");
    requiredText(stage.name, "CRM_STAGE_NAME_REQUIRED", "La etapa requiere nombre.");
    assertProbability(stage.probabilityBasisPoints);
    if (!Number.isInteger(stage.order) || stage.order < 0) {
      throw new DomainValidationError("CRM_STAGE_ORDER_INVALID", "El orden de etapa debe ser un entero no negativo.");
    }
    if (ids.has(stage.id) || orders.has(stage.order)) {
      throw new DomainValidationError("CRM_STAGE_DUPLICATE", "El pipeline no admite IDs ni órdenes repetidos.");
    }
    ids.add(stage.id);
    orders.add(stage.order);
  }
}

export function qualifyLead(lead: Lead): Lead {
  if (lead.status !== LeadStatus.NEW) {
    throw new DomainValidationError("CRM_LEAD_QUALIFICATION_INVALID", "Sólo un lead nuevo puede calificarse.");
  }
  return { ...lead, status: LeadStatus.QUALIFIED, version: lead.version + 1 };
}

export function convertLeadToOpportunity(
  lead: Lead,
  opportunityId: string,
  pipelineId: string,
  firstStage: PipelineStage
): { readonly lead: Lead; readonly opportunity: Opportunity; readonly events: readonly DomainEvent[] } {
  if (lead.status !== LeadStatus.QUALIFIED) {
    throw new DomainValidationError("CRM_LEAD_CONVERSION_INVALID", "Sólo un lead calificado puede convertirse.");
  }
  const at = new Date();
  const opportunity: Opportunity = {
    id: requiredText(opportunityId, "CRM_OPPORTUNITY_ID_REQUIRED", "La oportunidad requiere identificador."),
    pipelineId: requiredText(pipelineId, "CRM_PIPELINE_ID_REQUIRED", "La oportunidad requiere pipeline."),
    stageId: firstStage.id,
    status: OpportunityStatus.OPEN,
    probabilityBasisPoints: firstStage.probabilityBasisPoints,
    probabilitySource: "PIPELINE_STAGE",
    version: 1
  };
  return {
    lead: { ...lead, status: LeadStatus.CONVERTED, version: lead.version + 1 },
    opportunity,
    events: [{
      type: "crm.lead.converted",
      occurredAt: at,
      payload: { leadId: lead.id, opportunityId: opportunity.id }
    }]
  };
}

export function transitionOpportunity(input: {
  readonly opportunity: Opportunity;
  readonly targetStage: PipelineStage;
  readonly changedByUserId: string;
  readonly decisionSource: OpportunityDecisionSource;
  readonly probabilityBasisPoints?: number | undefined;
  readonly lostReason?: string | undefined;
  readonly customerId?: string | undefined;
  readonly convertedPartyId?: string | undefined;
}): OpportunityTransitionResult {
  if (input.opportunity.status !== OpportunityStatus.OPEN) {
    throw new DomainValidationError("CRM_OPPORTUNITY_CLOSED", "Una oportunidad cerrada no admite cambios de etapa.");
  }
  if (input.decisionSource === "AI_RECOMMENDATION" && input.targetStage.terminalStatus) {
    throw new DomainValidationError(
      "CRM_AI_FINAL_DECISION_FORBIDDEN",
      "La IA no puede marcar automáticamente una oportunidad como ganada o perdida."
    );
  }

  const nextStatus = input.targetStage.terminalStatus ?? OpportunityStatus.OPEN;
  const lostReason = nextStatus === OpportunityStatus.LOST
    ? requiredText(input.lostReason, "CRM_LOST_REASON_REQUIRED", "Una oportunidad perdida requiere motivo.")
    : undefined;
  const customerId = input.customerId?.trim() || input.opportunity.customerId;
  const convertedPartyId = input.convertedPartyId?.trim() || input.opportunity.convertedPartyId;
  if (nextStatus === OpportunityStatus.WON && !customerId && !convertedPartyId) {
    throw new DomainValidationError(
      "CRM_WON_CUSTOMER_REQUIRED",
      "Una oportunidad ganada debe referenciar un cliente o una conversión."
    );
  }

  const manualProbability = input.probabilityBasisPoints;
  if (manualProbability !== undefined) assertProbability(manualProbability);
  const probabilityBasisPoints = manualProbability ?? input.targetStage.probabilityBasisPoints;
  const probabilitySource: ProbabilitySource = manualProbability === undefined ? "PIPELINE_STAGE" : "MANUAL";
  const changedByUserId = requiredText(
    input.changedByUserId,
    "CRM_STAGE_ACTOR_REQUIRED",
    "El cambio de etapa requiere usuario responsable."
  );
  const opportunity: Opportunity = {
    ...input.opportunity,
    stageId: input.targetStage.id,
    status: nextStatus,
    probabilityBasisPoints,
    probabilitySource,
    ...(customerId ? { customerId } : {}),
    ...(convertedPartyId ? { convertedPartyId } : {}),
    ...(lostReason ? { lostReason } : {}),
    version: input.opportunity.version + 1
  };
  return {
    opportunity,
    events: [{
      type: "crm.opportunity.stage-changed",
      occurredAt: new Date(),
      payload: {
        opportunityId: input.opportunity.id,
        previousStageId: input.opportunity.stageId,
        stageId: input.targetStage.id,
        status: nextStatus,
        changedByUserId
      }
    }]
  };
}

export function assertPrivateNoteAccess(canManagePrivateNotes: boolean): void {
  if (!canManagePrivateNotes) {
    throw new DomainValidationError(
      "CRM_PRIVATE_NOTE_FORBIDDEN",
      "Las notas privadas requieren permiso explícito."
    );
  }
}
