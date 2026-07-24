/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiIdempotent } from "../../../api";
import { Button, Field, LoadingState, PageHeader } from "../../../components/Ui";
import { dateLabel, ErrorNotice, FormActions, money, ResponsiveRecords, StatusBadge } from "../../shared/OperationalUi";

interface Configuration {
  productionConnected: boolean; warning: string;
  providers: Array<{ provider: string; valid: boolean; warnings: string[] }>;
  officialLinks: Array<{ label: string; url: string }>;
}
interface Document {
  id: string; documentType: string; series: string; number: number; issueDate: string; currency: string;
  total: string; status: string; provider: string; environment: string; responseCode?: string;
  responseMessage?: string; submissionAttempts: number; customerName: string;
}

export default function SunatPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<Document | null>(null);
  const [scenario, setScenario] = useState("ACCEPT");
  const configuration = useQuery({ queryKey: ["sunat-configuration"], queryFn: () => api<Configuration>("/sunat/configuration") });
  const documents = useQuery({ queryKey: ["sunat-documents"], queryFn: () => api<Document[]>("/sunat/documents?limit=100") });
  const submit = useMutation({
    mutationFn: () => apiIdempotent(`/sunat/documents/${selected?.id}/mock-submit`, "sunat-mock-submit", { scenario }),
    onSuccess: async () => {
      setSelected(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["sunat-documents"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });
  if (configuration.isLoading || documents.isLoading) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Documentos electrónicos" title="SUNAT básico" />
    <div className="sunat-warning" role="note"><strong>Modo no productivo</strong><span>{configuration.data?.warning}</span></div>
    <div className="provider-strip">{configuration.data?.providers.map((provider) => <article key={provider.provider}><strong>{provider.provider}</strong><StatusBadge status={provider.valid ? "active" : "FAILED"} /><small>{provider.warnings.join(" ") || "Configuración válida."}</small></article>)}</div>
    {selected ? <form className="operational-form compact-form" onSubmit={(event) => { event.preventDefault(); submit.mutate(); }}>
      <div className="form-heading"><div><h2>Simular envío</h2><p>{selected.series}-{String(selected.number).padStart(8, "0")} · Nunca representa conexión productiva.</p></div></div>
      <ErrorNotice error={submit.error} />
      <Field label="Escenario"><select className="input" value={scenario} onChange={(event) => setScenario(event.target.value)}>
        <option value="ACCEPT">Aceptado</option><option value="ACCEPT_WITH_OBSERVATIONS">Aceptado con observaciones</option>
        <option value="REJECT">Rechazado</option><option value="TIMEOUT">Tiempo de espera agotado</option>
        <option value="TEMPORARY_FAILURE">Falla temporal</option>
      </select></Field>
      <FormActions pending={submit.isPending} submitLabel="Ejecutar simulación" onCancel={() => setSelected(null)} />
    </form> : null}
    <ErrorNotice error={configuration.error || documents.error} />
    <ResponsiveRecords rows={documents.data ?? []} columns={[
      { key: "document", label: "Documento", render: (row) => <><strong>{row.series}-{String(row.number).padStart(8, "0")}</strong><br /><small>{row.documentType}</small></> },
      { key: "customer", label: "Cliente", render: (row) => row.customerName },
      { key: "date", label: "Emisión", render: (row) => dateLabel(row.issueDate) },
      { key: "total", label: "Total", render: (row) => money(row.total, row.currency) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "attempts", label: "Intentos", render: (row) => row.submissionAttempts },
      { key: "action", label: "", render: (row) => <Button variant="secondary" onClick={() => setSelected(row)}>Simular envío</Button> }
    ]} mobile={(row) => <><strong>{row.series}-{String(row.number).padStart(8, "0")}</strong><span>{row.customerName} · {money(row.total, row.currency)}</span><small>{dateLabel(row.issueDate)} · {row.submissionAttempts} intentos</small><StatusBadge status={row.status} /><Button variant="secondary" onClick={() => setSelected(row)}>Simular envío</Button></>} />
    <div className="official-links">{configuration.data?.officialLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div>
  </div>;
}
