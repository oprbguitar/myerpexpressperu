/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useState } from "react";
import { Button } from "../../../components/Ui";
import { Phase3Header, ResourcePanel, Tabs } from "../components/Phase3Ui";
import { usePhase3Resource } from "../usePhase3Resource";
import "../phase3.css";

const sections = [
  { id: "settings", label: "Configuración", endpoint: "/admin/settings", empty: "Aún no hay parámetros configurables disponibles." },
  { id: "features", label: "Módulos y funciones", endpoint: "/admin/features", empty: "No hay funciones administrables publicadas." },
  { id: "profiles", label: "Perfiles de negocio", endpoint: "/admin/business-profiles", empty: "No hay perfiles de negocio configurados." },
  { id: "providers", label: "Proveedores", endpoint: "/admin/providers", empty: "No hay proveedores registrados para esta empresa." },
  { id: "legal", label: "Legal", endpoint: "/legal/documents", empty: "No hay documentos legales publicados." },
  { id: "privacy", label: "Privacidad", endpoint: "/privacy/retention", empty: "No hay reglas de retención disponibles." },
  { id: "demo", label: "Demostración", endpoint: "/demo/profiles", empty: "No hay perfiles de demostración disponibles." },
  { id: "history", label: "Historial", endpoint: "/admin/configuration-history", empty: "No se registran cambios de configuración." },
  { id: "approvals", label: "Aprobaciones", endpoint: "/admin/configuration-history?status=pending", empty: "No hay cambios que requieren aprobación." }
] as const;

export default function AdminControlPlanePage() {
  const [active, setActive] = useState<(typeof sections)[number]["id"]>("settings");
  const selected = sections.find((section) => section.id === active) ?? sections[0];
  const resource = usePhase3Resource<unknown>(selected.endpoint);
  return (
    <div className="standard-page p3-page p3-admin">
      <Phase3Header
        context="Demostración"
        title="Centro de administración"
        description="Configuración y gobierno por empresa. Los cambios sensibles conservan aprobación e historial."
        action={<Button onClick={resource.reload}>Revisar configuración</Button>}
      />
      <div className="p3-health-strip" aria-label="Áreas de administración">
        <article><span>Módulos</span><strong>Consultar estado</strong><small>Disponibilidad definida por la API</small></article>
        <article><span>Estado de proveedores</span><strong>Verificar conexión</strong><small>Sin exponer credenciales ni diagnóstico sensible</small></article>
        <article><span>Legal y privacidad</span><strong>Revisar vigencia</strong><small>La aplicación no declara cumplimiento automático</small></article>
        <article><span>Configuración</span><strong>Historial auditable</strong><small>Los cambios críticos pueden requerir aprobación</small></article>
      </div>
      <Tabs items={sections.map(({ id, label }) => ({ id, label }))} active={active} onChange={(id) => setActive(id as typeof active)} />
      <ResourcePanel
        key={selected.id}
        title={selected.label === "Aprobaciones" ? "Cambios que requieren aprobación" : selected.label}
        state={resource}
        empty={selected.empty}
        reload={resource.reload}
      />
    </div>
  );
}
