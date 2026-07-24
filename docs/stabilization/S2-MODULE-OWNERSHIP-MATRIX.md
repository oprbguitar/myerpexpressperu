# S2 — Matriz de propiedad de módulos

Cada controlador declara su módulo (`@OwnedByModule`) o su condición de core
(`@CoreEndpoint`). La verificación fail-closed comprueba que ninguno queda sin
declarar. Fecha: 2026-07-24.

## Controladores core (siempre disponibles)

`AppController`, `AuthController`, `AuditController`, `OrganizationController`,
`ModulesController`, `UsersController`, `RolesController`,
`NotificationsController`, `PdfController`.

## Controladores por módulo

| Controlador | Módulo | Notas |
| --- | --- | --- |
| DocumentsController | documents | |
| PartiesController | parties | |
| CatalogController | products | |
| DashboardController | dashboard | |
| FinanceController | payments | multi-módulo: receivables/payables/cash por método |
| ImportsController | imports | |
| InventoryController | inventory-basic | |
| SalesController | sales | |
| PurchasesController | purchases | |
| SunatController | sunat-basic | |
| Phase3AdminController | admin-control-plane | business-profiles por método |
| Phase3CrmController | crm | |
| Phase3ProjectsController | projects | time-and-expenses por método |
| Phase3PeopleController | human-resources | occupational-safety por método |
| Phase3AssetsController | assets | maintenance por método |
| GovernanceController | legal-compliance | |
| AiController | artificial-intelligence | |
| OcrController | ocr | |
| MapsController | maps | |
| ProviderManagementController | provider-management | |

## Recursos no-controlador (MODULE_RESOURCE_REGISTRY)

- Handlers de worker (9): receivables, payables, inventory-basic,
  commercial-documents, projects, occupational-safety, maintenance, ocr,
  provider-management.
- Rutas de frontend: /ventas (sales), /compras (purchases),
  /inventario (inventory-basic), /caja (cash), /sunat (sunat-basic),
  /documentos (documents).
- Widgets de dashboard: cash-balance (cash), sales-summary (sales).
