/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import type { ComponentType } from "react";

export interface Phase3RouteDefinition {
  path: string;
  label: string;
  section: "Administración" | "Relaciones" | "Operación" | "Personas" | "Automatización" | "Gobierno";
  permission: string;
  module: string;
  load: () => Promise<{ default: ComponentType }>;
}

export const phase3RouteDefinitions: Phase3RouteDefinition[] = [
  {
    path: "/administracion",
    label: "Centro de administración",
    section: "Administración",
    permission: "admin.settings.read",
    module: "admin-control-plane",
    load: () => import("./pages/AdminControlPlanePage")
  },
  {
    path: "/crm",
    label: "CRM",
    section: "Relaciones",
    permission: "crm.read",
    module: "crm",
    load: () => import("./pages/OperationalWorkspaces").then((module) => ({ default: module.CrmPage }))
  },
  {
    path: "/proyectos",
    label: "Proyectos",
    section: "Operación",
    permission: "projects.read",
    module: "projects",
    load: () => import("./pages/OperationalWorkspaces").then((module) => ({ default: module.ProjectsPage }))
  },
  {
    path: "/recursos-humanos",
    label: "Recursos humanos",
    section: "Personas",
    permission: "hr.read",
    module: "human-resources",
    load: () => import("./pages/OperationalWorkspaces").then((module) => ({ default: module.HumanResourcesPage }))
  },
  {
    path: "/sst",
    label: "SST",
    section: "Personas",
    permission: "sst.read",
    module: "occupational-safety",
    load: () => import("./pages/SstPage")
  },
  {
    path: "/activos",
    label: "Activos y mantenimiento",
    section: "Operación",
    permission: "assets.read",
    module: "assets",
    load: () => import("./pages/OperationalWorkspaces").then((module) => ({ default: module.AssetsMaintenancePage }))
  },
  {
    path: "/ocr",
    label: "OCR",
    section: "Automatización",
    permission: "ocr.read",
    module: "ocr",
    load: () => import("./pages/OcrReviewPage")
  },
  {
    path: "/asistente",
    label: "Asistente IA",
    section: "Automatización",
    permission: "ai.use",
    module: "artificial-intelligence",
    load: () => import("./pages/ArtificialIntelligencePage")
  },
  {
    path: "/mapas",
    label: "Mapas",
    section: "Operación",
    permission: "maps.read",
    module: "maps",
    load: () => import("./pages/MapsPage")
  },
  {
    path: "/legal-privacidad",
    label: "Legal y privacidad",
    section: "Gobierno",
    permission: "legal.read",
    module: "legal-compliance",
    load: () => import("./pages/GovernanceDemoPage").then((module) => ({ default: module.LegalPrivacyPage }))
  },
  {
    path: "/demostracion",
    label: "Demostración",
    section: "Administración",
    permission: "demo.read",
    module: "demo-management",
    load: () => import("./pages/GovernanceDemoPage").then((module) => ({ default: module.DemoManagementPage }))
  }
];
