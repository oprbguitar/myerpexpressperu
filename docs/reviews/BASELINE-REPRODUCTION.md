# Reproducción de la línea base

- **Fecha:** 2026-07-23
- **Entorno:** Windows 11 Pro 26200, Node 24.14.0, pnpm 10.31.0, PostgreSQL 17 (Docker)
- **Commit de partida:** `cb2c0d8`

## Primera ejecución — con la infraestructura caída

Docker Desktop no estaba en ejecución al iniciar la revisión. Se registra tal
cual porque el resultado es en sí un hallazgo.

| Comando | Salida | Duración | Pasadas | Fallidas | Omitidas |
| --- | --- | --- | --- | --- | --- |
| `pnpm lint` | 0 | 28 s | — | — | — |
| `pnpm typecheck` | 0 | 8 s | 7 proyectos | 0 | — |
| `pnpm test` | 0 | 11 s | 86 | 0 | 0 |
| `pnpm test:integration` | **1** | 3 s | **0** | **10** | **7** |
| `pnpm test:compliance` | 0 | 3 s | 15 | 0 | 0 |
| `pnpm test:e2e` | **1** | 15 s | — | falla | — |
| `pnpm build` | 0 | 25 s | — | — | — |
| `pnpm audit --prod` | 0 | 1 s | sin vulnerabilidades | — | — |

Causa: `Error: connect ECONNREFUSED ::1:5432`.

Las 7 «omitidas» de integración no son omisiones intencionadas: son consecuencia
de que el hook `beforeAll` falló. Vitest marca así las pruebas de una suite cuyo
hook de preparación revienta.

## Hallazgo derivado — la suite de integración se autodesactiva

Ejecutada **sin** `DATABASE_URL`:

```text
Test Files  4 skipped (4)
      Tests 17 skipped (17)
EXIT_CODE=0
```

Las cuatro suites usan `describe.skipIf(!Boolean(process.env.DATABASE_URL))`.
Con la variable ausente, el comando **reporta éxito** sin ejecutar nada.
`phase3:verify` y `phase4:verify` lo invocan. No existe CI que lo detecte.

`tests/e2e/global-setup.ts:14-23` sí falla ruidosamente ante configuración
ausente. Las dos capas tienen semánticas opuestas ante el mismo problema.

## Segunda ejecución — infraestructura operativa

Tras `pnpm docker:up`, `pnpm db:migrate` y `pnpm db:seed`:

| Comando | Salida | Pasadas | Fallidas | Omitidas |
| --- | --- | --- | --- | --- |
| `pnpm test:integration` | 0 | 17 | 0 | 0 |
| `pnpm test:e2e` | 0 | **18** | 0 | **6** |
| `pnpm phase4:verify` | 0 | cadena completa | 0 | — |
| `pnpm demo:verify` | 0 | 34 archivos, 0 hallazgos | — | — |
| `pnpm license:scan` | 0 | 769 paquetes, 0 en revisión | — | — |
| `pnpm provenance:verify` | 0 | 6 registros válidos | — | — |
| `pnpm sbom:generate:project` | 0 | 709 componentes | — | — |

## Las 6 pruebas e2e omitidas

**No se cuentan como pasadas.** Son omisiones por proyecto dentro del cuerpo de
las especificaciones, no configuración deshabilitada.

| Prueba | Mecanismo | Omitida en | Riesgo |
| --- | --- | --- | --- |
| `flujo móvil no desborda y abre una venta rápida` | `test.skip(!project.includes("mobile"))` — `shell.spec.ts:47` | desktop-chromium, webkit | BAJO. Específica de viewport. Pero WebKit no tiene proyecto móvil, así que la ruta PWA móvil nunca se ejercita en Safari. |
| `genera y almacena un PDF operativo autorizado` | `test.skip(project !== "desktop-chromium")` — `shell.spec.ts:63` | mobile-chromium, webkit | **MEDIO-ALTO.** Es el único ejercicio de `/pdf/sale/:id`, de la autorización de descarga y del manejo de `content-type`. Nunca corre en WebKit, donde la descarga difiere más. |
| `confirmación concurrente es idempotente y la venta puede cancelarse` | `test.skip(project !== "desktop-chromium")` — `shell.spec.ts:78` | mobile-chromium, webkit | **MEDIO.** La justificación es defendible, pero la prueba no verifica concurrencia real: dos `fetch` desde un mismo contexto con la misma clave de idempotencia verifican deduplicación. |

`playwright.config.ts:11-12` fija `fullyParallel: false, workers: 1`, de modo que
ninguna prueba del repositorio genera paralelismo real.

## Artefactos generados

```text
dist/compliance/sbom.cdx.json      709 componentes, 659 con licencia
dist/compliance/licenses.json      769 paquetes
dist/demo/sbom.cdx.json            709 componentes
THIRD-PARTY-NOTICES.md             769 paquetes, 11 licencias
```

## Mutaciones del entorno durante la revisión

Se documentan por integridad:

1. Contraseña del administrador sembrado cambiada durante pruebas de API.
2. Módulos `dashboard`, `cash` y `crm` desactivados temporalmente.
3. Tenant B de prueba creado (falló por restricciones `NOT NULL`; sin efecto).
4. Base `erp_hdrcheck` creada y eliminada en una verificación previa.

La mutación 1 **rompió la suite e2e** (`global-setup.ts` autentica con
`SEED_ADMIN_PASSWORD`), produciendo una ejecución de 9 pasadas con fallos. Se
restauró con `pnpm db:reset` y la suite volvió a 18 pasadas y 6 omitidas.

Sin este registro, esa ejecución intermedia podría interpretarse erróneamente
como un defecto del producto.
