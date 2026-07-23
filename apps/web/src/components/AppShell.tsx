import { useEffect, useState, type PropsWithChildren } from "react";
import { NavLink, useLocation } from "react-router";
import { useAuth } from "../auth";
import { api } from "../api";
import { phase3RouteDefinitions } from "../features/phase3/routes";
import {
  Activity, AuditLog, Building2, ChevronDown, ChevronRight, FileText, Home, Landmark, Menu,
  PanelsTopLeft, ShieldCheck, Upload, UsersRound, Wifi, WifiOff, X
} from "./Icons";

const navigation = [
  { section: "Operación", items: [
    { to: "/", label: "Resumen", icon: Home, permission: "dashboard.read" },
    { to: "/notificaciones", label: "Notificaciones", icon: Activity, permission: "dashboard.read" }
  ] },
  { section: "Comercial", items: [
    { to: "/clientes", label: "Clientes", icon: UsersRound, permission: "parties.read" },
    { to: "/productos", label: "Productos", icon: PanelsTopLeft, permission: "products.read" },
    { to: "/precios", label: "Precios", icon: FileText, permission: "pricing.read" },
    { to: "/cotizaciones", label: "Cotizaciones", icon: FileText, permission: "quotations.read" },
    { to: "/pedidos-venta", label: "Pedidos", icon: FileText, permission: "sales-orders.read" },
    { to: "/ventas", label: "Ventas", icon: Landmark, permission: "sales.read" }
  ] },
  { section: "Compras", items: [
    { to: "/proveedores", label: "Proveedores", icon: UsersRound, permission: "parties.read" },
    { to: "/compras", label: "Compras", icon: Landmark, permission: "purchases.read" },
    { to: "/gastos", label: "Gastos", icon: FileText, permission: "expenses.read" }
  ] },
  { section: "Finanzas", items: [
    { to: "/cuentas-por-cobrar", label: "Por cobrar", icon: Landmark, permission: "receivables.read" },
    { to: "/cuentas-por-pagar", label: "Por pagar", icon: Landmark, permission: "payables.read" },
    { to: "/pagos", label: "Pagos y cobros", icon: Landmark, permission: "payments.read" },
    { to: "/caja", label: "Caja", icon: Landmark, permission: "cash.read" },
    { to: "/inventario", label: "Inventario", icon: PanelsTopLeft, permission: "inventory.read" },
    { to: "/sunat", label: "SUNAT básico", icon: FileText, permission: "sunat.read" },
    { to: "/importaciones", label: "Intercambio de datos", icon: Upload, permission: "imports.read" }
  ] },
  { section: "Administración", items: [
    { to: "/organizacion", label: "Organización", icon: Building2, permission: "organization.read" },
    { to: "/sedes", label: "Sedes", icon: Building2, permission: "branches.read" },
    { to: "/usuarios", label: "Usuarios", icon: UsersRound, permission: "users.read" },
    { to: "/roles", label: "Roles y permisos", icon: ShieldCheck, permission: "roles.read" },
    { to: "/modulos", label: "Módulos", icon: PanelsTopLeft, permission: "modules.read" },
    { to: "/documentos", label: "Archivos", icon: FileText, permission: "documents.read" },
    { to: "/auditoria", label: "Auditoría", icon: AuditLog, permission: "audit.read" }
  ] }
];

export function AppShell({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(() => window.navigator.onLine);
  const [enabledModules, setEnabledModules] = useState<ReadonlySet<string>>(new Set());
  const { logout, user } = useAuth();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    let active = true;
    void api<Array<{ code: string; status: string }>>("/modules")
      .then((modules) => {
        if (active) setEnabledModules(new Set(modules.filter((module) => module.status === "enabled").map((module) => module.code)));
      })
      .catch(() => {
        if (active) setEnabledModules(new Set());
      });
    return () => { active = false; };
  }, [user?.userId]);
  return (
    <div className="app-layout">
      <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Navegación principal">
        <div className="brand"><span className="brand-mark" aria-hidden="true" />ERP Express Perú</div>
        <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X /></button>
        <nav>
          {navigation.map((group) => {
            const items = group.items.filter((item) => user?.permissions.includes(item.permission));
            return items.length ? <section className="nav-group" key={group.section}>
              <h2>{group.section}</h2>
              {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"}>
                <Icon aria-hidden="true" /><span>{label}</span><ChevronRight className="nav-chevron" />
              </NavLink>)}
            </section> : null;
          })}
          {["Relaciones", "Operación", "Personas", "Automatización", "Gobierno", "Administración"].map((section) => {
            const items = phase3RouteDefinitions.filter((item) =>
              item.section === section &&
              user?.permissions.includes(item.permission) &&
              enabledModules.has(item.module)
            );
            return items.length ? <section className="nav-group" key={`phase3-${section}`}>
              <h2>{section}</h2>
              {items.map(({ path, label }) => <NavLink key={path} to={path}>
                <PanelsTopLeft aria-hidden="true" /><span>{label}</span><ChevronRight className="nav-chevron" />
              </NavLink>)}
            </section> : null;
          })}
        </nav>
        <div className="sidebar-foot">Fase 3 · Operación inteligente</div>
      </aside>
      {open ? <button className="scrim" aria-label="Cerrar menú" onClick={() => setOpen(false)} /> : null}
      <div className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <div className="mobile-brand">ERP Express Perú</div>
          <div className="top-context">
            <button className="context-selector"><Building2 />Comercial Andina S.A.C.<ChevronDown /></button>
            <button className="context-selector branch-selector">Sede principal<ChevronDown /></button>
          </div>
          <div className={`connection ${online ? "online" : "offline"}`}>
            {online ? <Wifi /> : <WifiOff />}<span>{online ? "En línea" : "Sin conexión"}</span>
          </div>
          <details className="user-menu">
            <summary><span className="avatar">AD</span><span>Administrador</span><ChevronDown /></summary>
            <button onClick={() => void logout()}>Cerrar sesión</button>
          </details>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
