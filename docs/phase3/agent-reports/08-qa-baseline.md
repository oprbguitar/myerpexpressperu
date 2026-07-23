# Agent 8 — QA and Adversarial Review: baseline Fases 1–2

Fecha de ejecución: 2026-07-23, aproximadamente 14:32–14:41 (America/Lima).

## Dictamen

La línea base funcional de Fases 1–2 está operativa: instalación reproducible con
lockfile, seis migraciones aplicadas, migración y semilla limpias verificadas en
una base temporal, lint, typecheck, 17 unitarias, 7 de integración, los tres
proyectos E2E, build, presupuesto de bundle y escaneo básico de secretos pasaron.
PostgreSQL, MinIO y Mailpit estaban saludables; API, OpenAPI y web respondieron
HTTP 200. No se detuvo ni reemplazó ningún servicio preexistente.

La línea base **no es liberable** todavía. `pnpm audit --prod` falla con 44
vulnerabilidades de dependencias de producción, incluidas 2 críticas y 21 altas.
Además, la cobertura está concentrada en dominio, el E2E no está aislado de la
base configurada y el escáner de secretos excluye artefactos `dist`.

## Entorno observado

- Windows/PowerShell; Node `v24.14.0`; pnpm `10.31.0`.
- Docker `29.6.2`; Docker Compose `v5.3.1`.
- PostgreSQL 17, MinIO y Mailpit llevaban aproximadamente dos horas activos y
  saludables mediante `docker compose ps`.
- Puertos preexistentes: API `0.0.0.0:3000` (`node ... dist/main.js`) y Vite
  `0.0.0.0:5173` (`vite --host 0.0.0.0`). También estaban activos 5432, 9000,
  9001, 8025 y 1025.
- `GET http://localhost:3000/api/v1/health`: HTTP 200, cuerpo con
  `status=ok` y `service=erp-api`.
- `GET http://localhost:3000/api/docs`: HTTP 200.
- `GET http://localhost:5173`: HTTP 200.
- No es un worktree Git: `git rev-parse --is-inside-work-tree` falla con
  `not a git repository`.

## Comandos y resultados

| Comando exacto | Resultado | Tiempo aproximado |
|---|---:|---:|
| `pnpm install --frozen-lockfile` | PASS; lockfile vigente, dependencias ya instaladas | 1.4 s |
| `pnpm db:migrate` | PASS; sin migraciones pendientes | 1.3 s |
| `docker compose exec -T postgres psql -U erp -d erp_express -Atc "select version from schema_migrations order by version;"` | PASS; `0001`–`0006` presentes | <1 s |
| `pnpm lint` | PASS; cero warnings permitidos y cero reportados | 20.7 s |
| `pnpm typecheck` | PASS; 7 de 8 proyectos del workspace | 7.6 s |
| `pnpm test` | PASS; 17/17 pruebas en 2 archivos de `packages/domain` | 5.5 s |
| `pnpm test:integration` | PASS; 7/7 pruebas en 2 archivos | 2.7 s |
| `pnpm test:e2e` | Observación de harness; ver sección E2E | ~25 s por intento |
| `node --env-file=.env ./node_modules/@playwright/test/cli.js test --project=desktop-chromium --reporter=list` | PASS; 5 passed, 1 skipped intencional | 11.5 s |
| `node --env-file=.env ./node_modules/@playwright/test/cli.js test --project=mobile-chromium --reporter=list` | PASS; 4 passed, 2 skipped intencionales | 11.8 s |
| `node --env-file=.env ./node_modules/@playwright/test/cli.js test --project=webkit --reporter=list` | PASS; 3 passed, 3 skipped intencionales | 9.2 s |
| `pnpm build` | PASS; 1,814 módulos web transformados; todos los paquetes compilaron | 21.8 s |
| `pnpm check:secrets` | PASS dentro de su alcance limitado | <1 s |
| `pnpm check:bundle` | PASS; mayor chunk propio `index`: 273.1 KiB raw / 86.2 KiB gzip | <1 s |
| `pnpm audit --prod` | **FAIL**; 44 vulnerabilidades: 2 críticas, 21 altas, 19 moderadas, 2 bajas | 1.3 s |
| `docker compose logs --tail=30 postgres minio mailpit` | Servicios activos; hallazgos históricos y warning de versión, detallados abajo | <1 s |

## Migración y semilla limpias

No se ejecutó `pnpm db:seed` contra `erp_express`: el seed actualiza la
contraseña del administrador, fuerza cambio de contraseña y revoca sesiones
activas, por lo que no era seguro aplicarlo a una base compartida mientras los
servicios del usuario estaban en uso.

Se verificó en una base temporal aislada, sin reutilizar datos del usuario:

1. Se creó `erp_phase3_qa_20260723_1440` tras confirmar que no existía.
2. Se redirigió `DATABASE_URL` solo en el proceso QA.
3. `pnpm db:migrate` aplicó `0001` a `0006`.
4. `pnpm db:seed` terminó con exit 0.
5. Postcondiciones: 6 migraciones, 1 tenant, 1 compañía, 1 usuario, 3 items y
   1 movimiento de stock.
6. Se confirmó el nombre exacto y se eliminó únicamente esa base temporal.

Un primer sondeo temporal también migró y sembró correctamente, pero la consulta
de evidencia usó por error `products` en vez de la tabla real `items`; el error
fue del sondeo QA, no del producto. Esa base temporal también fue eliminada.

## Resultados E2E

La cobertura efectiva fue **12 passed / 6 skipped intencionales**:

- Desktop Chromium: login, PWA, dashboard/navegación, PDF y concurrencia/
  cancelación; se omite solo el caso exclusivo móvil.
