import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api";
import { useAuth } from "../../../auth";
import { Button, Field, LoadingState, PageHeader, TextInput } from "../../../components/Ui";
import { deleteScopedDraft, getScopedDraft, saveScopedDraft } from "../../../drafts";
import { ErrorNotice, FormActions, ResponsiveRecords, StatusBadge } from "../../shared/OperationalUi";

type Role = "CUSTOMER" | "SUPPLIER";
interface Party {
  id: string; partyType: string; documentType?: string; documentNumber?: string;
  legalName?: string; commercialName?: string; firstName?: string; lastName?: string;
  email?: string; phone?: string; status: string; roles: string[];
}
interface PartyForm {
  partyType: "LEGAL_ENTITY" | "NATURAL_PERSON"; documentType: "RUC" | "DNI" | "FOREIGN" | "NONE";
  documentNumber: string; legalName: string; commercialName: string; firstName: string;
  lastName: string; email: string; phone: string;
}
const initial: PartyForm = {
  partyType: "LEGAL_ENTITY", documentType: "RUC", documentNumber: "", legalName: "",
  commercialName: "", firstName: "", lastName: "", email: "", phone: ""
};

export default function PartiesPage({ role = "CUSTOMER" }: { role?: Role }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PartyForm>(initial);
  const list = useQuery({
    queryKey: ["parties", role, search],
    queryFn: () => api<{ data: Party[] }>(`/${role === "CUSTOMER" ? "customers" : "suppliers"}?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`)
  });
  useEffect(() => {
    if (!user || !creating) return;
    void getScopedDraft<PartyForm>(user.userId, user.companyId, `party-${role.toLowerCase()}`).then((draft) => {
      if (draft) setForm(draft.value);
    });
  }, [creating, role, user]);
  useEffect(() => {
    if (!user || !creating) return;
    const timer = window.setTimeout(() => void saveScopedDraft({
      userId: user.userId, companyId: user.companyId, type: `party-${role.toLowerCase()}`,
      draftId: "new", value: form
    }), 350);
    return () => window.clearTimeout(timer);
  }, [creating, form, role, user]);
  const create = useMutation({
    mutationFn: () => api("/parties", {
      method: "POST", body: JSON.stringify({
        ...form, documentNumber: form.documentNumber || undefined,
        legalName: form.legalName || undefined, commercialName: form.commercialName || undefined,
        firstName: form.firstName || undefined, lastName: form.lastName || undefined,
        email: form.email || undefined, phone: form.phone || undefined, roles: [role]
      })
    }),
    onSuccess: async () => {
      if (user) await deleteScopedDraft(user.userId, user.companyId, `party-${role.toLowerCase()}`);
      setForm(initial); setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["parties"] });
    }
  });
  const name = (party: Party) => party.legalName || [party.firstName, party.lastName].filter(Boolean).join(" ") || party.commercialName || "Sin nombre";
  if (list.isLoading) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Comercial" title={role === "CUSTOMER" ? "Clientes" : "Proveedores"} action={
      <Button type="button" onClick={() => setCreating(true)}>Nuevo {role === "CUSTOMER" ? "cliente" : "proveedor"}</Button>
    } />
    <div className="operational-toolbar">
      <TextInput value={search} onChange={(event) => setSearch(event.target.value)}
        placeholder={`Buscar ${role === "CUSTOMER" ? "cliente" : "proveedor"}…`} aria-label="Buscar" />
      <Button type="button" onClick={() => setCreating(true)}>Nuevo</Button>
    </div>
    {creating ? <form className="operational-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="form-heading"><div><h2>Nuevo {role === "CUSTOMER" ? "cliente" : "proveedor"}</h2>
        <p>El borrador se conserva localmente para este usuario y empresa.</p></div></div>
      <ErrorNotice error={create.error} />
      <div className="form-grid">
        <Field label="Tipo" required><select className="input" value={form.partyType} onChange={(event) => setForm({ ...form, partyType: event.target.value as PartyForm["partyType"] })}>
          <option value="LEGAL_ENTITY">Persona jurídica</option><option value="NATURAL_PERSON">Persona natural</option>
        </select></Field>
        <Field label="Documento"><select className="input" value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value as PartyForm["documentType"] })}>
          <option value="RUC">RUC</option><option value="DNI">DNI</option><option value="FOREIGN">Documento extranjero</option><option value="NONE">Sin documento</option>
        </select></Field>
        <Field label="Número"><TextInput value={form.documentNumber} inputMode="numeric" onChange={(event) => setForm({ ...form, documentNumber: event.target.value })} /></Field>
        {form.partyType === "LEGAL_ENTITY" ? <>
          <Field label="Razón social" required><TextInput required value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></Field>
          <Field label="Nombre comercial"><TextInput value={form.commercialName} onChange={(event) => setForm({ ...form, commercialName: event.target.value })} /></Field>
        </> : <>
          <Field label="Nombres" required><TextInput value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></Field>
          <Field label="Apellidos"><TextInput value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></Field>
        </>}
        <Field label="Correo"><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Teléfono"><TextInput type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
      </div>
      <FormActions pending={create.isPending} submitLabel="Crear registro" onCancel={() => setCreating(false)} />
    </form> : null}
    <ErrorNotice error={list.error} />
    <ResponsiveRecords rows={list.data?.data ?? []} columns={[
      { key: "name", label: "Nombre", render: (party) => <strong>{name(party)}</strong> },
      { key: "document", label: "Documento", render: (party) => <>{party.documentType ?? "—"} {party.documentNumber ?? ""}</> },
      { key: "contact", label: "Contacto", render: (party) => <>{party.email || party.phone || "—"}</> },
      { key: "status", label: "Estado", render: (party) => <StatusBadge status={party.status} /> }
    ]} mobile={(party) => <><strong>{name(party)}</strong><span>{party.documentType} {party.documentNumber}</span><small>{party.email || party.phone}</small><StatusBadge status={party.status} /></>}
      emptyTitle={`Sin ${role === "CUSTOMER" ? "clientes" : "proveedores"}`}
      emptyDescription="Cree el primer registro para iniciar operaciones." />
  </div>;
}
