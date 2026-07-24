/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
export interface DemoScenario {
  readonly code: "A" | "B" | "C";
  readonly name: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly syntheticEntities: readonly string[];
}

export const demoScenarios: readonly DemoScenario[] = [
  {
    code: "A",
    name: "Servicios profesionales",
    description: "Recorrido de relación comercial, propuesta, proyecto, tiempo, gasto y cobranza.",
    capabilities: ["crm", "quotations", "projects", "time", "expenses", "invoicing-manual-mock", "receivables"],
    syntheticEntities: [
      "Comercial Rivera S.A.C.",
      "Oportunidad de implementación",
      "Proyecto de adopción ERP",
      "Cotización C001-00000001"
    ]
  },
  {
    code: "B",
    name: "Pyme comercial",
    description: "Recorrido de catálogo, inventario, compra, venta, caja y saldos comerciales.",
    capabilities: ["customers", "suppliers", "products", "warehouse", "sales", "purchases", "cash", "receivables", "payables"],
    syntheticEntities: [
      "Distribuidora Pacífico S.A.C.",
      "Papel A4 Copia 80 g",
      "Almacén principal",
      "Venta VI01-00000001"
    ]
  },
  {
    code: "C",
    name: "Contratista",
    description: "Recorrido de proyecto, trabajadores, inspección SST, activo y mantenimiento.",
    capabilities: ["contract-reference", "projects", "employees", "sst", "assets", "maintenance", "documents-mock", "dashboard"],
    syntheticEntities: [
      "Contrato ficticio DEMO-C-001",
      "Proyecto Mantenimiento de sede",
      "Inspección SST de demostración",
      "Compresora DEMO-ACT-001"
    ]
  }
] as const;

