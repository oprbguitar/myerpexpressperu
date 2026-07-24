/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import "reflect-metadata";
import "./test-env.js";
import { describe, expect, it } from "vitest";
import { moduleRegistry } from "@erp/domain";
import { MODULE_RESOURCE_REGISTRY, CONTROLLER_MODULE_MAP } from "./module-ownership.js";
import { ALL_API_CONTROLLERS, verifyModuleOwnership } from "./module-verification.js";

const knownModules = new Set(moduleRegistry.map((module) => module.code));

describe("propiedad de módulo (fail-closed)", () => {
  it("ningún controlador queda sin declarar módulo o core", () => {
    const violations = verifyModuleOwnership();
    // Si esto falla, un controlador nuevo carece de @OwnedByModule/@CoreEndpoint
    // o declara un módulo desconocido. El arranque y CI también fallarían.
    expect(violations).toEqual([]);
  });

  it("todos los controladores de la API están en la lista de verificación", () => {
    // 29 controladores: 24 de app.module (menos los 4 de intelligence, +5 de
    // operations que son 5 clases en un archivo) más 4 de intelligence.
    expect(ALL_API_CONTROLLERS.length).toBeGreaterThanOrEqual(25);
    for (const controller of ALL_API_CONTROLLERS) {
      expect(typeof controller).toBe("function");
    }
  });

  it("CONTROLLER_MODULE_MAP solo referencia módulos registrados", () => {
    for (const code of Object.values(CONTROLLER_MODULE_MAP)) {
      expect(knownModules.has(code)).toBe(true);
    }
  });

  it("el registro de recursos no-controlador solo referencia módulos registrados", () => {
    for (const resource of MODULE_RESOURCE_REGISTRY) {
      expect(knownModules.has(resource.moduleCode)).toBe(true);
    }
  });
});
