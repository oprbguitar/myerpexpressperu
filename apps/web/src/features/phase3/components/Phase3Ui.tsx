/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { apiIdempotent } from "../../../api";
import { Button, EmptyState, LoadingState } from "../../../components/Ui";
import type { ResourceState } from "../usePhase3Resource";

type UnknownRecord = Record<string, unknown>;

function asRows(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is UnknownRecord => !!item && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];
  const candidate = Object.values(payload).find(Array.isArray);
  return Array.isArray(candidate)
    ? candidate.filter((item): item is UnknownRecord => !!item && typeof item === "object")
    : [];
}

function labelFor(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function textFor(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return value.toString();
  if (typeof value === "symbol") return value.description ?? "—";
  if (typeof value === "object") return "Detalle protegido";
  return "—";
}

export function Phase3Header({
  context,
  title,
  description,
  action
}: {
  context: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="p3-page-header">
      <div>
        <span>{context}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function ResourcePanel<T>({
  title,
  state,
  empty,
  columns,
  reload
}: {
  title: string;
  state: ResourceState<T>;
  empty: string;
  columns?: string[];
  reload(): void;
}) {
  if (state.status === "loading") return <section className="p3-panel"><h2>{title}</h2><LoadingState label="Consultando…" /></section>;
  if (state.status === "error") {
    return (
      <section className="p3-panel">
        <h2>{title}</h2>
        <div className="p3-error" role="alert"><p>{state.error}</p><Button variant="secondary" onClick={reload}>Reintentar</Button></div>
      </section>
    );
  }
  const rows = asRows(state.data);
  if (!rows.length) return <section className="p3-panel"><h2>{title}</h2><EmptyState title="Sin registros" description={empty} /></section>;
  const fields = columns ?? Object.keys(rows[0] ?? {}).filter((key) => !/(id|tenant|company|secret|token|prompt)/i.test(key)).slice(0, 5);
  return (
    <section className="p3-panel">
      <div className="p3-panel-title"><h2>{title}</h2><span>{rows.length} registros visibles</span></div>
      <div className="p3-table-wrap">
        <table>
          <thead><tr>{fields.map((field) => <th key={field}>{labelFor(field)}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={typeof row.id === "string" ? row.id : index}>
              {fields.map((field) => <td key={field}>{textFor(row[field])}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="p3-mobile-records">{rows.map((row, index) => (
        <article key={typeof row.id === "string" ? row.id : index}>
          {fields.map((field) => <div key={field}><span>{labelFor(field)}</span><strong>{textFor(row[field])}</strong></div>)}
        </article>
      ))}</div>
    </section>
  );
}

export function Tabs({
  items,
  active,
  onChange
}: {
  items: ReadonlyArray<{ id: string; label: string }>;
  active: string;
  onChange(value: string): void;
}) {
  return (
    <div className="p3-tabs" role="tablist" aria-label="Secciones">
      {items.map((item) => (
        <button key={item.id} role="tab" aria-selected={active === item.id} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function QuickCreate({
  title,
  endpoint,
  fields,
  onCreated
}: {
  title: string;
  endpoint: string;
  fields: Array<{ name: string; label: string; type?: string; required?: boolean }>;
  onCreated(): void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(fields.flatMap((field) => {
      const value = form.get(field.name);
      return value === null || value === "" ? [] : [[field.name, value]];
    }));
    try {
      await apiIdempotent(endpoint, `phase3:${endpoint}`, body);
      setStatus("success");
      setMessage("Registro creado.");
      event.currentTarget.reset();
      onCreated();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear el registro.");
    }
  }
  return (
    <section className="p3-quick-create">
      <Button variant="primary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? "Cerrar formulario" : title}
      </Button>
      {open ? (
        <form onSubmit={(event) => void submit(event)}>
          {fields.map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              <input name={field.name} type={field.type ?? "text"} required={field.required} />
            </label>
          ))}
          {status === "error" ? <p className="p3-error" role="alert">{message}</p> : null}
          {status === "success" ? <p className="p3-success" role="status">{message}</p> : null}
          <Button type="submit" disabled={status === "saving"}>{status === "saving" ? "Guardando…" : "Guardar"}</Button>
        </form>
      ) : null}
    </section>
  );
}
