/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Injectable } from "@nestjs/common";
import type {
  ArtificialIntelligenceProvider,
  GeocodingProvider,
  OcrProvider,
  ProviderCategory,
  ProviderDescriptor,
  ProviderHealth,
  ProviderLifecycle,
  ProviderMode,
  ProviderState
} from "@erp/contracts";
import type { AuthenticatedContext } from "@erp/contracts";
import { NoAiProvider } from "./ai-providers.js";
import { ManualGeocodingProvider } from "./geocoding-providers.js";
import { DisabledOcrProvider } from "./ocr-providers.js";
import { ProviderPolicyError } from "./provider-errors.js";

interface ManagedProvider {
  readonly id: string;
  readonly category: ProviderCategory;
  readonly displayName: string;
  readonly mode: ProviderMode;
  readonly capabilities: readonly string[];
  readonly affectedModules: readonly string[];
  readonly adapter: ProviderLifecycle;
  readonly secretReference?: string;
  readonly endpoint?: string;
  readonly model?: string;
  readonly tenantId?: string;
  readonly companyId?: string;
  state: ProviderState;
  lastHealth?: ProviderHealth;
}

export interface RegisterManagedProviderInput {
  readonly id: string;
  readonly category: ProviderCategory;
  readonly displayName: string;
  readonly mode: ProviderMode;
  readonly capabilities: readonly string[];
  readonly affectedModules: readonly string[];
  readonly adapter: ProviderLifecycle;
  readonly secretReference?: string;
  readonly endpoint?: string;
  readonly model?: string;
  readonly tenantId: string;
  readonly companyId: string;
}

interface ProviderActivationContext {
  readonly appEnvironment: string;
  readonly productionConfirmation: boolean;
  readonly tenantId?: string | undefined;
  readonly companyId?: string | undefined;
}

@Injectable()
export class ProviderManagementService {
  private readonly providers = new Map<string, ManagedProvider>();
  private readonly activeAiProviders = new Map<string, string>();
  private readonly activeOcrProviders = new Map<string, string>();
  private readonly activeGeocodingProviders = new Map<string, string>();

  constructor() {
    this.registerSystem({
      id: "ai-disabled",
      category: "AI",
      displayName: "IA deshabilitada",
      mode: "DISABLED",
      capabilities: [],
      affectedModules: ["artificial-intelligence"],
      adapter: new NoAiProvider()
    });
    this.registerSystem({
      id: "ocr-disabled",
      category: "OCR",
      displayName: "OCR deshabilitado",
      mode: "DISABLED",
      capabilities: [],
      affectedModules: ["ocr"],
      adapter: new DisabledOcrProvider()
    });
    this.registerSystem({
      id: "geocoding-manual",
      category: "GEOCODING",
      displayName: "Geocodificación manual",
      mode: "MANUAL",
      capabilities: ["manual-entry"],
      affectedModules: ["maps"],
      adapter: new ManualGeocodingProvider()
    });
  }

  register(input: RegisterManagedProviderInput): void {
    if (this.providers.has(input.id)) throw new ProviderPolicyError("PROVIDER_ID_EXISTS", "El proveedor ya existe.");
    this.providers.set(input.id, {
      ...input,
      state: input.mode === "DISABLED" ? "DISABLED" : "CONFIGURED"
    });
  }

  list(scope: Pick<AuthenticatedContext, "tenantId" | "companyId">): readonly ProviderDescriptor[] {
    return [...this.providers.values()]
      .filter((provider) => this.isVisible(provider, scope))
      .map((provider) => this.toDescriptor(provider));
  }

  getActiveAiProvider(scope?: Pick<AuthenticatedContext, "tenantId" | "companyId">): ArtificialIntelligenceProvider {
    return this.getAdapter<ArtificialIntelligenceProvider>(
      this.activeAiProviders.get(this.scopeKey(scope)) ?? "ai-disabled",
      scope
    );
  }

  getActiveOcrProvider(scope?: Pick<AuthenticatedContext, "tenantId" | "companyId">): OcrProvider {
    return this.getAdapter<OcrProvider>(
      this.activeOcrProviders.get(this.scopeKey(scope)) ?? "ocr-disabled",
      scope
    );
  }

  getActiveGeocodingProvider(scope?: Pick<AuthenticatedContext, "tenantId" | "companyId">): GeocodingProvider {
    return this.getAdapter<GeocodingProvider>(
      this.activeGeocodingProviders.get(this.scopeKey(scope)) ?? "geocoding-manual",
      scope
    );
  }

  async testConnection(
    providerId: string,
    scope: Pick<AuthenticatedContext, "tenantId" | "companyId">
  ): Promise<ProviderHealth> {
    const provider = this.requireProvider(providerId, scope);
    provider.state = "TESTING";
    const health = await provider.adapter.healthCheck();
    provider.lastHealth = health;
    provider.state = health.state;
    return health;
  }

