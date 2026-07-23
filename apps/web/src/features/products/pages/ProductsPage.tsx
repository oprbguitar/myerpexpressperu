import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api";
import { Button, Field, LoadingState, PageHeader, TextInput } from "../../../components/Ui";
import { ErrorNotice, FormActions, money, ResponsiveRecords, StatusBadge } from "../../shared/OperationalUi";

interface Item {
  id: string; code: string; name: string; description?: string; itemType: string; purchasePrice: string;
  salePrice: string; currency: string; managesStock: boolean; minimumStock: string; status: string;
  version: number; category?: string; unit?: string; taxCategory: string; barcode?: string; stock: string;
}
interface Catalogs {
  categories: Array<{ id: string; code: string; name: string }>;
  units: Array<{ id: string; code: string; name: string }>;
  taxProfiles: Array<{ id: string; code: string; name: string; taxCategory: string; rate?: string }>;
}
const initial = {
  code: "", name: "", description: "", itemType: "PRODUCT", categoryId: "", unitId: "",
  taxProfileId: "", purchasePrice: "0.00", salePrice: "0.00", currency: "PEN",
  managesStock: true, minimumStock: "0", barcode: ""
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initial);
  const items = useQuery({
    queryKey: ["items", search],
    queryFn: () => api<{ data: Item[] }>(`/items?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`)
  });
  const catalogs = useQuery({ queryKey: ["item-catalogs"], queryFn: () => api<Catalogs>("/item-categories") });
  const create = useMutation({
    mutationFn: () => api("/items", {
      method: "POST", body: JSON.stringify({
        ...form, categoryId: form.categoryId || undefined, unitId: form.unitId || undefined,
        barcode: form.barcode || undefined,
        managesStock: form.itemType === "SERVICE" ? false : form.managesStock
      })
    }),
    onSuccess: async () => {
      setCreating(false); setForm(initial);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    }
  });
  if (items.isLoading || catalogs.isLoading) return <LoadingState />;
  const data = catalogs.data;
  return <div className="standard-page">
    <PageHeader eyebrow="Comercial" title="Productos y servicios" action={<Button type="button" onClick={() => setCreating(true)}>Nuevo ítem</Button>} />
    <div className="operational-toolbar">
      <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código o nombre…" />
      <Button type="button" onClick={() => setCreating(true)}>Nuevo</Button>
    </div>
    {creating ? <form className="operational-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="form-heading"><h2>Nuevo producto o servicio</h2></div>
      <ErrorNotice error={create.error} />
      <div className="form-grid">
        <Field label="Tipo" required><select className="input" value={form.itemType} onChange={(event) => setForm({
          ...form, itemType: event.target.value, managesStock: event.target.value === "SERVICE" ? false : form.managesStock
        })}>
          <option value="PRODUCT">Producto</option><option value="SERVICE">Servicio</option><option value="CONSUMABLE">Consumible</option>
        </select></Field>
        <Field label="Código" required><TextInput required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
        <Field label="Nombre" required><TextInput required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Descripción"><TextInput value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <Field label="Categoría"><select className="input" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">Sin categoría</option>{data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></Field>
        <Field label="Unidad" required><select required className="input" value={form.unitId} onChange={(event) => setForm({ ...form, unitId: event.target.value })}>
          <option value="">Seleccione</option>{data?.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}
        </select></Field>
        <Field label="Impuesto" required><select required className="input" value={form.taxProfileId} onChange={(event) => setForm({ ...form, taxProfileId: event.target.value })}>
          <option value="">Seleccione</option>{data?.taxProfiles.map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}
        </select></Field>
        <Field label="Costo de compra"><TextInput type="number" min="0" step="0.000001" inputMode="decimal" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })} /></Field>
        <Field label="Precio de venta"><TextInput type="number" min="0" step="0.000001" inputMode="decimal" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} /></Field>
        <Field label="Código de barras"><TextInput value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} /></Field>
        {form.itemType !== "SERVICE" ? <>
          <Field label="Administrar stock"><label className="check-control"><input type="checkbox" checked={form.managesStock} onChange={(event) => setForm({ ...form, managesStock: event.target.checked })} /> Sí</label></Field>
          <Field label="Stock mínimo"><TextInput type="number" min="0" step="0.000001" inputMode="decimal" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /></Field>
        </> : null}
      </div>
      <FormActions onCancel={() => setCreating(false)} submitLabel="Crear ítem" pending={create.isPending} />
    </form> : null}
    <ErrorNotice error={items.error} />
    <ResponsiveRecords rows={items.data?.data ?? []} columns={[
      { key: "item", label: "Ítem", render: (item) => <><strong>{item.name}</strong><br /><code>{item.code}</code></> },
      { key: "type", label: "Tipo", render: (item) => item.itemType },
      { key: "price", label: "Precio", render: (item) => money(item.salePrice, item.currency) },
      { key: "stock", label: "Stock", render: (item) => item.managesStock ? `${item.stock} ${item.unit ?? ""}` : "No aplica" },
      { key: "status", label: "Estado", render: (item) => <StatusBadge status={item.status} /> }
    ]} mobile={(item) => <><strong>{item.name}</strong><code>{item.code}</code><span>{money(item.salePrice, item.currency)}</span><small>{item.managesStock ? `Stock: ${item.stock}` : "Servicio sin stock"}</small><StatusBadge status={item.status} /></>} />
  </div>;
}
