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
import { dateLabel, ErrorNotice, FormActions, money, ResponsiveRecords, StatusBadge } from "../../shared/OperationalUi";

interface Named { id: string; name?: string; legalName?: string; firstName?: string; lastName?: string; code?: string; }
interface Purchase { id: string; number?: string; purchaseDate: string; status: string; paymentCondition: string; currency: string; total: string; supplierName: string; }
interface Expense { id: string; description: string; expenseDate: string; currency: string; total: string; status: string; category: string; supplierName: string; }
const today = () => new Date().toISOString().slice(0, 10);
const name = (row: Named) => row.legalName || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name || "Sin nombre";
function usePurchasePdf() {
  return useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/pdf/purchase/${id}`, { method: "POST" }),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener,noreferrer")
  });
}

export function PurchasesPage() {
  const client = useQueryClient();
  const pdf = usePurchasePdf();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ supplierPartyId: "", warehouseId: "", itemId: "", quantity: "1", unitCost: "0.00", paymentCondition: "CASH", issueDate: today(), dueDate: today() });
  const records = useQuery({ queryKey: ["purchases"], queryFn: () => api<Purchase[]>("/purchases?limit=100") });
  const suppliers = useQuery({ queryKey: ["suppliers", "purchase"], queryFn: () => api<{ data: Named[] }>("/suppliers?limit=100") });
  const items = useQuery({ queryKey: ["items", "purchase"], queryFn: () => api<{ data: Named[] }>("/items?limit=100") });
  const warehouses = useQuery({ queryKey: ["warehouses", "purchase"], queryFn: () => api<Named[]>("/warehouses") });
  useEffect(() => {
    if (!creating || !user) return;
    void getScopedDraft<typeof form>(user.userId, user.companyId, "purchase").then((draft) => { if (draft) setForm(draft.value); });
  }, [creating, user]);
  useEffect(() => {
    if (!creating || !user) return;
    const timer = window.setTimeout(() => void saveScopedDraft({ userId: user.userId, companyId: user.companyId, type: "purchase", draftId: "new", value: form }), 350);
    return () => window.clearTimeout(timer);
  }, [creating, form, user]);
  const create = useMutation({
    mutationFn: () => api("/purchases", { method: "POST", body: JSON.stringify({
      supplierPartyId: form.supplierPartyId, warehouseId: form.warehouseId || undefined,
      issueDate: form.issueDate, dueDate: form.paymentCondition === "CREDIT" ? form.dueDate : undefined,
      currency: "PEN", paymentCondition: form.paymentCondition,
      lines: [{ itemId: form.itemId, quantity: form.quantity, unitCost: form.unitCost }]
    }) }),
    onSuccess: async () => {
      if (user) await deleteScopedDraft(user.userId, user.companyId, "purchase");
      setCreating(false); await client.invalidateQueries({ queryKey: ["purchases"] });
    }
  });
  const confirm = useMutation({
    mutationFn: (id: string) => apiIdempotent(`/purchases/${id}/confirm`, "confirm-purchase"),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ["purchases"] }), client.invalidateQueries({ queryKey: ["inventory"] })]);
    }
  });
  if ([records, suppliers, items, warehouses].some((query) => query.isLoading)) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Compras" title="Compras" action={<Button onClick={() => setCreating(true)}>Nueva compra</Button>} />
    {creating ? <form className="operational-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="form-heading"><div><h2>Nueva compra</h2><p>La confirmación posterior registrará stock y cuentas por pagar.</p></div></div><ErrorNotice error={create.error} />
      <div className="form-grid">
        <Field label="Proveedor" required><select required className="input" value={form.supplierPartyId} onChange={(event) => setForm({ ...form, supplierPartyId: event.target.value })}><option value="">Seleccione</option>{suppliers.data?.data.map((row) => <option key={row.id} value={row.id}>{name(row)}</option>)}</select></Field>
        <Field label="Fecha documento" required><TextInput required type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></Field>
        <Field label="Producto" required><select required className="input" value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}><option value="">Seleccione</option>{items.data?.data.map((row) => <option key={row.id} value={row.id}>{row.code} · {name(row)}</option>)}</select></Field>
        <Field label="Almacén"><select className="input" value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}><option value="">Sin ingreso de stock</option>{warehouses.data?.map((row) => <option key={row.id} value={row.id}>{name(row)}</option>)}</select></Field>
        <Field label="Cantidad" required><TextInput required type="number" inputMode="decimal" min="0.000001" step="0.000001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
        <Field label="Costo unitario" required><TextInput required type="number" inputMode="decimal" min="0" step="0.000001" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></Field>
        <Field label="Condición"><select className="input" value={form.paymentCondition} onChange={(event) => setForm({ ...form, paymentCondition: event.target.value })}><option value="CASH">Contado</option><option value="CREDIT">Crédito</option></select></Field>
        {form.paymentCondition === "CREDIT" ? <Field label="Vencimiento" required><TextInput required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field> : null}
      </div><FormActions pending={create.isPending} submitLabel="Guardar compra" onCancel={() => setCreating(false)} />
    </form> : null}
    <ErrorNotice error={records.error || confirm.error || pdf.error} />
    <ResponsiveRecords rows={records.data ?? []} columns={[
      { key: "number", label: "Compra", render: (row) => <strong>{row.number || "Pendiente"}</strong> },
      { key: "supplier", label: "Proveedor", render: (row) => row.supplierName },
      { key: "date", label: "Fecha", render: (row) => dateLabel(row.purchaseDate) },
      { key: "total", label: "Total", render: (row) => money(row.total, row.currency) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "action", label: "", render: (row) => <div className="inline-actions"><Button variant="secondary" onClick={() => pdf.mutate(row.id)}>PDF</Button>{row.status === "DRAFT" ? <Button onClick={() => confirm.mutate(row.id)}>Confirmar</Button> : null}</div> }
    ]} mobile={(row) => <><strong>{row.number || "Compra en borrador"} · {row.supplierName}</strong><span>{money(row.total, row.currency)}</span><StatusBadge status={row.status} /><div className="inline-actions"><Button variant="secondary" onClick={() => pdf.mutate(row.id)}>PDF</Button>{row.status === "DRAFT" ? <Button onClick={() => confirm.mutate(row.id)}>Confirmar compra</Button> : null}</div></>} />
  </div>;
}

export function ExpensesPage() {
  const client = useQueryClient();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ supplierPartyId: "", categoryId: "", description: "", expenseDate: today(), amount: "0.00", taxAmount: "0.00", paymentCondition: "CASH", dueDate: today() });
  const records = useQuery({ queryKey: ["expenses"], queryFn: () => api<Expense[]>("/expenses?limit=100") });
  const categories = useQuery({ queryKey: ["expense-categories"], queryFn: () => api<Named[]>("/expense-categories") });
  const suppliers = useQuery({ queryKey: ["suppliers", "expense"], queryFn: () => api<{ data: Named[] }>("/suppliers?limit=100") });
  useEffect(() => {
    if (!creating || !user) return;
    void getScopedDraft<typeof form>(user.userId, user.companyId, "expense").then((draft) => { if (draft) setForm(draft.value); });
  }, [creating, user]);
  useEffect(() => {
    if (!creating || !user) return;
    const timer = window.setTimeout(() => void saveScopedDraft({ userId: user.userId, companyId: user.companyId, type: "expense", draftId: "new", value: form }), 350);
    return () => window.clearTimeout(timer);
  }, [creating, form, user]);
  const create = useMutation({
    mutationFn: () => api("/expenses", { method: "POST", body: JSON.stringify({
      supplierPartyId: form.supplierPartyId || undefined, categoryId: form.categoryId,
      description: form.description, expenseDate: form.expenseDate, currency: "PEN",
      amount: form.amount, taxAmount: form.taxAmount, paymentCondition: form.paymentCondition,
      dueDate: form.paymentCondition === "CREDIT" ? form.dueDate : undefined
    }) }),
    onSuccess: async () => {
      if (user) await deleteScopedDraft(user.userId, user.companyId, "expense");
      setCreating(false); await client.invalidateQueries({ queryKey: ["expenses"] });
    }
  });
  const register = useMutation({
    mutationFn: (id: string) => apiIdempotent(`/expenses/${id}/register`, "register-expense"),
    onSuccess: () => client.invalidateQueries({ queryKey: ["expenses"] })
  });
  if ([records, categories, suppliers].some((query) => query.isLoading)) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Compras" title="Gastos" action={<Button onClick={() => setCreating(true)}>Nuevo gasto</Button>} />
    {creating ? <form className="operational-form mobile-capture-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="form-heading"><div><h2>Registro rápido de gasto</h2><p>Puede guardar el borrador y continuar desde este dispositivo.</p></div></div><ErrorNotice error={create.error} />
      <div className="form-grid">
        <Field label="Comprobante"><input className="input" type="file" accept="image/*,application/pdf" capture="environment" aria-label="Adjuntar comprobante" /></Field>
        <Field label="Proveedor"><select className="input" value={form.supplierPartyId} onChange={(event) => setForm({ ...form, supplierPartyId: event.target.value })}><option value="">No identificado</option>{suppliers.data?.data.map((row) => <option key={row.id} value={row.id}>{name(row)}</option>)}</select></Field>
        <Field label="Categoría" required><select required className="input" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Seleccione</option>{categories.data?.map((row) => <option key={row.id} value={row.id}>{name(row)}</option>)}</select></Field>
        <Field label="Descripción" required><TextInput required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <Field label="Fecha" required><TextInput required type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} /></Field>
        <Field label="Base" required><TextInput required type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
        <Field label="Impuesto" required><TextInput required type="number" inputMode="decimal" min="0" step="0.01" value={form.taxAmount} onChange={(event) => setForm({ ...form, taxAmount: event.target.value })} /></Field>
        <Field label="Condición"><select className="input" value={form.paymentCondition} onChange={(event) => setForm({ ...form, paymentCondition: event.target.value })}><option value="CASH">Contado</option><option value="CREDIT">Crédito</option></select></Field>
        {form.paymentCondition === "CREDIT" ? <Field label="Vencimiento" required><TextInput required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field> : null}
      </div><FormActions pending={create.isPending} submitLabel="Guardar gasto" onCancel={() => setCreating(false)} />
    </form> : null}
    <ErrorNotice error={records.error || register.error} />
    <ResponsiveRecords rows={records.data ?? []} columns={[
      { key: "expense", label: "Gasto", render: (row) => <><strong>{row.description}</strong><br /><small>{row.category}</small></> },
      { key: "supplier", label: "Proveedor", render: (row) => row.supplierName },
      { key: "date", label: "Fecha", render: (row) => dateLabel(row.expenseDate) },
      { key: "total", label: "Total", render: (row) => money(row.total, row.currency) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "action", label: "", render: (row) => row.status === "DRAFT" ? <Button onClick={() => register.mutate(row.id)}>Registrar</Button> : null }
    ]} mobile={(row) => <><strong>{row.description}</strong><span>{money(row.total, row.currency)}</span><small>{row.category} · {row.supplierName}</small><StatusBadge status={row.status} />{row.status === "DRAFT" ? <Button onClick={() => register.mutate(row.id)}>Registrar gasto</Button> : null}</>} />
  </div>;
}
