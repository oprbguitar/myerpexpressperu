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
