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
import { Button, Field, LoadingState, PageHeader, TextInput } from "../../../components/Ui";
import { dateLabel, ErrorNotice, FormActions, ResponsiveRecords, StatusBadge } from "../../shared/OperationalUi";

interface Warehouse { id: string; code: string; name: string; }
interface Item { id: string; code: string; name: string; }
interface Balance { warehouseId: string; warehouse: string; itemId: string; code: string; name: string; unit?: string; quantity: string; minimumStock: string; lowStock: boolean; }
interface Movement { id: string; movementType: string; movementDate: string; reason?: string; status: string; warehouse: string; lineCount: number; }

export default function InventoryPage() {
  const client = useQueryClient();
  const [mode, setMode] = useState<"adjust" | "transfer" | null>(null);
  const [form, setForm] = useState({ warehouseId: "", targetWarehouseId: "", itemId: "", quantity: "1", movementType: "POSITIVE_ADJUSTMENT", reason: "" });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: () => api<Warehouse[]>("/warehouses") });
  const items = useQuery({ queryKey: ["items", "inventory"], queryFn: () => api<{ data: Item[] }>("/items?limit=100") });
  const balances = useQuery({ queryKey: ["inventory"], queryFn: () => api<Balance[]>("/inventory") });
  const movements = useQuery({ queryKey: ["inventory-movements"], queryFn: () => api<Movement[]>("/inventory/movements?limit=50") });
  const operation = useMutation({
    mutationFn: () => mode === "transfer"
      ? apiIdempotent("/inventory/transfers", "inventory-transfer", {
        sourceWarehouseId: form.warehouseId, targetWarehouseId: form.targetWarehouseId,
        lines: [{ itemId: form.itemId, quantity: form.quantity }], reason: form.reason
      })
      : apiIdempotent("/inventory/adjustments", "inventory-adjustment", {
        warehouseId: form.warehouseId, movementType: form.movementType,
        lines: [{ itemId: form.itemId, quantity: form.quantity }], reason: form.reason
      }),
    onSuccess: async () => {
      setMode(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["inventory"] }),
        client.invalidateQueries({ queryKey: ["inventory-movements"] })
      ]);
    }
  });
  if ([warehouses, items, balances, movements].some((query) => query.isLoading)) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Operación" title="Inventario" action={<div className="inline-actions"><Button variant="secondary" onClick={() => setMode("transfer")}>Transferir</Button><Button onClick={() => setMode("adjust")}>Ajustar</Button></div>} />
    {mode ? <form className="operational-form" onSubmit={(event) => { event.preventDefault(); operation.mutate(); }}>
      <div className="form-heading"><div><h2>{mode === "transfer" ? "Transferencia entre almacenes" : "Ajuste de inventario"}</h2><p>La operación se valida y aplica de forma transaccional.</p></div></div><ErrorNotice error={operation.error} />
      <div className="form-grid">
        <Field label={mode === "transfer" ? "Origen" : "Almacén"} required><select required className="input" value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}><option value="">Seleccione</option>{warehouses.data?.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
        {mode === "transfer" ? <Field label="Destino" required><select required className="input" value={form.targetWarehouseId} onChange={(event) => setForm({ ...form, targetWarehouseId: event.target.value })}><option value="">Seleccione</option>{warehouses.data?.filter((row) => row.id !== form.warehouseId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field> : <Field label="Tipo"><select className="input" value={form.movementType} onChange={(event) => setForm({ ...form, movementType: event.target.value })}><option value="POSITIVE_ADJUSTMENT">Ajuste positivo</option><option value="NEGATIVE_ADJUSTMENT">Ajuste negativo</option></select></Field>}
        <Field label="Producto" required><select required className="input" value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}><option value="">Seleccione</option>{items.data?.data.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></Field>
        <Field label="Cantidad" required><TextInput required type="number" inputMode="decimal" min="0.000001" step="0.000001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
        <Field label="Motivo" required><TextInput required minLength={5} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></Field>
      </div><FormActions pending={operation.isPending} submitLabel={mode === "transfer" ? "Transferir stock" : "Aplicar ajuste"} onCancel={() => setMode(null)} />
    </form> : null}
    <section className="dashboard-panel inventory-balances"><div className="panel-title"><h2>Saldos actuales</h2></div>
      <ResponsiveRecords rows={balances.data ?? []} columns={[
        { key: "item", label: "Producto", render: (row) => <><strong>{row.name}</strong><br /><code>{row.code}</code></> },
        { key: "warehouse", label: "Almacén", render: (row) => row.warehouse },
        { key: "quantity", label: "Disponible", render: (row) => `${row.quantity} ${row.unit ?? ""}` },
        { key: "minimum", label: "Mínimo", render: (row) => row.minimumStock },
        { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.lowStock ? "LOW_STOCK" : "active"} /> }
      ]} mobile={(row) => <><strong>{row.name}</strong><span>{row.quantity} {row.unit ?? ""}</span><small>{row.warehouse} · Mínimo {row.minimumStock}</small><StatusBadge status={row.lowStock ? "LOW_STOCK" : "active"} /></>} />
    </section>
    <section className="dashboard-panel"><div className="panel-title"><h2>Movimientos recientes</h2></div>
      <ResponsiveRecords rows={movements.data ?? []} columns={[
        { key: "date", label: "Fecha", render: (row) => dateLabel(row.movementDate) },
        { key: "type", label: "Tipo", render: (row) => row.movementType },
        { key: "warehouse", label: "Almacén", render: (row) => row.warehouse },
        { key: "lines", label: "Líneas", render: (row) => row.lineCount },
        { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> }
      ]} mobile={(row) => <><strong>{row.movementType}</strong><span>{row.warehouse}</span><small>{dateLabel(row.movementDate)} · {row.lineCount} líneas</small><StatusBadge status={row.status} /></>} />
    </section>
  </div>;
}
