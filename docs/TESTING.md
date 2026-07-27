# Pruebas

`pnpm test` cubre objetos de valor, dinero decimal, impuestos, precios, permisos,
transiciones, saldos, stock y caja. `pnpm test:integration` verifica migraciones,
RLS, restricciones, historial append-only e índices cuando `DATABASE_URL` está
disponible. `pnpm test:e2e` comprueba login, PWA, dashboard real, navegación,
viewport móvil, PDF almacenado y confirmación concurrente idempotente en Chromium
escritorio/móvil y WebKit.

Antes de liberar: migrar una base limpia, sembrar, ejecutar flujos comerciales,
probar negación de permisos con un usuario restringido, cargar/descargar un
documento, generar un PDF y revisar auditoría, outbox y logs.

## Gestión de residuos

- `packages/domain/src/waste-management.test.ts`: normalización, cantidades,
  fecha futura, orden de fases y requisito de evidencia del dominio.
- `tests/integration/waste-management.test.ts`: tablas, RLS forzado, índices y
  restricciones del ciclo.
- `tests/integration/rls-isolation.test.ts`: aislamiento efectivo y denegación
  de escritura cruzada usando el rol `erp_app`.
- `tests/e2e/waste-management.spec.ts`: login, creación, avance, replay
  idempotente de excepción, conflicto concurrente, cierre bloqueado, responsive
  y rechazo sin sesión.
