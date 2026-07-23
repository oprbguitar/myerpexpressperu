import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api";
import { LoadingState, PageHeader } from "../../../components/Ui";
import { dateLabel, ResponsiveRecords, StatusBadge } from "../../shared/OperationalUi";

interface Notification {
  id: string; type: string; title: string; message: string; createdAt: string; readAt?: string;
}

export default function NotificationsPage() {
  const records = useQuery({ queryKey: ["notifications"], queryFn: () => api<Notification[]>("/notifications?limit=100") });
  if (records.isLoading) return <LoadingState />;
  return <div className="standard-page">
    <PageHeader eyebrow="Operación" title="Notificaciones" />
    <ResponsiveRecords rows={records.data ?? []} columns={[
      { key: "notification", label: "Notificación", render: (row) => <><strong>{row.title}</strong><br /><small>{row.message}</small></> },
      { key: "type", label: "Tipo", render: (row) => row.type },
      { key: "date", label: "Fecha", render: (row) => dateLabel(row.createdAt) },
      { key: "status", label: "Estado", render: (row) => <StatusBadge status={row.readAt ? "READ" : "OPEN"} /> }
    ]} mobile={(row) => <><strong>{row.title}</strong><span>{row.message}</span><small>{dateLabel(row.createdAt)}</small><StatusBadge status={row.readAt ? "READ" : "OPEN"} /></>} />
  </div>;
}
