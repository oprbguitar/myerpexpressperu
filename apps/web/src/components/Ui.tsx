/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div><div className="breadcrumb">{eyebrow}</div><h1>{title}</h1></div>
      {action}
    </div>
  );
}

export function Field({
  label, error, children, required
}: PropsWithChildren<{ label: string; error?: string | undefined; required?: boolean | undefined }>) {
  return (
    <label className="field">
      <span>{label}{required ? <em aria-hidden="true">*</em> : null}</span>
      {children}
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

export function Button({ variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return <button {...props} className={`button button-${variant} ${props.className ?? ""}`} />;
}

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" />{label}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><h2>{title}</h2><p>{description}</p></div>;
}
