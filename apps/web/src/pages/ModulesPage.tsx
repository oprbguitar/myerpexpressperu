/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { Button, LoadingState, PageHeader } from "../components/Ui";

interface ModuleItem {
  code: string; name: string; description: string; dependencies: string[];
  implemented: boolean; status: "enabled" | "disabled";
}
export default function ModulesPage() {
  const client = useQueryClient();
  const modules = useQuery({ queryKey: ["modules"], queryFn: () => api<ModuleItem[]>("/modules") });
  const enable = useMutation({
    mutationFn: (code: string) => api(`/modules/${code}/enable`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["modules"] })
  });
  if (modules.isLoading) return <LoadingState />;
  return (
    <div className="standard-page">
      <PageHeader eyebrow="Administración / Módulos" title="Activación de módulos" />
      <p className="page-intro">Active capacidades implementadas sin perder el historial de los módulos deshabilitados.</p>
      <div className="data-list module-list">
        {modules.data?.map((item) => (
          <article key={item.code}>
            <div><h2>{item.name}</h2><p>{item.description}</p><code>{item.code}</code></div>
            <div className="module-state">
              <span className={`status ${item.status === "enabled" ? "status-success" : ""}`}>
                {item.status === "enabled" ? "Habilitado" : item.implemented ? "Deshabilitado" : "Fase futura"}
              </span>
              {item.implemented && item.status === "disabled" ? (
                <Button variant="secondary" onClick={() => enable.mutate(item.code)}>Habilitar</Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