  activate(
    providerId: string,
    context: ProviderActivationContext
  ): ProviderDescriptor {
    const scopeKey = this.activationScopeKey(context);
    const provider = this.requireProvider(
      providerId,
      context.tenantId && context.companyId
        ? { tenantId: context.tenantId, companyId: context.companyId }
        : undefined
    );
    if (provider.mode === "CLOUD" && context.appEnvironment === "production" && !context.productionConfirmation) {
      throw new ProviderPolicyError(
        "PRODUCTION_PROVIDER_CONFIRMATION_REQUIRED",
        "La activación de un proveedor externo en producción requiere confirmación explícita."
      );
    }
    if (
      provider.mode === "CLOUD" &&
      (provider.category === "AI" || provider.category === "OCR")
    ) {
      throw new ProviderPolicyError(
        "EXTERNAL_SENSITIVE_PROVIDER_NOT_AVAILABLE_PHASE3",
        "Los proveedores cloud de IA y OCR permanecen deshabilitados en Fase 3."
      );
    }
    if (provider.state === "UNAVAILABLE" || provider.state === "NOT_CONFIGURED") {
      throw new ProviderPolicyError("PROVIDER_NOT_READY", "El proveedor no está listo para activarse.");
    }
    if (provider.category === "AI") this.activeAiProviders.set(scopeKey, provider.id);
    if (provider.category === "OCR") this.activeOcrProviders.set(scopeKey, provider.id);
    if (provider.category === "GEOCODING" || provider.category === "MAPS") {
      this.activeGeocodingProviders.set(scopeKey, provider.id);
    }
    return this.toDescriptor(provider);
  }

  deactivate(
    providerId: string,
    scope?: Pick<AuthenticatedContext, "tenantId" | "companyId">
  ): ProviderDescriptor {
    const provider = this.requireProvider(providerId, scope);
    const scopeKey = this.scopeKey(scope);
    if (provider.category === "AI") this.activeAiProviders.delete(scopeKey);
    if (provider.category === "OCR") this.activeOcrProviders.delete(scopeKey);
    if (provider.category === "GEOCODING" || provider.category === "MAPS") {
      this.activeGeocodingProviders.delete(scopeKey);
    }
    return this.toDescriptor(provider);
  }

  exportNonSecretConfiguration(
    providerId: string,
    scope: Pick<AuthenticatedContext, "tenantId" | "companyId">
  ): Readonly<Record<string, unknown>> {
    const provider = this.requireProvider(providerId, scope);
    return {
      id: provider.id,
      category: provider.category,
      displayName: provider.displayName,
      mode: provider.mode,
      capabilities: provider.capabilities,
      affectedModules: provider.affectedModules,
      secretReferenceConfigured: provider.secretReference !== undefined,
      ...(provider.endpoint === undefined ? {} : { endpoint: provider.endpoint }),
      ...(provider.model === undefined ? {} : { model: provider.model })
    };
  }

  private getAdapter<T extends ProviderLifecycle>(
    providerId: string,
    scope?: Pick<AuthenticatedContext, "tenantId" | "companyId">
  ): T {
    return this.requireProvider(providerId, scope).adapter as T;
  }

  private activationScopeKey(context: ProviderActivationContext): string {
    if (context.tenantId && context.companyId) return `${context.tenantId}:${context.companyId}`;
    if (context.appEnvironment === "test") return "__test__";
    throw new ProviderPolicyError(
      "PROVIDER_SCOPE_REQUIRED",
      "La activación de proveedores requiere tenant y empresa derivados de la sesión."
    );
  }

  private scopeKey(scope?: Pick<AuthenticatedContext, "tenantId" | "companyId">): string {
    return scope ? `${scope.tenantId}:${scope.companyId}` : "__test__";
  }

  private requireProvider(
    providerId: string,
    scope?: Pick<AuthenticatedContext, "tenantId" | "companyId">
  ): ManagedProvider {
    const provider = this.providers.get(providerId);
    if (!provider || (scope && !this.isVisible(provider, scope))) {
      throw new ProviderPolicyError("PROVIDER_NOT_FOUND", "El proveedor no existe en este ámbito.");
    }
    return provider;
  }

  private isVisible(
    provider: ManagedProvider,
    scope: Pick<AuthenticatedContext, "tenantId" | "companyId">
  ): boolean {
    return provider.tenantId === undefined ||
      (provider.tenantId === scope.tenantId && provider.companyId === scope.companyId);
  }

  private registerSystem(input: Omit<RegisterManagedProviderInput, "tenantId" | "companyId">): void {
    if (this.providers.has(input.id)) throw new ProviderPolicyError("PROVIDER_ID_EXISTS", "El proveedor ya existe.");
    this.providers.set(input.id, {
      ...input,
      state: input.mode === "DISABLED" ? "DISABLED" : "CONFIGURED"
    });
  }

  private toDescriptor(provider: ManagedProvider): ProviderDescriptor {
    return {
      id: provider.id,
      category: provider.category,
      displayName: provider.displayName,
      mode: provider.mode,
      state: provider.state,
      capabilities: provider.capabilities,
      affectedModules: provider.affectedModules,
      secretReferenceConfigured: provider.secretReference !== undefined,
      ...(provider.lastHealth === undefined ? {} : { lastHealth: provider.lastHealth })
    };
  }
}
