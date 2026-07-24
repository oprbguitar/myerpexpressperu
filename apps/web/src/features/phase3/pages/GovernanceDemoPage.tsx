/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useState } from "react";
import { Phase3Header, ResourcePanel, Tabs } from "../components/Phase3Ui";
import { usePhase3Resource } from "../usePhase3Resource";
import "../phase3.css";

const sections = [
  { id: "legal", label: "Documentos legales", endpoint: "/legal/documents", empty: "No hay documentos legales publicados." },
  { id: "acceptances", label: "Aceptaciones", endpoint: "/legal/acceptances", empty: "No hay aceptaciones registradas." },
  { id: "consents", label: "Consentimientos", endpoint: "/privacy/consents", empty: "No hay consentimientos visibles." },
  { id: "requests", label: "Solicitudes de privacidad", endpoint: "/privacy/requests", empty: "No hay solicitudes de privacidad." },
  { id: "retention", label: "Retención", endpoint: "/privacy/retention", empty: "No hay reglas de retención publicadas." },
  { id: "holds", label: "Bloqueos legales", endpoint: "/privacy/legal-holds", empty: "No hay bloqueos legales activos." }
] as const;

export function LegalPrivacyPage() {
  const [active, setActive] = useState<(typeof sections)[number]["id"]>("legal");
  const selected = sections.find((section) => section.id === active) ?? sections[0];
  const resource = usePhase3Resource<unknown>(selected.endpoint);
  return (
    <div className="standard-page p3-page">
      <Phase3Header
        context="Gobierno"
        title="Legal y privacidad"
        description="Versiones, aceptaciones y solicitudes trazables. Esta superficie no constituye asesoría ni declara cumplimiento automático."
      />
      <div className="p3-legal-notice">El responsable debe validar textos, bases legales, plazos y configuración aplicables a su organización.</div>
      <Tabs items={sections.map(({ id, label }) => ({ id, label }))} active={active} onChange={(id) => setActive(id as typeof active)} />
      <ResourcePanel title={selected.label} state={resource} empty={selected.empty} reload={resource.reload} />
    </div>
  );
}

const demoSections = [
  { id: "profiles", label: "Perfiles", endpoint: "/demo/profiles", empty: "No hay perfiles demo disponibles." },
  { id: "scenarios", label: "Escenarios", endpoint: "/demo/scenarios", empty: "No hay escenarios demo disponibles." },
  { id: "build", label: "Paquete", endpoint: "/demo/build", empty: "No hay paquete demo generado." }
] as const;

export function DemoManagementPage() {
  const [active, setActive] = useState<(typeof demoSections)[number]["id"]>("profiles");
  const selected = demoSections.find((section) => section.id === active) ?? demoSections[0];
  const resource = usePhase3Resource<unknown>(selected.endpoint);
  return (
    <div className="standard-page p3-page">
      <Phase3Header
        context="Distribución"
        title="Demostración"
        description="Datos sintéticos y escenarios identificados como demostración. El reinicio nunca está disponible en producción."
      />
      <div className="p3-demo-warning"><strong>Entorno de demostración</strong><span>Los datos visibles deben provenir del perfil activo de la API; no representan una operación real.</span></div>
      <Tabs items={demoSections} active={active} onChange={(id) => setActive(id as typeof active)} />
      <ResourcePanel title={selected.label} state={resource} empty={selected.empty} reload={resource.reload} />
      <section className="p3-danger-zone">
        <h2>Reinicio de demostración</h2>
        <p>La interfaz no habilita esta acción sin confirmación reforzada, permiso explícito y verificación del entorno en el servidor.</p>
        <button disabled>Reinicio no disponible</button>
      </section>
    </div>
  );
}
