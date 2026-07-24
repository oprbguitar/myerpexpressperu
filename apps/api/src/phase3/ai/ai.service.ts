/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { AiCitation, AiDataCategory, AuthenticatedContext } from "@erp/contracts";
import { assessUntrustedContent, redactStructured, redactText } from "@erp/security";
import { ProviderManagementService } from "../providers/provider-management.service.js";
import { ProviderPolicyError } from "../providers/provider-errors.js";
import type { AiFeedbackInput, AiQueryInput } from "./ai.schemas.js";
import {
  ControlledAiToolRegistry,
  createDefaultToolRegistry
} from "./tool-registry.js";

interface AiPolicy {
  readonly enabled: boolean;
  readonly allowedDataCategories: readonly AiDataCategory[];
  readonly dailyRequestLimit: number;
}

interface UsageEntry {
  readonly interactionId: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly actorUserId: string;
  readonly providerId: string;
  readonly model: string;
  readonly createdAt: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly mock: boolean;
}

interface FeedbackEntry extends AiFeedbackInput {
  readonly tenantId: string;
  readonly companyId: string;
  readonly actorUserId: string;
  readonly createdAt: string;
}

const alwaysProhibited = new Set<AiDataCategory>(["MEDICAL", "CREDENTIAL", "PROVIDER_SECRET"]);
const prohibitedPromptData =
  /\b(?:paciente|vih|sida|c[aá]ncer|diabetes|insulina|medicaci[oó]n|embaraz|salud\s+mental|diagn[oó]stic|historia\s+cl[ií]nica|resultado\s+m[eé]dico|tratamiento\s+m[eé]dico|contrase(?:ñ|n)a|api[_ -]?key|access[_ -]?token|token\s+secreto|private[_ -]?key|provider[_ -]?secret|credencial)\b/i;

@Injectable()
export class AiAssistanceService {
  private policy: AiPolicy = {
    enabled: false,
    allowedDataCategories: ["PUBLIC", "INTERNAL"],
    dailyRequestLimit: 100
  };
  private readonly usage: UsageEntry[] = [];
  private readonly feedback: FeedbackEntry[] = [];

  constructor(
    private readonly providers: ProviderManagementService,
    private readonly tools: ControlledAiToolRegistry = createDefaultToolRegistry()
  ) {}

  configurePolicy(policy: AiPolicy): void {
    if (policy.allowedDataCategories.some((category) => alwaysProhibited.has(category))) {
      throw new ProviderPolicyError("AI_POLICY_DATA_PROHIBITED", "La política incluye una categoría de datos prohibida.");
    }
    this.policy = { ...policy };
  }

