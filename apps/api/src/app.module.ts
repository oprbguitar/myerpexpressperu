/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AppController } from "./app.controller.js";
import { AuditController } from "./audit.controller.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { DatabaseModule } from "./database.module.js";
import { ApiExceptionFilter, LocalRateLimitInterceptor, RequestIdInterceptor } from "./http.js";
import { TenantContextInterceptor } from "./tenant-context.interceptor.js";
import { Phase3IntelligenceModule } from "./phase3/index.js";
import {
  Phase3AdminController, Phase3AssetsController, Phase3CrmController,
  Phase3OperationsService, Phase3PeopleController, Phase3ProjectsController
} from "./phase3/operations/index.js";
import { GovernanceController, GovernanceService } from "./phase3/governance/index.js";
import { ModulesController } from "./modules.controller.js";
import { ModulesService } from "./modules.service.js";
import { OrganizationController } from "./organization.controller.js";
import { OrganizationService } from "./organization.service.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";
import { RolesController } from "./roles.controller.js";
import { DocumentsController } from "./documents.controller.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";
import { FinanceController } from "./finance.controller.js";
import { FinanceService } from "./finance.service.js";
import { ImportsController } from "./imports.controller.js";
import { ImportsService } from "./imports.service.js";
import { InventoryController } from "./inventory.controller.js";
import { InventoryService } from "./inventory.service.js";
import { PartiesController } from "./parties.controller.js";
import { PartiesService } from "./parties.service.js";
import { PurchasesController } from "./purchases.controller.js";
import { PurchasesService } from "./purchases.service.js";
import { SalesController } from "./sales.controller.js";
import { SalesService } from "./sales.service.js";
import { SunatController } from "./sunat.controller.js";
import { SunatService } from "./sunat.service.js";
import { NotificationsController } from "./notifications.controller.js";
import { StorageService } from "./storage.service.js";
import { PdfController } from "./pdf.controller.js";
import { PdfService } from "./pdf.service.js";

@Module({
  imports: [DatabaseModule, Phase3IntelligenceModule],
  controllers: [
    AppController, AuthController, OrganizationController, ModulesController, AuditController,
    UsersController, RolesController, DocumentsController,
    PartiesController, CatalogController, SalesController, PurchasesController,
    FinanceController, InventoryController, SunatController, DashboardController, ImportsController,
    NotificationsController, PdfController,
    Phase3AdminController, Phase3CrmController, Phase3ProjectsController,
    Phase3PeopleController, Phase3AssetsController, GovernanceController
  ],
  providers: [
    AuthService, OrganizationService, ModulesService, UsersService,
    PartiesService, CatalogService, SalesService, PurchasesService, FinanceService,
    InventoryService, SunatService, DashboardService, ImportsService, StorageService, PdfService,
    Phase3OperationsService, GovernanceService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LocalRateLimitInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter }
  ]
})
export class AppModule {}
