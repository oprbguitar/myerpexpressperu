import { describe, expect, it } from "vitest";
import {
  LeadStatus,
  OpportunityStatus,
  convertLeadToOpportunity,
  qualifyLead,
  transitionOpportunity,
  validatePipeline,
  type Lead,
  type Opportunity,
  type PipelineStage
} from "./crm.js";

const firstStage: PipelineStage = {
  id: "new",
  name: "Nueva",
  order: 0,
  probabilityBasisPoints: 1_000
};
const wonStage: PipelineStage = {
  id: "won",
  name: "Ganada",
  order: 1,
  probabilityBasisPoints: 10_000,
  terminalStatus: OpportunityStatus.WON
};
const lostStage: PipelineStage = {
  id: "lost",
  name: "Perdida",
  order: 2,
  probabilityBasisPoints: 0,
  terminalStatus: OpportunityStatus.LOST
};

function opportunity(): Opportunity {
  return {
    id: "op-1",
    pipelineId: "pipeline-1",
    stageId: firstStage.id,
    status: OpportunityStatus.OPEN,
    probabilityBasisPoints: 1_000,
    probabilitySource: "PIPELINE_STAGE",
    version: 1
  };
}

describe("dominio CRM", () => {
  it("valida etapas configurables sin IDs ni órdenes repetidos", () => {
    expect(() => validatePipeline([firstStage, wonStage, lostStage])).not.toThrow();
    expect(() => validatePipeline([firstStage, { ...wonStage, order: 0 }])).toThrow("repetidos");
  });

  it("califica y convierte un lead preservando trazabilidad", () => {
    const lead: Lead = {
      id: "lead-1",
      status: LeadStatus.NEW,
      sourceId: "web",
      responsibleUserId: "seller-1",
      version: 1
    };
    const qualified = qualifyLead(lead);
    const converted = convertLeadToOpportunity(qualified, "op-1", "pipeline-1", firstStage);
    expect(converted.lead.status).toBe(LeadStatus.CONVERTED);
    expect(converted.opportunity.probabilityBasisPoints).toBe(1_000);
    expect(converted.events[0]?.type).toBe("crm.lead.converted");
  });

  it("exige cliente o conversión para marcar ganada", () => {
    expect(() => transitionOpportunity({
      opportunity: opportunity(),
      targetStage: wonStage,
      changedByUserId: "seller-1",
      decisionSource: "USER"
    })).toThrow("cliente o una conversión");
    expect(transitionOpportunity({
      opportunity: opportunity(),
      targetStage: wonStage,
      customerId: "customer-1",
      changedByUserId: "seller-1",
      decisionSource: "USER"
    }).opportunity.status).toBe(OpportunityStatus.WON);
  });

  it("exige motivo al perder y audita el cambio de etapa", () => {
    expect(() => transitionOpportunity({
      opportunity: opportunity(),
      targetStage: lostStage,
      changedByUserId: "seller-1",
      decisionSource: "USER"
    })).toThrow("requiere motivo");
    const result = transitionOpportunity({
      opportunity: opportunity(),
      targetStage: lostStage,
      changedByUserId: "seller-1",
      decisionSource: "USER",
      lostReason: "Sin presupuesto"
    });
    expect(result.opportunity.lostReason).toBe("Sin presupuesto");
    expect(result.events[0]?.type).toBe("crm.opportunity.stage-changed");
  });

  it("impide que una recomendación de IA adopte una decisión final", () => {
    expect(() => transitionOpportunity({
      opportunity: opportunity(),
      targetStage: wonStage,
      customerId: "customer-1",
      changedByUserId: "assistant",
      decisionSource: "AI_RECOMMENDATION"
    })).toThrow("IA no puede");
  });
});
