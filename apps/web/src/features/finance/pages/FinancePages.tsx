import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiIdempotent } from "../../../api";
import { useAuth } from "../../../auth";
import { Button, Field, LoadingState, PageHeader, TextInput } from "../../../components/Ui";
import { deleteScopedDraft, getScopedDraft, saveScopedDraft } from "../../../drafts";
import { dateLabel, ErrorNotice, FormActions, money, ResponsiveRecords, StatusBadge } from "../../shared/OperationalUi";

interface Account {
  id: string; currency: string; principal: string; appliedAmount: string; outstandingAmount: string;
  dueDate: string; status: string; customerName?: string; supplierName?: string;
}
interface Payment {
  id: string; direction: string; paymentMethod: string; currency: string; amount: string;
  paymentDate: string; reference?: string; status: string; partyName?: string;
}
interface CashAccount { id: string; code: string; name: string; currency: string; accountType: string; status: string; balance: string; }
interface CashSession {
  id: string; cashAccountId: string; cashAccount: string; openedAt: string; openingBalance: string;
  expectedBalance?: string; countedBalance?: string; difference?: string; differenceReason?: string;
  status: string; movementTotal: string;
}

export function AccountsPage({ kind }: { kind: "receivables" | "payables" }) {
  const client = useQueryClient();
  const incoming = kind === "receivables";
  const [paying, setPaying] = useState<Account | null>(null);
  const [amount, setAmount] = useState("0.00");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const records = useQuery({ queryKey: [kind], queryFn: () => api<Account[]>(`/${kind}?limit=100`) });
  const pdf = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/pdf/${incoming ? "customer-statement" : "supplier-statement"}/${id}`, { method: "POST" }),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener,noreferrer")
  });
  const register = useMutation({
    mutationFn: () => apiIdempotent("/payments", "register-payment", {
      direction: incoming ? "INBOUND" : "OUTBOUND", paymentMethod: method, currency: paying?.currency ?? "PEN",
      amount, ...(incoming ? { receivableId: paying?.id } : { payableId: paying?.id }),
      reference: reference || undefined
    }),
    onSuccess: async () => {
      setPaying(null); setAmount("0.00"); setReference("");
      await Promise.all([
        client.invalidateQueries({ queryKey: [kind] }),
        client.invalidateQueries({ queryKey: ["payments"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });
  if (records.isLoading) return <LoadingState />;
  const party = (row: Account) => row.customerName || row.supplierName || "Sin identificar";
  return <div className="standard-page">
    <PageHeader eyebrow="Finanzas" title={incoming ? "Cuentas por cobrar" : "Cuentas por pagar"} />
    {paying ? <form className="operational-form compact-form" onSubmit={(event) => { event.preventDefault(); register.mutate(); }}>
      <div className="form-heading"><div><h2>{incoming ? "Registrar cobro" : "Registrar pago"}</h2><p>{party(paying)} · Saldo {money(paying.outstandingAmount, paying.currency)}</p></div></div>
      <ErrorNotice error={register.error} />
      <div className="form-grid">
        <Field label="Importe" required><TextInput required type="number" inputMode="decimal" min="0.01" max={paying.outstandingAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        <Field label="Medio"><select className="input" value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="BANK_TRANSFER">Transferencia bancaria</option><option value="CARD">Tarjeta</option>
          <option value="DIGITAL_WALLET">Billetera digital</option><option value="CHECK">Cheque</option><option value="OTHER">Otro</option>
        </select></Field>
        <Field label="Referencia"><TextInput value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
      </div>
      <FormActions pending={register.isPending} submitLabel={incoming ? "Registrar cobro" : "Registrar pago"} onCancel={() => setPaying(null)} />
    </form> : null}
    <ErrorNotice error={records.error || pdf.error} />
    <ResponsiveRecords rows={records.data ?? []} columns={[
      { key: "party", label: incoming ? "Cliente" : "Proveedor", render: (row) => <strong>{party(row)}</strong> },
      { key: "due", label: "Vencimiento", render: (row) => dateLabel(row.dueDate) },
      { key: "principal", label: "Original", render: (row) => money(row.principal, row.currency) },
      { key: "outstanding", label: "Saldo", render: (row) => <strong>{money(row.outstandingAmount, row.currency)}</strong> },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "action", label: "", render: (row) => <div className="inline-actions"><Button variant="secondary" onClick={() => pdf.mutate(row.id)}>PDF</Button>{!["PAID", "CANCELLED"].includes(row.status) ? <Button onClick={() => { setPaying(row); setAmount(row.outstandingAmount); }}>{incoming ? "Cobrar" : "Pagar"}</Button> : null}</div> }
    ]} mobile={(row) => <><strong>{party(row)}</strong><span className="record-total">{money(row.outstandingAmount, row.currency)}</span><small>Vence {dateLabel(row.dueDate)} · Original {money(row.principal, row.currency)}</small><StatusBadge status={row.status} /><div className="inline-actions"><Button variant="secondary" onClick={() => pdf.mutate(row.id)}>PDF</Button>{!["PAID", "CANCELLED"].includes(row.status) ? <Button onClick={() => { setPaying(row); setAmount(row.outstandingAmount); }}>{incoming ? "Registrar cobro" : "Registrar pago"}</Button> : null}</div></>} />
  </div>;
}

export function PaymentsPage() {
  const client = useQueryClient();
  const [reversing, setReversing] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const records = useQuery({ queryKey: ["payments"], queryFn: () => api<Payment[]>("/payments?limit=100") });
  const reverse = useMutation({
    mutationFn: () => apiIdempotent(`/payments/${reversing?.id}/reverse`, "reverse-payment", { reason }),
    onSuccess: async () => {
      setReversing(null); setReason("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["payments"] }),
        client.invalidateQueries({ queryKey: ["receivables"] }),
        client.invalidateQueries({ queryKey: ["payables"] })
      ]);
    }
  });
  if (records.isLoading) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Finanzas" title="Pagos y cobros" />
    {reversing ? <form className="operational-form compact-form" onSubmit={(event) => { event.preventDefault(); reverse.mutate(); }}>
      <div className="form-heading"><h2>Revertir movimiento</h2></div><ErrorNotice error={reverse.error} />
      <Field label="Motivo" required><TextInput required minLength={10} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      <FormActions pending={reverse.isPending} submitLabel="Confirmar reversión" onCancel={() => setReversing(null)} />
    </form> : null}
    <ResponsiveRecords rows={records.data ?? []} columns={[
      { key: "date", label: "Fecha", render: (row) => dateLabel(row.paymentDate) },
      { key: "party", label: "Tercero", render: (row) => row.partyName || "Sin aplicación" },
      { key: "direction", label: "Tipo", render: (row) => row.direction === "INBOUND" ? "Ingreso" : "Egreso" },
      { key: "method", label: "Medio", render: (row) => row.paymentMethod },
      { key: "amount", label: "Importe", render: (row) => money(row.amount, row.currency) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "action", label: "", render: (row) => row.status === "POSTED" ? <Button variant="secondary" onClick={() => setReversing(row)}>Revertir</Button> : null }
    ]} mobile={(row) => <><strong>{row.partyName || "Movimiento sin aplicación"}</strong><span>{money(row.amount, row.currency)}</span><small>{dateLabel(row.paymentDate)} · {row.paymentMethod}</small><StatusBadge status={row.status} />{row.status === "POSTED" ? <Button variant="secondary" onClick={() => setReversing(row)}>Revertir</Button> : null}</>} />
  </div>;
}

export function CashPage() {
  const client = useQueryClient();
  const { user } = useAuth();
  const [opening, setOpening] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [closing, setClosing] = useState<CashSession | null>(null);
  const [closeForm, setCloseForm] = useState({ countedBalance: "0.00", differenceReason: "" });
  const accounts = useQuery({ queryKey: ["cash-accounts"], queryFn: () => api<CashAccount[]>("/cash-accounts") });
  const sessions = useQuery({ queryKey: ["cash-sessions"], queryFn: () => api<CashSession[]>("/cash-sessions") });
  const pdf = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/pdf/cash-closure/${id}`, { method: "POST" }),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener,noreferrer")
  });
  useEffect(() => {
    if (!closing || !user) return;
    void getScopedDraft<typeof closeForm>(user.userId, user.companyId, `cash-close-${closing.id}`).then((draft) => {
      if (draft) setCloseForm(draft.value);
      else setCloseForm({ countedBalance: closing.expectedBalance ?? "0.00", differenceReason: "" });
    });
  }, [closing, user]);
  useEffect(() => {
    if (!closing || !user) return;
    const timer = window.setTimeout(() => void saveScopedDraft({
      userId: user.userId, companyId: user.companyId, type: `cash-close-${closing.id}`, draftId: "count", value: closeForm
    }), 350);
    return () => window.clearTimeout(timer);
  }, [closeForm, closing, user]);
  const open = useMutation({
    mutationFn: () => apiIdempotent("/cash-sessions", "open-cash-session", { cashAccountId: accountId, openingBalance }),
    onSuccess: async () => { setOpening(false); await client.invalidateQueries({ queryKey: ["cash-sessions"] }); }
  });
  const close = useMutation({
    mutationFn: () => apiIdempotent(`/cash-sessions/${closing?.id}/close`, "close-cash-session", {
      countedBalance: closeForm.countedBalance, differenceReason: closeForm.differenceReason || undefined
    }),
    onSuccess: async () => {
      if (closing && user) await deleteScopedDraft(user.userId, user.companyId, `cash-close-${closing.id}`);
      setClosing(null);
      await Promise.all([client.invalidateQueries({ queryKey: ["cash-sessions"] }), client.invalidateQueries({ queryKey: ["cash-accounts"] })]);
    }
  });
  if (accounts.isLoading || sessions.isLoading) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Finanzas" title="Caja" action={<Button onClick={() => setOpening(true)}>Abrir caja</Button>} />
    <section className="metric-rail compact-metrics">{accounts.data?.map((account) => <article className="metric-card" key={account.id}><span>{account.name}</span><strong>{money(account.balance, account.currency)}</strong><small>{account.code} · {account.accountType}</small></article>)}</section>
    {opening ? <form className="operational-form compact-form" onSubmit={(event) => { event.preventDefault(); open.mutate(); }}>
      <div className="form-heading"><h2>Abrir sesión de caja</h2></div><ErrorNotice error={open.error} />
      <div className="form-grid">
        <Field label="Cuenta" required><select required className="input" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Seleccione</option>{accounts.data?.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
        <Field label="Saldo inicial" required><TextInput required type="number" inputMode="decimal" min="0" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></Field>
      </div><FormActions pending={open.isPending} submitLabel="Abrir sesión" onCancel={() => setOpening(false)} />
    </form> : null}
    {closing ? <form className="operational-form compact-form cash-close-form" onSubmit={(event) => { event.preventDefault(); close.mutate(); }}>
      <div className="form-heading"><div><h2>Cierre de caja</h2><p>Esperado: {money(closing.expectedBalance ?? "0", "PEN")}</p></div></div><ErrorNotice error={close.error} />
      <div className="form-grid">
        <Field label="Efectivo contado" required><TextInput required type="number" inputMode="decimal" min="0" step="0.01" value={closeForm.countedBalance} onChange={(event) => setCloseForm({ ...closeForm, countedBalance: event.target.value })} /></Field>
        <Field label="Explicación de diferencia"><TextInput value={closeForm.differenceReason} onChange={(event) => setCloseForm({ ...closeForm, differenceReason: event.target.value })} /></Field>
      </div><FormActions pending={close.isPending} submitLabel="Confirmar cierre" onCancel={() => setClosing(null)} />
    </form> : null}
    <ErrorNotice error={accounts.error || sessions.error || pdf.error} />
    <ResponsiveRecords rows={sessions.data ?? []} columns={[
      { key: "account", label: "Cuenta", render: (row) => <strong>{row.cashAccount}</strong> },
      { key: "opened", label: "Apertura", render: (row) => dateLabel(row.openedAt) },
      { key: "opening", label: "Saldo inicial", render: (row) => money(row.openingBalance) },
      { key: "movement", label: "Movimientos", render: (row) => money(row.movementTotal) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
      { key: "action", label: "", render: (row) => <div className="inline-actions">{row.status === "CLOSED" ? <Button variant="secondary" onClick={() => pdf.mutate(row.id)}>PDF</Button> : null}{row.status === "OPEN" ? <Button onClick={() => setClosing(row)}>Cerrar caja</Button> : null}</div> }
    ]} mobile={(row) => <><strong>{row.cashAccount}</strong><span>Apertura {money(row.openingBalance)}</span><small>Movimientos {money(row.movementTotal)}</small><StatusBadge status={row.status} /><div className="inline-actions">{row.status === "CLOSED" ? <Button variant="secondary" onClick={() => pdf.mutate(row.id)}>PDF</Button> : null}{row.status === "OPEN" ? <Button onClick={() => setClosing(row)}>Cerrar caja</Button> : null}</div></>} />
  </div>;
}