- Mobile Chromium: login, PWA, dashboard/navegación y venta rápida sin overflow;
  PDF y concurrencia se omiten porque se ejecutan una sola vez en desktop.
- WebKit: login, PWA y dashboard/navegación; se omiten el caso exclusivo móvil y
  los dos casos de ejecución única desktop.

Dos invocaciones de la suite completa mostraron resultados hasta el segundo caso
WebKit, pero el PTY de esta ejecución cerró sin imprimir el resumen ni el marcador
de exit del wrapper. Las tres ejecuciones por proyecto terminaron limpiamente con
exit 0 y producen el total esperado de 12/6. Debe repetirse `pnpm test:e2e` fuera
del PTY de Codex antes del gate final para distinguir un problema de captura de
salida de uno del runner.

## Defectos y bloqueos

### QA-BASE-001 — Vulnerabilidades de producción (bloqueante de release)

`pnpm audit --prod` devuelve exit 1 y 44 vulnerabilidades: **2 críticas, 21
altas, 19 moderadas y 2 bajas**. Hallazgos representativos:

- `fast-xml-parser` transitivo de `@aws-sdk/client-s3`: bypass de encoding de
  entidades crítico, además de varios DoS; el audit indica versiones corregidas
  actuales desde `5.3.5`/`5.3.8` según advisory.
- `@fastify/middie` transitivo de `@nestjs/platform-fastify`: bypass de
  autenticación crítico; corregido desde `9.3.2`.
- `fastify@5.4.0`: bypass de validación de body por `Content-Type` (alto);
  corregido desde `5.7.2`, además de un advisory bajo corregido desde `5.7.3`.
- `react-router@7.7.1`: múltiples XSS/open redirect/CSRF; los advisories
  reportan correcciones posteriores, hasta `7.14.1`.
- `lodash` y `js-yaml` transitivos de `@nestjs/swagger`, y `uuid` transitivo del
  AWS SDK, también tienen advisories vigentes.

Acción: actualizar dependencias directas y lockfile con compatibilidad verificada,
repetir todas las suites y exigir `pnpm audit --prod` sin críticos/altos o una
excepción documentada y acotada por advisory.

### QA-BASE-002 — Cobertura unitaria insuficiente (bloqueante de aceptación Fase 3)

Solo `packages/domain` contiene pruebas unitarias ejecutadas: 17 casos. Web, API,
worker, database, security y contracts usan `--passWithNoTests`; por eso un
`pnpm test` verde no prueba esos paquetes. No existe medición ni umbral de
coverage. La integración tiene solo 7 casos.

Acción: agregar suites por módulo y por capa, negativos de permisos/RLS,
concurrencia, validadores, adapters, UI y worker; publicar cobertura y umbrales.

### QA-BASE-003 — E2E no aislado y posible código servido obsoleto

`global-setup.ts` modifica la base indicada por `.env`; desactiva
`force_password_change` y desbloquea el usuario semilla. Los casos crean/cancelan
ventas, almacenan PDF y actualizan una captura bajo `docs/design`. Además,
`reuseExistingServer: true` permite probar procesos preexistentes: no garantiza
que la API en 3000 corresponda al source/build recién validado.

Acción: base/tenant E2E efímeros, fixtures y cleanup verificable, buckets
aislados, y procesos de API/web arrancados desde el artefacto que se quiere
certificar.

### QA-BASE-004 — Escaneo de secretos incompleto

`scripts/check-secrets.mjs` excluye explícitamente toda carpeta `dist`. El PASS
actual no demuestra que el bundle o una imagen/paquete portable estén libres de
variables o secretos inyectados durante build.

Acción: escanear source **y** artefactos finales (`apps/*/dist`, paquete demo,
imágenes y manifiestos), con patrones adicionales de credenciales usadas por el
ERP.

### QA-BASE-005 — Sin trazabilidad Git

El directorio no tiene metadatos Git. No se puede asociar esta evidencia a un
commit inmutable, producir un diff fiable ni garantizar que futuras
verificaciones certifiquen el mismo source.

Acción: inicializar o vincular el repositorio cuando el usuario lo autorice y
registrar commit/checksum en el gate de release.

### QA-BASE-006 — Advertencias operativas

- El chequeo seguro de `.env` confirmó las variables requeridas sin imprimir
  valores, pero el valor local de `SEED_ADMIN_PASSWORD` coincide con el patrón
  textual de placeholder `change-me`. Es aceptable solo para desarrollo aislado;
  no debe reutilizarse en demo publicada ni producción.
- MinIO informa que la imagen fijada está por detrás de la última release.
- Los logs PostgreSQL conservan errores históricos de intentos previos: constraint
  de códigos de permiso y `ON CONFLICT` incompatible con rules de historial.
  No reaparecieron en la migración/semilla limpia actual; `0003` y `0005`
  corresponden a esas correcciones. Se deben rotar o marcar temporalmente los
  logs para que un gate no confunda eventos históricos con errores nuevos.

## Gate inicial recomendado

Estado: **FAIL para release / PASS funcional condicionado para comenzar Fase 3**.

Antes de declarar completa la Fase 3:

1. Cerrar `QA-BASE-001` y reauditar dependencias.
2. Aislar E2E y ampliar cobertura por módulos y superficies sensibles.
3. Escanear los artefactos finales, no solo source.
4. Ejecutar la suite completa desde una base limpia y desde upgrade `0001`–`0006`.
5. Repetir health, logs, bundle, audit y smoke del paquete portable con evidencia
   ligada a un commit o checksum.

