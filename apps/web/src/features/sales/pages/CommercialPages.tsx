/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiIdempotent } from "../../../api";
import { useAuth } from "../../../auth";
import { Button, Field, LoadingState, PageHeader, TextInput } from "../../../components/Ui";
import { deleteScopedDraft, getScopedDraft, saveScopedDraft } from "../../../drafts";
import {
  dateLabel, ErrorNotice, FormActions, money, ResponsiveRecords, StatusBadge
} from "../../shared/OperationalUi";

interface Party { id: string; legalName?: string; firstName?: string; lastName?: string; }
interface Item { id: string; code: string; name: string; salePrice: string; }
interface Warehouse { id: string; name: string; }
interface Quotation {
  id: string; number: string; issueDate: string; validUntil: string; status: string;
  currency: string; total: string; customerName: string;
}
interface Order { id: string; number: string; orderDate: string; status: string; currency: string; total: string; customerName: string; }
interface Sale {
  id: string; number?: string; saleDate: string; status: string; paymentCondition: string;
  currency: string; total: string; paidAmount: string; customerName: string;
}
interface DraftLine { customerPartyId: string; itemId: string; quantity: string; discountRate: string; }

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const initialLine: DraftLine = { customerPartyId: "", itemId: "", quantity: "1", discountRate: "0" };
const partyName = (party: Party) =>
  party.legalName || [party.firstName, party.lastName].filter(Boolean).join(" ") || "Sin nombre";
function usePdf() {
  return useMutation({
    mutationFn: ({ type, id }: { type: "quotation" | "sales-order" | "sale"; id: string }) =>
      api<{ url: string }>(`/pdf/${type}/${id}`, { method: "POST" }),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener,noreferrer")
  });
}

function useCommercialCatalogs(includeWarehouses = false) {
  const customers = useQuery({ queryKey: ["customers", "commercial"], queryFn: () => api<{ data: Party[] }>("/customers?limit=100") });
  const items = useQuery({ queryKey: ["items", "commercial"], queryFn: () => api<{ data: Item[] }>("/items?limit=100") });
  const warehouses = useQuery({
    queryKey: ["warehouses", "commercial"], queryFn: () => api<Warehouse[]>("/warehouses"),
    enabled: includeWarehouses
  });
  return { customers, items, warehouses };
}

