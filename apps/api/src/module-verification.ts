/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import "reflect-metadata";
import { moduleRegistry } from "@erp/domain";
import type { Type } from "@nestjs/common";
import { CONTROLLER_MODULE_MAP, CORE_ENDPOINT_METADATA, OWNED_MODULE_METADATA } from "./module-ownership.js";

import { AppController } from "./app.controller.js";
import { AuthController } from "./auth.controller.js";
import { AuditController } from "./audit.controller.js";
import { OrganizationController } from "./organization.controller.js";
import { ModulesController } from "./modules.controller.js";
import { UsersController } from "./users.controller.js";
import { RolesController } from "./roles.controller.js";
import { NotificationsController } from "./notifications.controller.js";
import { PdfController } from "./pdf.controller.js";
import { DocumentsController } from "./documents.controller.js";
import { PartiesController } from "./parties.controller.js";
import { CatalogController } from "./catalog.controller.js";
import { DashboardController } from "./dashboard.controller.js";
import { FinanceController } from "./finance.controller.js";
import { ImportsController } from "./imports.controller.js";
import { InventoryController } from "./inventory.controller.js";
import { SalesController } from "./sales.controller.js";
import { PurchasesController } from "./purchases.controller.js";
import { SunatController } from "./sunat.controller.js";
import {
  Phase3AdminController, Phase3AssetsController, Phase3CrmController,
  Phase3PeopleController, Phase3ProjectsController
} from "./phase3/operations/index.js";
import { GovernanceController } from "./phase3/governance/index.js";
import { AiController } from "./phase3/ai/ai.controller.js";
import { OcrController } from "./phase3/ocr/ocr.controller.js";
import { MapsController } from "./phase3/maps/maps.controller.js";
import { ProviderManagementController } from "./phase3/providers/provider-management.controller.js";

/** Todos los controladores expuestos por la API (app.module + intelligence). */
export const ALL_API_CONTROLLERS: Type[] = [
  AppController, AuthController, AuditController, OrganizationController, ModulesController,
  UsersController, RolesController, NotificationsController, PdfController,
  DocumentsController, PartiesController, CatalogController, DashboardController,
  FinanceController, ImportsController, InventoryController, SalesController,
  PurchasesController, SunatController,
  Phase3AdminController, Phase3CrmController, Phase3ProjectsController,
  Phase3PeopleController, Phase3AssetsController, GovernanceController,
  AiController, OcrController, MapsController, ProviderManagementController
];

export interface OwnershipViolation {
  controller: string;
  problem: string;
}

/**
 * Verificación fail-closed (§8.3): todo controlador no-core debe declarar un
 * módulo registrado; ningún controlador puede quedar sin marcar. Se ejecuta en
 * el arranque y en CI, de modo que un controlador nuevo no evade el enforcement
 * por omisión.
 */
export function verifyModuleOwnership(
  controllers: Type[] = ALL_API_CONTROLLERS
): OwnershipViolation[] {
  const knownModules = new Set(moduleRegistry.map((module) => module.code));
  const violations: OwnershipViolation[] = [];
  for (const controller of controllers) {
    const isCore = Reflect.getMetadata(CORE_ENDPOINT_METADATA, controller) === true;
    const ownedModule = Reflect.getMetadata(OWNED_MODULE_METADATA, controller) as string | undefined;
    if (isCore && ownedModule) {
      violations.push({ controller: controller.name, problem: "declara core Y módulo a la vez" });
      continue;
    }
    if (!isCore && !ownedModule) {
      violations.push({
        controller: controller.name,
        problem: "sin @OwnedByModule ni @CoreEndpoint (fail-closed)"
      });
      continue;
    }
    if (ownedModule && !knownModules.has(ownedModule)) {
      violations.push({ controller: controller.name, problem: `módulo desconocido: ${ownedModule}` });
    }
    // El mapa de datos usado por disable-impact debe coincidir con el decorador.
    const mapped = CONTROLLER_MODULE_MAP[controller.name];
    if (ownedModule && mapped && mapped !== ownedModule) {
      violations.push({
        controller: controller.name,
        problem: `CONTROLLER_MODULE_MAP (${mapped}) no coincide con el decorador (${ownedModule})`
      });
    }
    if (ownedModule && !mapped && !isCore) {
      // Controladores con módulo que no están en el mapa de datos: aceptable solo
      // si su módulo se resuelve a nivel de método (multi-módulo). No es violación.
      void 0;
    }
  }
  return violations;
}
