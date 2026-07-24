/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useMemo, useState } from "react";
import { Phase3Header, QuickCreate, ResourcePanel, Tabs } from "../components/Phase3Ui";
import { usePhase3Resource } from "../usePhase3Resource";
import "../phase3.css";

interface WorkspaceSection {
  id: string;
  label: string;
  endpoint: string;
  empty: string;
}

function Workspace({
  context,
  title,
  description,
  sections,
  create
}: {
  context: string;
  title: string;
  description: string;
  sections: WorkspaceSection[];
  create?: { label: string; endpoint: string; fields: Array<{ name: string; label: string; type?: string; required?: boolean }> };
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const selected = useMemo(() => sections.find((section) => section.id === active) ?? sections[0]!, [active, sections]);
  const resource = usePhase3Resource<unknown>(selected.endpoint);
  return (
    <div className="standard-page p3-page">
      <Phase3Header
        context={context}
        title={title}
        description={description}
        action={create ? <QuickCreate title={create.label} endpoint={create.endpoint} fields={create.fields} onCreated={resource.reload} /> : undefined}
      />
      <Tabs items={sections} active={active} onChange={setActive} />
      <ResourcePanel title={selected.label} state={resource} empty={selected.empty} reload={resource.reload} />
    </div>
  );
}

const crmSections: WorkspaceSection[] = [
  { id: "leads", label: "Prospectos", endpoint: "/crm/leads", empty: "No hay prospectos en el alcance actual." },
  { id: "opportunities", label: "Oportunidades", endpoint: "/crm/opportunities", empty: "No hay oportunidades abiertas." },
  { id: "pipeline", label: "Pipeline", endpoint: "/crm/pipelines", empty: "No hay etapas de pipeline configuradas." },
  { id: "activity", label: "Actividad", endpoint: "/crm/activities", empty: "No hay actividades comerciales registradas." }
];

export function CrmPage() {
  return <Workspace
    context="Comercial / CRM"
    title="Relaciones y oportunidades"
    description="Seguimiento del prospecto a la oportunidad y su conversión, sin duplicar clientes existentes."
    sections={crmSections}
    create={{
      label: "Nuevo prospecto",
      endpoint: "/crm/leads",
      fields: [
        { name: "fullName", label: "Nombre", required: true },
        { name: "email", label: "Correo", type: "email" },
        { name: "phone", label: "Teléfono" }
      ]
    }}
  />;
}

const projectSections: WorkspaceSection[] = [
  { id: "projects", label: "Proyectos", endpoint: "/projects", empty: "No hay proyectos visibles." },
  { id: "tasks", label: "Tareas", endpoint: "/projects?include=tasks", empty: "Selecciona o crea un proyecto para gestionar tareas." },
  { id: "time", label: "Tiempo", endpoint: "/projects?include=time", empty: "No hay horas registradas." },
  { id: "expenses", label: "Gastos", endpoint: "/projects?include=expenses", empty: "No hay gastos vinculados a proyectos." },
  { id: "risks", label: "Riesgos e incidencias", endpoint: "/projects?include=risks,issues", empty: "No hay riesgos o incidencias visibles." },
  { id: "changes", label: "Cambios", endpoint: "/projects?include=change-requests", empty: "No hay solicitudes de cambio." }
];

export function ProjectsPage() {
  return <Workspace
    context="Operación / Proyectos"
    title="Proyectos, tiempo y gastos"
    description="Alcance, hitos, presupuesto y ejecución trazable por proyecto."
    sections={projectSections}
    create={{
      label: "Nuevo proyecto",
      endpoint: "/projects",
      fields: [
        { name: "name", label: "Nombre", required: true },
        { name: "code", label: "Código", required: true },
        { name: "plannedStart", label: "Inicio", type: "date" }
      ]
    }}
  />;
}

const hrSections: WorkspaceSection[] = [
  { id: "employees", label: "Personas", endpoint: "/hr/employees", empty: "No hay trabajadores visibles para este perfil." },
  { id: "contracts", label: "Contratos", endpoint: "/hr/contracts", empty: "No hay contratos registrados." },
  { id: "attendance", label: "Asistencia", endpoint: "/hr/attendance", empty: "No hay registros de asistencia." },
  { id: "leaves", label: "Licencias y vacaciones", endpoint: "/hr/leaves", empty: "No hay solicitudes visibles." },
  { id: "training", label: "Capacitación", endpoint: "/hr/trainings", empty: "No hay capacitaciones registradas." },
  { id: "certifications", label: "Certificaciones", endpoint: "/hr/certifications", empty: "No hay certificaciones vigentes." }
];

export function HumanResourcesPage() {
  return <Workspace
    context="Personas"
    title="Recursos humanos"
    description="Gestión operativa ligera. Esta superficie no implementa planillas ni muestra detalle médico."
    sections={hrSections}
  />;
}

const assetSections: WorkspaceSection[] = [
  { id: "assets", label: "Activos", endpoint: "/assets", empty: "No hay activos registrados." },
  { id: "orders", label: "Órdenes de trabajo", endpoint: "/maintenance/work-orders", empty: "No hay órdenes de trabajo." }
];

export function AssetsMaintenancePage() {
  return <Workspace
    context="Operación"
    title="Activos y mantenimiento"
    description="Inventario patrimonial, asignaciones y mantenimiento preventivo o correctivo."
    sections={assetSections}
  />;
}
