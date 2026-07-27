/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { HttpException, SetMetadata } from "@nestjs/common";

/**
 * Metadatos de propiedad de módulo. Un controlador que expone operaciones de un
 * módulo declara `@OwnedByModule("<code>")`; los endpoints de infraestructura
 * declaran `@CoreEndpoint()`. Un controlador sin ninguno de los dos hace fallar
 * el arranque y CI (verificación fail-closed), de modo que ningún controlador
 * nuevo puede evadir el enforcement por omisión.
 */
export const OWNED_MODULE_METADATA = "owned-module";
export const CORE_ENDPOINT_METADATA = "core-endpoint";

export const OwnedByModule = (moduleCode: string): ClassDecorator & MethodDecorator =>
  SetMetadata(OWNED_MODULE_METADATA, moduleCode);

export const CoreEndpoint = (): ClassDecorator & MethodDecorator =>
  SetMetadata(CORE_ENDPOINT_METADATA, true);

/** Error estable cuando un módulo está deshabilitado para la empresa actual. */
export class ModuleDisabledException extends HttpException {
  constructor(moduleCode: string) {
    super(
      {
        code: "MODULE_DISABLED",
        message: "Este módulo no está habilitado para la empresa seleccionada.",
        module: moduleCode
      },
      409
    );
  }
}

export type ModuleResourceType =
  | "API_CONTROLLER"
  | "WORKER_HANDLER"
  | "SCHEDULED_JOB"
  | "DASHBOARD_WIDGET"
  | "FRONTEND_ROUTE"
  | "NAVIGATION_ENTRY"
  | "PROVIDER";

export interface ModuleOwnedResource {
  resourceType: ModuleResourceType;
  resourceId: string;
  moduleCode: string;
  core: boolean;
}

/**
 * Registro autoritativo de recursos NO-controlador (worker, frontend, widgets)
 * asociados a un módulo. Los controladores de API se descubren por sus
 * decoradores (fuente de verdad colocada), no aquí, para evitar deriva.
 *
 * `disable-impact` combina este registro con los controladores decorados.
 */
export const MODULE_RESOURCE_REGISTRY: ModuleOwnedResource[] = [
  // Handlers del worker (generadores de notificaciones por módulo).
  { resourceType: "WORKER_HANDLER", resourceId: "receivable-overdue", moduleCode: "receivables", core: false },
  { resourceType: "WORKER_HANDLER", resourceId: "payable-due-soon", moduleCode: "payables", core: false },
  { resourceType: "WORKER_HANDLER", resourceId: "low-stock", moduleCode: "inventory-basic", core: false },
  { resourceType: "WORKER_HANDLER", resourceId: "commercial-document-rejected", moduleCode: "commercial-documents", core: false },
  { resourceType: "WORKER_HANDLER", resourceId: "project-task-overdue", moduleCode: "projects", core: false },
  { resourceType: "WORKER_HANDLER", resourceId: "sst-action-overdue", moduleCode: "occupational-safety", core: false },
  { resourceType: "WORKER_HANDLER", resourceId: "maintenance-due", moduleCode: "maintenance", core: false },
  { resourceType: "WORKER_HANDLER", resourceId: "ocr-review-required", moduleCode: "ocr", core: false },
  { resourceType: "WORKER_HANDLER", resourceId: "provider-unavailable", moduleCode: "provider-management", core: false },
  // Rutas de frontend por módulo (las de Fase 1/2 sin módulo son core).
  { resourceType: "FRONTEND_ROUTE", resourceId: "/ventas", moduleCode: "sales", core: false },
  { resourceType: "FRONTEND_ROUTE", resourceId: "/compras", moduleCode: "purchases", core: false },
  { resourceType: "FRONTEND_ROUTE", resourceId: "/inventario", moduleCode: "inventory-basic", core: false },
  { resourceType: "FRONTEND_ROUTE", resourceId: "/caja", moduleCode: "cash", core: false },
  { resourceType: "FRONTEND_ROUTE", resourceId: "/sunat", moduleCode: "sunat-basic", core: false },
  { resourceType: "FRONTEND_ROUTE", resourceId: "/documentos", moduleCode: "documents", core: false },
  { resourceType: "FRONTEND_ROUTE", resourceId: "/residuos", moduleCode: "waste-management", core: false },
  { resourceType: "DASHBOARD_WIDGET", resourceId: "cash-balance", moduleCode: "cash", core: false },
  { resourceType: "DASHBOARD_WIDGET", resourceId: "sales-summary", moduleCode: "sales", core: false }
];

/** Recursos no-controlador que pertenecen a un módulo dado. */
export function resourcesForModule(moduleCode: string): ModuleOwnedResource[] {
  return MODULE_RESOURCE_REGISTRY.filter((resource) => resource.moduleCode === moduleCode);
}

/**
 * Mapa de controlador (nombre de clase) → módulo, como DATO puro (sin importar
 * las clases, para no crear ciclos con los servicios). Es la fuente para
 * `disable-impact`. La verificación de arranque comprueba que coincide con los
 * decoradores reales de cada controlador (module-verification.ts), de modo que
 * no puede derivar en silencio.
 */
export const CONTROLLER_MODULE_MAP: Readonly<Record<string, string>> = {
  DocumentsController: "documents",
  PartiesController: "parties",
  CatalogController: "products",
  DashboardController: "dashboard",
  FinanceController: "payments",
  ImportsController: "imports",
  InventoryController: "inventory-basic",
  WasteController: "waste-management",
  SalesController: "sales",
  PurchasesController: "purchases",
  SunatController: "sunat-basic",
  Phase3AdminController: "admin-control-plane",
  Phase3CrmController: "crm",
  Phase3ProjectsController: "projects",
  Phase3PeopleController: "human-resources",
  Phase3AssetsController: "assets",
  GovernanceController: "legal-compliance",
  AiController: "artificial-intelligence",
  OcrController: "ocr",
  MapsController: "maps",
  ProviderManagementController: "provider-management"
};

/** Nombres de controladores que pertenecen a un módulo dado. */
export function controllersForModule(moduleCode: string): string[] {
  return Object.entries(CONTROLLER_MODULE_MAP)
    .filter(([, code]) => code === moduleCode)
    .map(([name]) => name);
}
