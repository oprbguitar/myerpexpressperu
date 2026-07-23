import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api";
import { Button, Field, LoadingState, PageHeader, TextInput } from "../../../components/Ui";
import { ErrorNotice, FormActions, ResponsiveRecords, StatusBadge } from "../../shared/OperationalUi";

interface PriceList { id: string; code: string; name: string; currency: string; validFrom: string; validUntil?: string; isDefault: boolean; status: string; itemCount: number; }
interface Item { id: string; code: string; name: string; salePrice: string; }

export default function PricingPage() {
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", currency: "PEN", validFrom: new Date().toISOString().slice(0, 10),
    validUntil: "", isDefault: false, itemId: "", minimumQuantity: "1", unitPrice: "0.00", maximumDiscountRate: "0.05"
  });
  const lists = useQuery({ queryKey: ["price-lists"], queryFn: () => api<PriceList[]>("/price-lists") });
  const items = useQuery({ queryKey: ["items", "pricing"], queryFn: () => api<{ data: Item[] }>("/items?limit=100") });
  const create = useMutation({
    mutationFn: () => api("/price-lists", {
      method: "POST", body: JSON.stringify({
        code: form.code, name: form.name, currency: form.currency, validFrom: form.validFrom,
        validUntil: form.validUntil || undefined, isDefault: form.isDefault,
        items: [{ itemId: form.itemId, minimumQuantity: form.minimumQuantity, unitPrice: form.unitPrice, maximumDiscountRate: form.maximumDiscountRate }]
      })
    }),
    onSuccess: async () => { setCreating(false); await client.invalidateQueries({ queryKey: ["price-lists"] }); }
  });
  if (lists.isLoading || items.isLoading) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Comercial" title="Listas de precios" action={<Button type="button" onClick={() => setCreating(true)}>Nueva lista</Button>} />
    <div className="operational-toolbar"><p>La resolución prioriza cliente, lista general y precio del producto.</p><Button type="button" onClick={() => setCreating(true)}>Nueva lista</Button></div>
    {creating ? <form className="operational-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="form-heading"><h2>Nueva lista de precios</h2></div><ErrorNotice error={create.error} />
      <div className="form-grid">
        <Field label="Código" required><TextInput required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
        <Field label="Nombre" required><TextInput required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Vigente desde"><TextInput type="date" value={form.validFrom} onChange={(event) => setForm({ ...form, validFrom: event.target.value })} /></Field>
        <Field label="Vigente hasta"><TextInput type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field>
        <Field label="Lista predeterminada"><label className="check-control"><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} /> Sí</label></Field>
        <Field label="Producto" required><select required className="input" value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}><option value="">Seleccione</option>
          {items.data?.data.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select></Field>
        <Field label="Cantidad mínima"><TextInput type="number" min="0.000001" step="0.000001" value={form.minimumQuantity} onChange={(event) => setForm({ ...form, minimumQuantity: event.target.value })} /></Field>
        <Field label="Precio"><TextInput type="number" min="0" step="0.000001" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} /></Field>
        <Field label="Descuento máximo"><TextInput type="number" min="0" max="1" step="0.000001" value={form.maximumDiscountRate} onChange={(event) => setForm({ ...form, maximumDiscountRate: event.target.value })} /></Field>
      </div><FormActions onCancel={() => setCreating(false)} submitLabel="Crear lista" pending={create.isPending} />
    </form> : null}
    <ResponsiveRecords rows={lists.data ?? []} columns={[
      { key: "list", label: "Lista", render: (list) => <><strong>{list.name}</strong><br /><code>{list.code}</code></> },
      { key: "currency", label: "Moneda", render: (list) => list.currency },
      { key: "items", label: "Ítems", render: (list) => list.itemCount },
      { key: "default", label: "Uso", render: (list) => list.isDefault ? "Predeterminada" : "Opcional" },
      { key: "status", label: "Estado", render: (list) => <StatusBadge status={list.status} /> }
    ]} mobile={(list) => <><strong>{list.name}</strong><code>{list.code}</code><span>{list.itemCount} ítems · {list.currency}</span><StatusBadge status={list.status} /></>} />
  </div>;
}
