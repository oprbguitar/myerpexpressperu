/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { useAuth } from "./auth";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ModulesProvider, ModuleRoute } from "./features/shared/modules";
import { LoadingState } from "./components/Ui";
import { BranchesPage, DocumentsPage, RolesPage, UsersPage } from "./pages/SimplePages";
import { ChangePasswordPage, ResetRequestPage } from "./pages/PasswordPages";
import { phase3RouteDefinitions } from "./features/phase3/routes";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const CompanyPage = lazy(() => import("./pages/CompanyPage"));
const ModulesPage = lazy(() => import("./pages/ModulesPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const DashboardPage = lazy(() => import("./features/dashboard/pages/DashboardPage"));
const PartiesPage = lazy(() => import("./features/parties/pages/PartiesPage"));
const ProductsPage = lazy(() => import("./features/products/pages/ProductsPage"));
const PricingPage = lazy(() => import("./features/pricing/pages/PricingPage"));
const QuotationsPage = lazy(() => import("./features/sales/pages/CommercialPages").then((module) => ({ default: module.QuotationsPage })));
const SalesOrdersPage = lazy(() => import("./features/sales/pages/CommercialPages").then((module) => ({ default: module.SalesOrdersPage })));
const SalesPage = lazy(() => import("./features/sales/pages/CommercialPages").then((module) => ({ default: module.SalesPage })));
const PurchasesPage = lazy(() => import("./features/purchases/pages/PurchasePages").then((module) => ({ default: module.PurchasesPage })));
const ExpensesPage = lazy(() => import("./features/purchases/pages/PurchasePages").then((module) => ({ default: module.ExpensesPage })));
const AccountsPage = lazy(() => import("./features/finance/pages/FinancePages").then((module) => ({ default: module.AccountsPage })));
const PaymentsPage = lazy(() => import("./features/finance/pages/FinancePages").then((module) => ({ default: module.PaymentsPage })));
const CashPage = lazy(() => import("./features/finance/pages/FinancePages").then((module) => ({ default: module.CashPage })));
const InventoryPage = lazy(() => import("./features/inventory/pages/InventoryPage"));
const SunatPage = lazy(() => import("./features/sunat/pages/SunatPage"));
const DataExchangePage = lazy(() => import("./features/data-exchange/pages/DataExchangePage"));
const NotificationsPage = lazy(() => import("./features/notifications/pages/NotificationsPage"));
const phase3Routes = phase3RouteDefinitions.map((definition) => ({
  ...definition,
  Component: lazy(definition.load)
}));

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Verificando sesión…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.forcePasswordChange && location.pathname !== "/cambiar-clave") {
    return <Navigate to="/cambiar-clave" replace />;
  }
  return (
    <ModulesProvider>
      <AppShell>
        <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
      </AppShell>
    </ModulesProvider>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar-clave" element={<ResetRequestPage />} />
        <Route path="/cambiar-clave" element={<Protected><ChangePasswordPage /></Protected>} />
        <Route path="/" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/clientes" element={<Protected><PartiesPage role="CUSTOMER" /></Protected>} />
        <Route path="/proveedores" element={<Protected><PartiesPage role="SUPPLIER" /></Protected>} />
        <Route path="/productos" element={<Protected><ProductsPage /></Protected>} />
        <Route path="/precios" element={<Protected><PricingPage /></Protected>} />
        <Route path="/cotizaciones" element={<Protected><QuotationsPage /></Protected>} />
        <Route path="/pedidos-venta" element={<Protected><SalesOrdersPage /></Protected>} />
        <Route path="/ventas" element={<Protected><ModuleRoute module="sales"><SalesPage /></ModuleRoute></Protected>} />
        <Route path="/compras" element={<Protected><ModuleRoute module="purchases"><PurchasesPage /></ModuleRoute></Protected>} />
        <Route path="/gastos" element={<Protected><ExpensesPage /></Protected>} />
        <Route path="/cuentas-por-cobrar" element={<Protected><AccountsPage kind="receivables" /></Protected>} />
        <Route path="/cuentas-por-pagar" element={<Protected><AccountsPage kind="payables" /></Protected>} />
        <Route path="/pagos" element={<Protected><PaymentsPage /></Protected>} />
        <Route path="/caja" element={<Protected><ModuleRoute module="cash"><CashPage /></ModuleRoute></Protected>} />
        <Route path="/inventario" element={<Protected><ModuleRoute module="inventory-basic"><InventoryPage /></ModuleRoute></Protected>} />
        <Route path="/sunat" element={<Protected><ModuleRoute module="sunat-basic"><SunatPage /></ModuleRoute></Protected>} />
        <Route path="/importaciones" element={<Protected><DataExchangePage /></Protected>} />
        <Route path="/notificaciones" element={<Protected><NotificationsPage /></Protected>} />
        <Route path="/organizacion" element={<Protected><CompanyPage /></Protected>} />
        <Route path="/sedes" element={<Protected><BranchesPage /></Protected>} />
        <Route path="/usuarios" element={<Protected><UsersPage /></Protected>} />
        <Route path="/roles" element={<Protected><RolesPage /></Protected>} />
        <Route path="/modulos" element={<Protected><ModulesPage /></Protected>} />
        <Route path="/documentos" element={<Protected><DocumentsPage /></Protected>} />
        <Route path="/auditoria" element={<Protected><AuditPage /></Protected>} />
        {phase3Routes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Protected><Component /></Protected>} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
