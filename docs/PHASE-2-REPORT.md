# Reporte profesional — Fase 2

Fecha de cierre técnico: 2026-07-23.

## Estado del repositorio

La línea base de Fase 1 fue verificada antes de modificar el proyecto. Instalación,
migración, semilla, pruebas unitarias, integración, E2E, TypeScript, ESLint, build
PWA, presupuesto de bundle y escaneo de secretos aprobaron. El detalle se conserva
en `docs/PHASE-2-BASELINE.md`.

No existe un repositorio Git configurado en esta carpeta. No se hizo push ni se
publicó un despliegue remoto.

Durante Fase 2 se corrigieron estos defectos detectados por pruebas:

- Se amplió el formato de permisos para códigos jerárquicos.
- Se añadieron reglas append-only faltantes a movimientos de stock y aplicaciones
  de pago, más protección contra eliminación física de pagos.
- Se añadieron índices para relaciones operativas de líneas, reversiones y
  movimientos vinculados.
- Se restauran los estados padre de venta, compra o gasto al revertir un pago.
- La acción primaria móvil de venta rápida dejó de estar oculta por estilos
  heredados.
- La carga documental ahora compara la firma real del archivo con el MIME
  declarado.

## Arquitectura

Se mantiene el monolito modular portable de Fase 1:

```text
React PWA
  -> NestJS HTTP API
    -> servicios de aplicación y dominio
      -> PostgreSQL transaccional
      -> almacenamiento S3 compatible (MinIO local)
      -> outbox transaccional y worker
```

Los límites principales son Party, Catalog/Pricing, Quotation, SalesOrder, Sale,
CommercialDocument, Purchase, Expense, Receivable, Payable, Payment, CashSession,
InventoryMovement, ImportJob y Notification.

La lógica decimal, impuestos, precios, transiciones, saldos, stock y cierre de caja
vive en dominio o servicios; React no decide totales, numeración ni estados finales.

Los adaptadores de facturación electrónica implementan el contrato
`ElectronicInvoicingProvider`:

- Manual: registra estados y adjuntos sin declarar conectividad directa.
- Mock: reproduce aceptación, observaciones, rechazo, timeout y falla temporal.
- Producción: no configurada y mostrada como no disponible.

Las confirmaciones y operaciones irreversibles usan claves de idempotencia con hash
de payload. Los eventos de dominio sensibles se preparan en `outbox_events` dentro
de la misma transacción.

## Base de datos

Migraciones añadidas:

- `0002_phase2_operations`: modelo comercial, compras, finanzas, caja, inventario,
  documentos, importaciones, outbox y notificaciones.
- `0003_phase2_permission_codes`: códigos jerárquicos de permiso.
- `0004_phase2_history_indexes`: historial inmutable e índices de claves externas
  operativas.
- `0005_phase2_append_only_triggers`: triggers append-only compatibles con
  inserciones idempotentes `ON CONFLICT`.
- `0006_phase2_remaining_history_triggers`: completa la misma protección para
  caja y eventos de documentos.

La base incluye restricciones de estado, importes no negativos, saldos aplicados,
una sesión abierta por usuario/cuenta, documentos de proveedor únicos, numeración
comercial única, stock transaccional y claves idempotentes únicas. Las tablas
tenant/company críticas tienen RLS y los servicios establecen el contexto en cada
transacción.

La semilla de desarrollo añade dos sedes, establecimientos, almacenes, monedas,
términos, impuestos, unidades, clientes, proveedores, productos, servicios, listas
de precios, stock inicial, cuentas de caja, series y operaciones de demostración.
No se insertan datos demo con `NODE_ENV=production`.

## Backend

Casos de uso disponibles:

- Alta, edición, roles y desactivación de partes comerciales.
- Productos, servicios, categorías, unidades, impuestos y listas de precios.
- Cotización, cambio de estado y conversión a pedido.
- Confirmación idempotente de pedido y venta directa.
- Numeración atómica y emisión de documento comercial.
- Cancelación controlada de venta, compra y gasto con reversión de stock/saldo
  cuando corresponde y bloqueo si existen pagos o documentos activos.
- Compra, gasto y documento de proveedor con control de duplicados.
- Cuentas por cobrar/pagar, pagos parciales/completos y reversión compensatoria.
- Apertura/cierre de caja con explicación obligatoria de diferencias.
- Recepción, salida, ajuste y transferencia transaccional de stock.
- Gestión SUNAT manual/mock, historia y adjuntos XML/PDF/CDR.
- CSV con plantilla, preview sin escrituras de negocio, errores por fila,
  ejecución revisada y exportación autorizada.
