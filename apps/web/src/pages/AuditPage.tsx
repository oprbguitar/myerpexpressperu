import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { LoadingState, PageHeader } from "../components/Ui";

interface AuditResult {
  data: Array<{ id: string; action: string; entityType: string; requestId: string; occurredAt: string }>;
  meta: { page: number; pageSize: number; total: number };
}
export default function AuditPage() {
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => api<AuditResult>("/audit?pageSize=25") });
  if (audit.isLoading) return <LoadingState />;
  return (
    <div className="standard-page">
      <PageHeader eyebrow="Seguridad / Auditoría" title="Registro de auditoría" />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Fecha y hora</th><th>Acción</th><th>Entidad</th><th>Solicitud</th></tr></thead>
          <tbody>{audit.data?.data.map((event) => (
            <tr key={event.id}>
              <td>{new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "medium" }).format(new Date(event.occurredAt))}</td>
              <td><code>{event.action}</code></td><td>{event.entityType}</td><td><code>{event.requestId.slice(0, 8)}</code></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mobile-data-list">{audit.data?.data.map((event) => (
        <article key={event.id}><strong>{event.action}</strong><span>{event.entityType}</span><small>{new Date(event.occurredAt).toLocaleString("es-PE")}</small></article>
      ))}</div>
    </div>
  );
}
