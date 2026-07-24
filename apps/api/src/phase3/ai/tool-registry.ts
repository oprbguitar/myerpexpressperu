/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { z } from "zod";
import type {
  AiDataCategory,
  AiToolPolicy,
  AiToolResult,
  AiToolScope
} from "@erp/contracts";
import { redactStructured } from "@erp/security";
import { ProviderPolicyError } from "../providers/provider-errors.js";

export interface AiToolExecutionContext {
  readonly actorUserId: string;
  readonly permissions: ReadonlySet<string>;
  readonly scope: AiToolScope;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface AiToolDefinition<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly policy: AiToolPolicy;
  readonly execute: (
    input: TInput,
    context: AiToolExecutionContext
  ) => Promise<AiToolResult<TOutput>>;
}

interface RegisteredAiTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<unknown>;
  readonly policy: AiToolPolicy;
  readonly execute: (
    input: unknown,
    context: AiToolExecutionContext
  ) => Promise<AiToolResult<unknown>>;
}

const prohibitedCategories = new Set<AiDataCategory>(["MEDICAL", "CREDENTIAL", "PROVIDER_SECRET"]);

export class ControlledAiToolRegistry {
  private readonly tools = new Map<string, RegisteredAiTool>();

  register<TInput, TOutput>(definition: AiToolDefinition<TInput, TOutput>): void {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(definition.name)) {
      throw new Error("AI_TOOL_NAME_INVALID");
    }
    if (this.tools.has(definition.name)) throw new Error("AI_TOOL_ALREADY_REGISTERED");
    if (definition.policy.consequence !== "READ_ONLY") throw new Error("AI_CONSEQUENTIAL_TOOL_PROHIBITED");
    if (definition.policy.maximumRows < 1 || definition.policy.maximumRows > 500) {
      throw new Error("AI_TOOL_ROW_LIMIT_INVALID");
    }
    if (definition.policy.allowedDataCategories.some((category) => prohibitedCategories.has(category))) {
      throw new Error("AI_TOOL_DATA_CATEGORY_PROHIBITED");
    }
    const registered: RegisteredAiTool = {
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema as z.ZodType<unknown>,
      policy: definition.policy,
      execute: async (input, context) => definition.execute(input as TInput, context)
    };
    this.tools.set(definition.name, registered);
  }

  listFor(permissions: ReadonlySet<string>): readonly {
    readonly name: string;
    readonly description: string;
    readonly policy: AiToolPolicy;
  }[] {
    return [...this.tools.values()]
      .filter((tool) => tool.policy.requiredPermissions.every((permission) => permissions.has(permission)))
      .map((tool) => ({ name: tool.name, description: tool.description, policy: tool.policy }));
  }

  policyFor(name: string): AiToolPolicy {
    const tool = this.tools.get(name);
    if (!tool) throw new ProviderPolicyError("AI_TOOL_NOT_REGISTERED", "La herramienta solicitada no está registrada.");
    return tool.policy;
  }

  async execute(
    name: string,
    input: unknown,
    context: AiToolExecutionContext
  ): Promise<AiToolResult<unknown>> {
    const tool = this.tools.get(name);
    if (!tool) throw new ProviderPolicyError("AI_TOOL_NOT_REGISTERED", "La herramienta solicitada no está registrada.");
    if (tool.policy.requiredPermissions.some((permission) => !context.permissions.has(permission))) {
      throw new ProviderPolicyError("AI_TOOL_PERMISSION_DENIED", "No tiene permisos para esta herramienta.");
    }
    const validatedInput = tool.inputSchema.parse(input);
    const result = await tool.execute(validatedInput, context);
    if (result.rowCount > tool.policy.maximumRows) {
      throw new ProviderPolicyError("AI_TOOL_ROW_LIMIT_EXCEEDED", "La herramienta excedió el límite de filas.");
    }
    if (tool.policy.citationsRequired && result.citations.length === 0 && result.rowCount > 0) {
      throw new ProviderPolicyError("AI_TOOL_CITATIONS_REQUIRED", "La herramienta no devolvió citas verificables.");
    }
    const redacted = redactStructured(result.output);
    const serialized = JSON.stringify(redacted);
    if (serialized.length > tool.policy.maximumOutputCharacters) {
      throw new ProviderPolicyError("AI_TOOL_OUTPUT_LIMIT_EXCEEDED", "La herramienta excedió el límite de contexto.");
    }
    return { ...result, output: redacted };
  }
}

export function createDefaultToolRegistry(): ControlledAiToolRegistry {
  const registry = new ControlledAiToolRegistry();
  registry.register({
    name: "system.health-summary",
    description: "Devuelve únicamente el estado técnico no sensible del servicio.",
    inputSchema: z.object({}).strict(),
    policy: {
      requiredPermissions: ["ai.use"],
      allowedDataCategories: ["INTERNAL"],
      maximumRows: 1,
      maximumOutputCharacters: 2_000,
      consequence: "READ_ONLY",
      citationsRequired: true
    },
    execute: (_input, context) => Promise.resolve({
      output: { status: "available", companyScoped: true },
      citations: [{
        recordType: "system-health",
        recordId: context.scope.companyId,
        label: "Estado técnico de la empresa activa"
      }],
      rowCount: 1,
      truncated: false
    })
  });
  return registry;
}