- Dashboard agregado, notificaciones y worker de outbox.
- PDF profesional y almacenado para cotización, pedido, venta, compra, estados de
  cuenta y cierre de caja.

La carga de documentos limita tamaño, normaliza nombre, calcula SHA-256, comprueba
firma PDF/XML/JPEG/PNG y entrega descargas firmadas de corta duración.

## Frontend

Pantallas entregadas:

- Resumen operativo con métricas reales.
- Clientes, proveedores, productos, servicios y precios.
- Cotizaciones, pedidos y venta rápida.
- Compras y captura rápida de gastos con cámara.
- Cuentas por cobrar, cuentas por pagar, pagos/cobros y caja.
- Inventario, movimientos, ajustes y transferencias.
- Documentos/SUNAT manual o mock.
- Importaciones, exportaciones y notificaciones.
- Administración completa de Fase 1.

Las rutas se cargan de forma diferida y el menú respeta permisos. En móvil se usan
listas responsivas, formularios de una columna, controles numéricos, captura de
cámara, acciones adheridas y menú lateral. No existe un segundo frontend móvil.

IndexedDB usa un esquema versionado y asocia borradores con usuario, empresa, tipo
y registro. Se guardan borradores para partes, cotizaciones, compras, gastos y
conteos de caja. Las confirmaciones, pagos, movimientos, cierres, SUNAT e
importaciones continúan siendo exclusivamente autoritativos en el servidor.

## Seguridad y accesibilidad

- Cookie de sesión HttpOnly; no se guardan tokens en localStorage.
- Permisos de Fase 1 reutilizados en controladores y navegación.
- Contexto tenant/company obligatorio en consultas sensibles.
- Motivos obligatorios para reversión/cancelación y diferencias de caja.
- Etiquetas de formularios, foco visible, teclado numérico para importes,
  reducción de movimiento y ausencia de overflow móvil comprobada.
- Escaneo de secretos sobre código y artefactos.

## Verificación

### Revisión de fidelidad visual

Se compararon `phase2-dashboard-concept.png` y
`phase2-quick-sale-mobile-concept.png` con capturas reales de la implementación.

- Se conserva la navegación azul marino, acento esmeralda, tarjetas blancas y
  jerarquía tipográfica del concepto.
- El dashboard mantiene cuatro métricas principales, alertas financieras, estado
  SUNAT, stock bajo y operaciones recientes.
- La implementación omite gráficas cuando no existe una serie temporal suficiente;
  no inventa tendencias para rellenar el concepto.
- La venta móvil mantiene selección clara, teclado numérico, controles grandes,
  formulario de una columna y acciones finales adheridas.
- El concepto mostraba un asistente de siete pasos y totales instantáneos. La
  implementación usa un formulario directo y la copia “Los totales se calculan al
  guardar en el servidor” para conservar la autoridad del backend.
- La copia “Nueva venta rápida / Precios y cantidades” del concepto se simplificó
  a “Nueva venta”; “Continuar” se convirtió en “Guardar venta”. No se añadió un
  total fiscal calculado en el navegador.

Capturas verificadas:

- `docs/design/phase2-dashboard-implementation.png`
- `docs/design/phase2-quick-sale-mobile-implementation.png`

Comandos de cierre:

```text
pnpm db:migrate
pnpm db:seed
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm check:bundle
pnpm check:secrets
```

La suite cubre dominio decimal, impuestos, precios, estados, stock, caja,
aislamiento, restricciones, historial append-only, índices, login/PWA, dashboard,
viewport móvil, generación/almacenamiento PDF y confirmación concurrente
idempotente.

Resultados finales:

| Control | Resultado |
| --- | --- |
| Pruebas unitarias | 17 aprobadas |
| Pruebas de integración | 7 aprobadas |
| Pruebas E2E | 12 aprobadas, 6 omisiones intencionales por proyecto |
| Viewports/motores | Chromium escritorio, Pixel 7 y WebKit escritorio |
| TypeScript | Aprobado |
| ESLint | Aprobado, cero advertencias |
| Build PWA de producción | Aprobado |
| Bundle principal | 86.2 KiB gzip; features operativas divididas por ruta |
| Escaneo de secretos | Aprobado |
| Consola del navegador | Sin errores; sólo mensajes informativos de Vite/React |

El proveedor SUNAT productivo queda deliberadamente fuera de esta fase. Un futuro
adaptador deberá implementar el contrato existente, aportar credenciales mediante
secretos externos y superar validación homologada antes de habilitarse.