export function QuotationsPage() {
  const client = useQueryClient();
  const pdf = usePdf();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...initialLine, validUntil: plusDays(15), notes: "" });
  const catalogs = useCommercialCatalogs();
  const records = useQuery({ queryKey: ["quotations"], queryFn: () => api<Quotation[]>("/quotations?limit=100") });
  useEffect(() => {
    if (!creating || !user) return;
    void getScopedDraft<typeof form>(user.userId, user.companyId, "quotation").then((draft) => {
      if (draft) setForm(draft.value);
    });
  }, [creating, user]);
  useEffect(() => {
    if (!creating || !user) return;
    const timer = window.setTimeout(() => void saveScopedDraft({
      userId: user.userId, companyId: user.companyId, type: "quotation", draftId: "new", value: form
    }), 350);
    return () => window.clearTimeout(timer);
  }, [creating, form, user]);
  const create = useMutation({
    mutationFn: () => api("/quotations", {
      method: "POST", body: JSON.stringify({
        customerPartyId: form.customerPartyId, validUntil: form.validUntil, currency: "PEN",
        notes: form.notes || undefined,
        lines: [{ itemId: form.itemId, quantity: form.quantity, discountRate: form.discountRate }]
      })
    }),
    onSuccess: async () => {
      if (user) await deleteScopedDraft(user.userId, user.companyId, "quotation");
      setCreating(false); setForm({ ...initialLine, validUntil: plusDays(15), notes: "" });
      await client.invalidateQueries({ queryKey: ["quotations"] });
    }
  });
  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "SENT" | "ACCEPTED" }) =>
      api(`/quotations/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["quotations"] })
  });
  const convert = useMutation({
    mutationFn: (id: string) => api(`/quotations/${id}/convert`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["quotations"] }),
        client.invalidateQueries({ queryKey: ["sales-orders"] })
      ]);
    }
  });
  if (records.isLoading || catalogs.customers.isLoading || catalogs.items.isLoading) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Ventas" title="Cotizaciones" action={<Button onClick={() => setCreating(true)}>Nueva cotización</Button>} />
    {creating ? <form className="operational-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="form-heading"><div><h2>Nueva cotización</h2><p>El servidor resolverá precios, impuestos y numeración.</p></div></div>
      <ErrorNotice error={create.error} />
      <div className="form-grid">
        <Field label="Cliente" required><select required className="input" value={form.customerPartyId} onChange={(event) => setForm({ ...form, customerPartyId: event.target.value })}>
          <option value="">Seleccione</option>{catalogs.customers.data?.data.map((party) => <option key={party.id} value={party.id}>{partyName(party)}</option>)}
        </select></Field>
        <Field label="Válida hasta" required><TextInput required type="date" min={today()} value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field>
        <Field label="Producto o servicio" required><select required className="input" value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}>
          <option value="">Seleccione</option>{catalogs.items.data?.data.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></Field>
        <Field label="Cantidad" required><TextInput required type="number" inputMode="decimal" min="0.000001" step="0.000001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
        <Field label="Descuento"><TextInput type="number" inputMode="decimal" min="0" max="1" step="0.000001" value={form.discountRate} onChange={(event) => setForm({ ...form, discountRate: event.target.value })} /></Field>
        <Field label="Notas"><TextInput value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
      </div>
      <FormActions pending={create.isPending} submitLabel="Crear cotización" onCancel={() => setCreating(false)} />
    </form> : null}
    <ErrorNotice error={records.error || transition.error || convert.error || pdf.error} />
    <ResponsiveRecords rows={records.data ?? []} columns={[
      { key: "number", label: "Número", render: (row) => <strong>{row.number}</strong> },
      { key: "customer", label: "Cliente", render: (row) => row.customerName },
      { key: "valid", label: "Vigencia", render: (row) => dateLabel(row.validUntil) },
      { key: "total", label: "Total", render: (row) => money(row.total, row.currency) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "actions", label: "Acciones", render: (row) => <div className="inline-actions">
        <Button variant="secondary" onClick={() => pdf.mutate({ type: "quotation", id: row.id })}>PDF</Button>
        {row.status === "DRAFT" ? <Button variant="secondary" onClick={() => transition.mutate({ id: row.id, status: "SENT" })}>Enviar</Button> : null}
        {row.status === "SENT" ? <Button variant="secondary" onClick={() => transition.mutate({ id: row.id, status: "ACCEPTED" })}>Aceptar</Button> : null}
        {row.status === "ACCEPTED" ? <Button onClick={() => convert.mutate(row.id)}>Convertir</Button> : null}
      </div> }
    ]} mobile={(row) => <><strong>{row.number} · {row.customerName}</strong><span>{money(row.total, row.currency)}</span><small>Vence {dateLabel(row.validUntil)}</small><StatusBadge status={row.status} />
      <div className="inline-actions">
        <Button variant="secondary" onClick={() => pdf.mutate({ type: "quotation", id: row.id })}>PDF</Button>
        {row.status === "DRAFT" ? <Button variant="secondary" onClick={() => transition.mutate({ id: row.id, status: "SENT" })}>Enviar</Button> : null}
        {row.status === "SENT" ? <Button variant="secondary" onClick={() => transition.mutate({ id: row.id, status: "ACCEPTED" })}>Aceptar</Button> : null}
        {row.status === "ACCEPTED" ? <Button onClick={() => convert.mutate(row.id)}>Convertir</Button> : null}
      </div></>} />
  </div>;
}

export function SalesOrdersPage() {
  const client = useQueryClient();
  const pdf = usePdf();
  const records = useQuery({ queryKey: ["sales-orders"], queryFn: () => api<Order[]>("/sales-orders?limit=100") });
  const confirm = useMutation({
    mutationFn: (id: string) => apiIdempotent(`/sales-orders/${id}/confirm`, "confirm-sales-order"),
    onSuccess: () => client.invalidateQueries({ queryKey: ["sales-orders"] })
  });
  if (records.isLoading) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Ventas" title="Pedidos de venta" />
    <p className="page-intro">Los pedidos nacen de cotizaciones aceptadas y conservan la trazabilidad comercial.</p>
    <ErrorNotice error={records.error || confirm.error || pdf.error} />
    <ResponsiveRecords rows={records.data ?? []} columns={[
      { key: "number", label: "Pedido", render: (row) => <strong>{row.number}</strong> },
      { key: "customer", label: "Cliente", render: (row) => row.customerName },
      { key: "date", label: "Fecha", render: (row) => dateLabel(row.orderDate) },
      { key: "total", label: "Total", render: (row) => money(row.total, row.currency) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "action", label: "", render: (row) => <div className="inline-actions"><Button variant="secondary" onClick={() => pdf.mutate({ type: "sales-order", id: row.id })}>PDF</Button>{row.status === "DRAFT" ? <Button onClick={() => confirm.mutate(row.id)}>Confirmar</Button> : null}</div> }
    ]} mobile={(row) => <><strong>{row.number} · {row.customerName}</strong><span>{money(row.total, row.currency)}</span><StatusBadge status={row.status} /><div className="inline-actions"><Button variant="secondary" onClick={() => pdf.mutate({ type: "sales-order", id: row.id })}>PDF</Button>{row.status === "DRAFT" ? <Button onClick={() => confirm.mutate(row.id)}>Confirmar pedido</Button> : null}</div></>} />
  </div>;
}

export function SalesPage() {
  const client = useQueryClient();
  const pdf = usePdf();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...initialLine, warehouseId: "", paymentCondition: "CASH", dueDate: plusDays(30) });
  const catalogs = useCommercialCatalogs(true);
  const records = useQuery({ queryKey: ["sales"], queryFn: () => api<Sale[]>("/sales?limit=100") });
  const create = useMutation({
    mutationFn: () => api<{ id: string }>("/sales", { method: "POST", body: JSON.stringify({
      customerPartyId: form.customerPartyId, warehouseId: form.warehouseId || undefined,
      paymentCondition: form.paymentCondition, dueDate: form.paymentCondition === "CREDIT" ? form.dueDate : undefined,
      currency: "PEN", lines: [{ itemId: form.itemId, quantity: form.quantity, discountRate: form.discountRate }]
    }) }),
    onSuccess: async () => { setCreating(false); await client.invalidateQueries({ queryKey: ["sales"] }); }
  });
  const confirm = useMutation({
    mutationFn: (id: string) => apiIdempotent(`/sales/${id}/confirm`, "confirm-sale"),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["sales"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["inventory"] })
      ]);
    }
  });
  const issue = useMutation({
    mutationFn: (id: string) => apiIdempotent(`/sales/${id}/commercial-documents`, "issue-commercial-document", { documentType: "INTERNAL_SALE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["sunat-documents"] })
  });
  if (records.isLoading || catalogs.customers.isLoading || catalogs.items.isLoading || catalogs.warehouses.isLoading) return <LoadingState />;
  return <div className="standard-page quick-sale-page">
    <PageHeader eyebrow="Ventas" title="Ventas" action={<Button onClick={() => setCreating(true)}>Venta rápida</Button>} />
    {creating ? <form className="operational-form quick-sale-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="form-heading"><div><h2>Nueva venta</h2><p>Los totales se calculan al guardar en el servidor.</p></div></div>
      <ErrorNotice error={create.error} />
      <div className="form-grid">
        <Field label="Cliente" required><select required className="input" value={form.customerPartyId} onChange={(event) => setForm({ ...form, customerPartyId: event.target.value })}>
          <option value="">Seleccione</option>{catalogs.customers.data?.data.map((party) => <option key={party.id} value={party.id}>{partyName(party)}</option>)}
        </select></Field>
        <Field label="Producto" required><select required className="input" value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}>
          <option value="">Seleccione</option>{catalogs.items.data?.data.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></Field>
        <Field label="Cantidad" required><TextInput required type="number" inputMode="decimal" min="0.000001" step="0.000001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
        <Field label="Almacén"><select className="input" value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          <option value="">Sin afectación de stock</option>{catalogs.warehouses.data?.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select></Field>
        <Field label="Condición"><select className="input" value={form.paymentCondition} onChange={(event) => setForm({ ...form, paymentCondition: event.target.value })}>
          <option value="CASH">Contado</option><option value="CREDIT">Crédito</option>
        </select></Field>
        {form.paymentCondition === "CREDIT" ? <Field label="Vencimiento" required><TextInput required type="date" min={today()} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field> : null}
      </div>
      <FormActions pending={create.isPending} submitLabel="Guardar venta" onCancel={() => setCreating(false)} />
    </form> : null}
    <ErrorNotice error={records.error || confirm.error || issue.error || pdf.error} />
    <ResponsiveRecords rows={records.data ?? []} columns={[
      { key: "number", label: "Venta", render: (row) => <strong>{row.number || "Pendiente"}</strong> },
      { key: "customer", label: "Cliente", render: (row) => row.customerName },
      { key: "date", label: "Fecha", render: (row) => dateLabel(row.saleDate) },
      { key: "condition", label: "Condición", render: (row) => row.paymentCondition === "CASH" ? "Contado" : "Crédito" },
      { key: "total", label: "Total", render: (row) => money(row.total, row.currency) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "actions", label: "", render: (row) => <div className="inline-actions">
        <Button variant="secondary" onClick={() => pdf.mutate({ type: "sale", id: row.id })}>PDF</Button>
        {row.status === "DRAFT" ? <Button onClick={() => confirm.mutate(row.id)}>Confirmar</Button> : null}
        {["CONFIRMED", "PARTIALLY_PAID", "PAID"].includes(row.status) ? <Button variant="secondary" onClick={() => issue.mutate(row.id)}>Documento interno</Button> : null}
      </div> }
    ]} mobile={(row) => <><strong>{row.number || "Venta en borrador"} · {row.customerName}</strong><span className="record-total">{money(row.total, row.currency)}</span><small>{dateLabel(row.saleDate)} · {row.paymentCondition === "CASH" ? "Contado" : "Crédito"}</small><StatusBadge status={row.status} />
      <div className="inline-actions"><Button variant="secondary" onClick={() => pdf.mutate({ type: "sale", id: row.id })}>PDF</Button>{row.status === "DRAFT" ? <Button onClick={() => confirm.mutate(row.id)}>Confirmar</Button> : null}{["CONFIRMED", "PARTIALLY_PAID", "PAID"].includes(row.status) ? <Button variant="secondary" onClick={() => issue.mutate(row.id)}>Emitir</Button> : null}</div></>} />
  </div>;
}