  async query(input: AiQueryInput, auth: AuthenticatedContext, requestId: string): Promise<{
    readonly interactionId: string;
    readonly content: string;
    readonly citations: readonly AiCitation[];
    readonly provider: { readonly id: string; readonly model: string; readonly mock: boolean };
    readonly excludedDocuments: readonly { readonly sourceId: string; readonly findings: readonly string[] }[];
    readonly warning: string;
  }> {
    if (!this.policy.enabled) {
      throw new ProviderPolicyError("AI_DISABLED", "La asistencia de IA está deshabilitada.");
    }
    const today = new Date().toISOString().slice(0, 10);
    const usageToday = this.usage.filter((entry) =>
      entry.companyId === auth.companyId && entry.createdAt.startsWith(today)
    ).length;
    if (usageToday >= this.policy.dailyRequestLimit) {
      throw new ProviderPolicyError("AI_DAILY_BUDGET_EXCEEDED", "Se alcanzó el límite diario de solicitudes.");
    }

    const promptAssessment = assessUntrustedContent(input.prompt);
    if (!promptAssessment.accepted) {
      throw new ProviderPolicyError("AI_PROMPT_POLICY_VIOLATION", "La consulta contiene instrucciones no permitidas.");
    }
    if (prohibitedPromptData.test(promptAssessment.boundedContent)) {
      throw new ProviderPolicyError(
        "AI_PROMPT_SENSITIVE_DATA_PROHIBITED",
        "La consulta contiene datos médicos, credenciales o secretos que no pueden procesarse."
      );
    }

    const excludedDocuments: { sourceId: string; findings: readonly string[] }[] = [];
    const acceptedDocuments = input.documents.flatMap((document) => {
      if (document.dataCategories.some((category) =>
        alwaysProhibited.has(category) || !this.policy.allowedDataCategories.includes(category)
      )) {
        excludedDocuments.push({ sourceId: document.sourceId, findings: ["DATA_CATEGORY_NOT_ALLOWED"] });
        return [];
      }
      const assessment = assessUntrustedContent(document.content);
      if (!assessment.accepted) {
        excludedDocuments.push({ sourceId: document.sourceId, findings: assessment.findings });
        return [];
      }
      return [{
        sourceId: document.sourceId,
        content: redactText(assessment.boundedContent),
        trust: "UNTRUSTED_DOCUMENT_CONTENT" as const,
        dataCategories: document.dataCategories
      }];
    });

    const toolPolicy = input.tool ? this.tools.policyFor(input.tool.name) : undefined;
    if (toolPolicy?.allowedDataCategories.some((category) =>
      alwaysProhibited.has(category) || !this.policy.allowedDataCategories.includes(category)
    )) {
      throw new ProviderPolicyError(
        "AI_TOOL_DATA_CATEGORY_NOT_ALLOWED",
        "La herramienta produce una categoría de datos no permitida por la política activa."
      );
    }
    const toolResult = input.tool
      ? await this.tools.execute(input.tool.name, input.tool.input, {
          actorUserId: auth.userId,
          permissions: auth.permissions,
          scope: { tenantId: auth.tenantId, companyId: auth.companyId, branchIds: auth.branchIds },
          requestId,
          correlationId: requestId
        })
      : undefined;
    const toolContext = toolResult
      ? [{
          sourceId: `tool:${input.tool?.name ?? "registered-tool"}`,
          content: JSON.stringify(redactStructured(toolResult.output)),
          trust: "UNTRUSTED_DOCUMENT_CONTENT" as const,
          dataCategories: toolPolicy?.allowedDataCategories ?? []
        }]
      : [];
    const provider = this.providers.getActiveAiProvider(auth);
    const result = await provider.complete({
      context: {
        tenantId: auth.tenantId,
        companyId: auth.companyId,
        actorUserId: auth.userId,
        requestId,
        correlationId: requestId,
        timeoutMs: 15_000
      },
      systemInstruction: "Asiste al usuario del ERP con información acotada a la empresa activa.",
      userPrompt: redactText(promptAssessment.boundedContent),
      supportingContext: [...acceptedDocuments, ...toolContext],
      maximumOutputTokens: input.maximumOutputTokens,
      allowedDataCategories: this.policy.allowedDataCategories
    });
    const interactionId = randomUUID();
    this.usage.push({
      interactionId,
      tenantId: auth.tenantId,
      companyId: auth.companyId,
      actorUserId: auth.userId,
      providerId: result.providerId,
      model: result.model,
      createdAt: result.completedAt,
      inputTokens: result.inputTokens ?? 0,
      outputTokens: result.outputTokens ?? 0,
      mock: result.mock
    });
    const toolCitations: AiCitation[] = (toolResult?.citations ?? []).map((citation) => ({
      sourceId: `${citation.recordType}:${citation.recordId}`,
      label: citation.label,
      sourceType: "TOOL",
      retrievedAt: new Date().toISOString()
    }));
    return {
      interactionId,
      content: result.content,
      citations: [...toolCitations, ...result.citations],
      provider: { id: result.providerId, model: result.model, mock: result.mock },
      excludedDocuments,
      warning: "Asistencia generada por IA. Verifique las fuentes; no constituye una decisión ni ejecuta acciones."
    };
  }

  recordFeedback(input: AiFeedbackInput, auth: AuthenticatedContext): void {
    const interaction = this.usage.find((entry) =>
      entry.interactionId === input.interactionId &&
      entry.tenantId === auth.tenantId &&
      entry.companyId === auth.companyId
    );
    if (!interaction) throw new ProviderPolicyError("AI_INTERACTION_NOT_FOUND", "La interacción no existe en este ámbito.");
    this.feedback.push({
      ...input,
      tenantId: auth.tenantId,
      companyId: auth.companyId,
      actorUserId: auth.userId,
      createdAt: new Date().toISOString()
    });
  }

  usageSummary(auth: AuthenticatedContext): {
    readonly interactions: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly contentLogged: false;
  } {
    const scoped = this.usage.filter((entry) =>
      entry.tenantId === auth.tenantId && entry.companyId === auth.companyId
    );
    return {
      interactions: scoped.length,
      inputTokens: scoped.reduce((sum, entry) => sum + entry.inputTokens, 0),
      outputTokens: scoped.reduce((sum, entry) => sum + entry.outputTokens, 0),
      contentLogged: false
    };
  }
}
