/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../../../api";
import { LoadingState, PageHeader } from "../../../components/Ui";
import { dateLabel, money, StatusBadge } from "../../shared/OperationalUi";

interface Dashboard {
  lastUpdatedAt: string;
  demonstrationData: boolean;
  metrics: {
    salesThisMonth: string; salesPreviousMonth: string; salesComparisonPercent: string | null;
    receivablesOutstanding: string; receivablesOverdue: string; payablesOutstanding: string;
    payablesUpcoming: string; cashBalance: string; openCashSessions: number;
    pendingDocuments: number; rejectedDocuments: number;
  };
  topItems: Array<{ itemId: string; name: string; quantity: string; total: string }>;
  lowStock: Array<{ itemId: string; code: string; name: string; warehouse: string; quantity: string; minimumStock: string }>;
  recentSales: Array<{ id: string; number?: string; date: string; total: string; status: string; party: string }>;
  recentExpenses: Array<{ id: string; date: string; description: string; total: string; status: string }>;
}

const cards = [
  { key: "salesThisMonth", label: "Ventas del mes", to: "/ventas" },
  { key: "receivablesOutstanding", label: "Por cobrar", to: "/cuentas-por-cobrar" },
  { key: "payablesOutstanding", label: "Por pagar", to: "/cuentas-por-pagar" },
  { key: "cashBalance", label: "Saldo de caja", to: "/caja" }
] as const;

export default function DashboardPage() {
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
  if (dashboard.isLoading) return <LoadingState label="Calculando indicadores…" />;
  if (!dashboard.data) return <div className="standard-page"><div className="page-error">No se pudo cargar el dashboard.</div></div>;
  const data = dashboard.data;
  return <div className="standard-page dashboard-page">
    <PageHeader eyebrow="Operación" title="Resumen operativo" action={
      <button className="button button-secondary" onClick={() => void dashboard.refetch()}>Actualizar</button>
    } />
    <div className="dashboard-meta">
      <span>Última actualización: {new Date(data.lastUpdatedAt).toLocaleString("es-PE")}</span>
      {data.demonstrationData ? <span className="demo-label">Datos de demostración</span> : null}
    </div>
    <section className="metric-rail" aria-label="Indicadores principales">
      {cards.map((card) => <article key={card.key} className="metric-card">
        <span>{card.label}</span><strong>{money(data.metrics[card.key])}</strong>
        {card.key === "salesThisMonth" ? <small>
          {data.metrics.salesComparisonPercent === null
            ? "Sin base comparable"
            : `${Number(data.metrics.salesComparisonPercent) >= 0 ? "↑" : "↓"} ${data.metrics.salesComparisonPercent}% vs. mes anterior`}
        </small> : null}
        <Link to={card.to}>Ver detalle</Link>
      </article>)}
    </section>
    <div className="dashboard-grid">
      <section className="dashboard-panel dashboard-primary">
        <div className="panel-title"><h2>Productos más vendidos</h2><Link to="/ventas">Ver ventas</Link></div>
        {data.topItems.length ? <ol className="ranked-list">{data.topItems.map((item) => <li key={item.itemId}>
          <span><strong>{item.name}</strong><small>{item.quantity} unidades</small></span>
          <b>{money(item.total)}</b>
        </li>)}</ol> : <p className="panel-empty">Aún no existen ventas suficientes para mostrar una tendencia real.</p>}
      </section>
      <section className="dashboard-panel">
        <div className="panel-title"><h2>Alertas financieras</h2><Link to="/cuentas-por-cobrar">Revisar</Link></div>
        <dl className="alert-summary">
          <div><dt>Por cobrar vencido</dt><dd>{money(data.metrics.receivablesOverdue)}</dd></div>
          <div><dt>Pagos próximos</dt><dd>{money(data.metrics.payablesUpcoming)}</dd></div>
          <div><dt>Sesiones abiertas</dt><dd>{data.metrics.openCashSessions}</dd></div>
        </dl>
      </section>
      <section className="dashboard-panel">
        <div className="panel-title"><h2>Estado SUNAT</h2><Link to="/sunat">Ver documentos</Link></div>
        <dl className="alert-summary">
          <div><dt>Pendientes</dt><dd>{data.metrics.pendingDocuments}</dd></div>
          <div><dt>Rechazados</dt><dd className={data.metrics.rejectedDocuments ? "danger-text" : ""}>{data.metrics.rejectedDocuments}</dd></div>
        </dl>
        <p className="panel-note">Flujo manual o de demostración. Sin conexión productiva directa.</p>
      </section>
      <section className="dashboard-panel dashboard-wide">
        <div className="panel-title"><h2>Productos con stock bajo</h2><Link to="/inventario">Ver inventario</Link></div>
        {data.lowStock.length ? <div className="compact-rows">{data.lowStock.map((item) => <div key={`${item.itemId}:${item.warehouse}`}>
          <span><strong>{item.name}</strong><small>{item.warehouse} · {item.code}</small></span>
          <b>{item.quantity} / mín. {item.minimumStock}</b>
        </div>)}</div> : <p className="panel-empty">No existen productos por debajo del mínimo.</p>}
      </section>
      <section className="dashboard-panel dashboard-wide">
        <div className="panel-title"><h2>Operaciones recientes</h2></div>
        <div className="compact-rows">{[
          ...data.recentSales.map((sale) => ({ id: sale.id, date: sale.date, title: sale.party, total: sale.total, status: sale.status, type: "Venta" })),
          ...data.recentExpenses.map((expense) => ({ id: expense.id, date: expense.date, title: expense.description, total: expense.total, status: expense.status, type: "Gasto" }))
        ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8).map((record) => <div key={`${record.type}:${record.id}`}>
          <span><strong>{record.title}</strong><small>{record.type} · {dateLabel(record.date)}</small></span>
          <span className="row-end"><b>{money(record.total)}</b><StatusBadge status={record.status} /></span>
        </div>)}</div>
      </section>
    </div>
  </div>;
}
