/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, apiIdempotent, downloadTextFile } from "../../../api";
import { Button, Field, PageHeader } from "../../../components/Ui";
import { ErrorNotice, StatusBadge } from "../../shared/OperationalUi";

type ImportType = "CUSTOMERS" | "SUPPLIERS" | "PRODUCTS" | "SERVICES" | "OPENING_STOCK" | "PRICE_LISTS";
type ExportType = "customers" | "suppliers" | "products" | "sales" | "purchases" | "receivables" | "payables" | "inventory" | "cash";
interface Preview {
  id: string; type: ImportType; status: string; totalRows: number; validRows: number; invalidRows: number;
  rows: Array<{ rowNumber: number; normalized: Record<string, string>; errors: string[] }>;
}

export default function DataExchangePage() {
  const [type, setType] = useState<ImportType>("CUSTOMERS");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [exportType, setExportType] = useState<ExportType>("customers");
  const template = useMutation({
    mutationFn: () => api<{ filename: string; csv: string }>(`/imports/template?type=${type}`),
    onSuccess: (result) => downloadTextFile(result.filename, result.csv)
  });
  const inspect = useMutation({
    mutationFn: () => api<Preview>("/imports/preview", { method: "POST", body: JSON.stringify({ type, csv }) }),
    onSuccess: setPreview
  });
  const execute = useMutation({
    mutationFn: () => apiIdempotent(`/imports/${preview?.id}/execute`, "execute-import"),
    onSuccess: () => setPreview((current) => current ? { ...current, status: "COMPLETED" } : current)
  });
  const exportData = useMutation({
    mutationFn: () => api<{ filename: string; csv: string }>(`/exports?type=${exportType}&limit=1000`),
    onSuccess: (result) => downloadTextFile(result.filename, result.csv)
  });
  const readFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  };
  return <div className="standard-page">
    <PageHeader eyebrow="Datos" title="Importaciones y exportaciones" />
    <div className="dashboard-grid data-exchange-grid">
      <section className="dashboard-panel dashboard-wide">
        <div className="panel-title"><h2>Importar CSV</h2><StatusBadge status={preview?.status ?? "DRAFT"} /></div>
        <ErrorNotice error={template.error || inspect.error || execute.error} />
        <div className="stack-form">
          <Field label="Tipo"><select className="input" value={type} onChange={(event) => { setType(event.target.value as ImportType); setPreview(null); }}>
            <option value="CUSTOMERS">Clientes</option><option value="SUPPLIERS">Proveedores</option>
            <option value="PRODUCTS">Productos</option><option value="SERVICES">Servicios</option>
            <option value="OPENING_STOCK">Stock inicial</option><option value="PRICE_LISTS">Listas de precios</option>
          </select></Field>
          <Field label="Archivo"><input className="input" type="file" accept=".csv,text/csv" onChange={(event) => readFile(event.target.files?.[0])} /></Field>
          <div className="inline-actions"><Button variant="secondary" onClick={() => template.mutate()}>Descargar plantilla</Button><Button disabled={!csv || inspect.isPending} onClick={() => inspect.mutate()}>Previsualizar</Button></div>
        </div>
        {preview ? <div className="import-preview">
          <div className="import-summary"><strong>{preview.totalRows} filas</strong><span>{preview.validRows} válidas</span><span className={preview.invalidRows ? "danger-text" : ""}>{preview.invalidRows} con errores</span></div>
          {preview.rows.slice(0, 12).map((row) => <div key={row.rowNumber}><strong>Fila {row.rowNumber}</strong><span>{Object.values(row.normalized).join(" · ")}</span><small>{row.errors.join("; ") || "Válida"}</small></div>)}
          <Button disabled={preview.invalidRows > 0 || preview.status === "COMPLETED" || execute.isPending} onClick={() => execute.mutate()}>Ejecutar importación revisada</Button>
        </div> : null}
      </section>
      <section className="dashboard-panel">
        <div className="panel-title"><h2>Exportar datos</h2></div>
        <div className="stack-form"><Field label="Conjunto"><select className="input" value={exportType} onChange={(event) => setExportType(event.target.value as ExportType)}>
          <option value="customers">Clientes</option><option value="suppliers">Proveedores</option><option value="products">Productos</option>
          <option value="sales">Ventas</option><option value="purchases">Compras</option><option value="receivables">Por cobrar</option>
          <option value="payables">Por pagar</option><option value="inventory">Inventario</option><option value="cash">Caja</option>
        </select></Field><Button disabled={exportData.isPending} onClick={() => exportData.mutate()}>Descargar CSV</Button></div>
        <ErrorNotice error={exportData.error} />
      </section>
    </div>
  </div>;
}
