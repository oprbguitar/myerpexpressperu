/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import type { ReactNode } from "react";
import { ApiError } from "../../api";
import { EmptyState } from "../../components/Ui";

export function money(value: string | number | null | undefined, currency = "PEN"): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(Number(value ?? 0));
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value));
}

export function StatusBadge({ status }: { status: string }) {
  const positive = ["active", "PAID", "ACCEPTED", "CONFIRMED", "COMPLETED", "POSTED", "CLOSED"].includes(status);
  const danger = ["REJECTED", "OVERDUE", "FAILED", "CANCELLED"].some((value) => status.includes(value));
  return <span className={`status ${positive ? "status-success" : ""} ${danger ? "status-danger" : ""}`}>{statusLabel(status)}</span>;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Activo", inactive: "Inactivo", DRAFT: "Borrador", SENT: "Enviada",
    ACCEPTED: "Aceptado", ACCEPTED_WITH_OBSERVATIONS: "Aceptado con observaciones",
    REJECTED: "Rechazado", EXPIRED: "Vencida", CONVERTED: "Convertida",
    CANCELLED: "Cancelado", CONFIRMED: "Confirmado", PARTIALLY_FULFILLED: "Atención parcial",
    FULFILLED: "Atendido", PARTIALLY_PAID: "Pago parcial", PAID: "Pagado",
    OPEN: "Abierto", OVERDUE: "Vencido", REGISTERED: "Registrado", ISSUED: "Emitido",
    PENDING_SUBMISSION: "Pendiente de envío", FAILED: "Fallido", VOID_PENDING: "Anulación pendiente",
    VOIDED: "Anulado", CANCELLED_INTERNAL: "Cancelado internamente", POSTED: "Aplicado",
    REVERSED: "Revertido", CLOSED: "Cerrada", COMPLETED: "Completado", PREVIEWED: "Previsualizado"
  };
  return labels[status] ?? status;
}

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError || error instanceof Error ? error.message : "No se pudo completar la operación.";
  return <div className="form-alert" role="alert">{message}</div>;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="operational-toolbar">{children}</div>;
}

export function ResponsiveRecords<T>({
  rows, columns, mobile, emptyTitle = "Sin registros", emptyDescription = "Los registros aparecerán aquí."
}: {
  rows: readonly T[];
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  mobile: (row: T) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <>
    <div className="table-wrap operational-table"><table><thead><tr>
      {columns.map((column) => <th key={column.key}>{column.label}</th>)}
    </tr></thead><tbody>
      {rows.map((row, index) => <tr key={String((row as { id?: string }).id ?? index)}>
        {columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}
      </tr>)}
    </tbody></table></div>
    <div className="mobile-data-list operational-mobile-list">
      {rows.map((row, index) => <article key={String((row as { id?: string }).id ?? index)}>{mobile(row)}</article>)}
    </div>
  </>;
}

export function FormActions({ onCancel, submitLabel, pending }: {
  onCancel: () => void; submitLabel: string; pending?: boolean;
}) {
  return <div className="form-actions">
    <button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button>
    <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Procesando…" : submitLabel}</button>
  </div>;
}
