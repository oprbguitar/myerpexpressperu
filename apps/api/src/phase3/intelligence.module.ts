/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Module } from "@nestjs/common";
import { AiController } from "./ai/ai.controller.js";
import { AiAssistanceService } from "./ai/ai.service.js";
import { ControlledAiToolRegistry, createDefaultToolRegistry } from "./ai/tool-registry.js";
import { MapsController } from "./maps/maps.controller.js";
import { MapsService } from "./maps/maps.service.js";
import { OcrController } from "./ocr/ocr.controller.js";
import { OcrAssistanceService } from "./ocr/ocr.service.js";
import { ProviderManagementController } from "./providers/provider-management.controller.js";
import { ProviderManagementService } from "./providers/provider-management.service.js";

@Module({
  controllers: [AiController, OcrController, MapsController, ProviderManagementController],
  providers: [
    ProviderManagementService,
    { provide: ControlledAiToolRegistry, useFactory: createDefaultToolRegistry },
    AiAssistanceService,
    OcrAssistanceService,
    MapsService
  ],
  exports: [ProviderManagementService, ControlledAiToolRegistry]
})
export class Phase3IntelligenceModule {}

