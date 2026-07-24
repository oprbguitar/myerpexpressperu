# S0 — Línea base y diagnóstico de acceso local

- **Fecha:** 2026-07-23
- **Rama/etiqueta base:** `stabilization-baseline-20260723`
- **Commit:** `7cef41c`
- **Informe previo archivado:** `docs/reports/archive/SYSTEM-STATE-REPORT-pre-stabilization-20260723.md`
- **Entorno:** Windows 11 Pro 26200, Node 24.14.0, pnpm 10.31.0, PostgreSQL 17 (Docker), infraestructura levantada

## Preservación de estado

- Árbol de trabajo limpio al iniciar (`git status` sin cambios).
- Etiqueta de línea base creada. **No se hizo push** (sin autorización).
- Informe de estado previo copiado al archivo histórico; no se sobrescribió.

## Reproducción de la suite

Ejecutada con la infraestructura (PostgreSQL, MinIO, Mailpit) **en ejecución**.

| Comando | Salida | Duración | Pasadas | Fallidas | Omitidas |
| --- | --- | --- | --- | --- | --- |
| `pnpm lint` | 0 | 25 s | — | 0 | — |
| `pnpm typecheck` | 0 | 9 s | 7 proyectos | 0 | — |
| `pnpm test` (unit) | 0 | 12 s | 86 | 0 | 0 |
| `pnpm test:integration` | 0 | 4 s | 17 | 0 | 0 |
| `pnpm test:compliance` | 0 | 4 s | 15 | 0 | 0 |
| `pnpm test:e2e` | 0 | 48 s | **18** | 0 | **6** |
| `pnpm build` | 0 | 25 s | — | 0 | — |
| `pnpm audit --prod` | 0 | 1 s | sin vulnerabilidades | — | — |

**Las 6 pruebas e2e omitidas NO se cuentan como pasadas.** Son omisiones por
proyecto (flujo móvil solo en `mobile-chromium`; PDF y concurrencia solo en
`desktop-chromium`), documentadas en la revisión previa.

## Recordatorio de las condiciones de la línea base

Esta «verdura» es real **solo con la infraestructura levantada**. La verificación
independiente ya documentó que `pnpm test:integration` **sale 0 con 17 pruebas
omitidas** cuando falta `DATABASE_URL` (hallazgo C-4). Ese defecto sigue abierto y
se corrige en la etapa **S3**, no en S0.

## Diagnóstico de acceso local

Resultado resumido (detalle en `LOCALHOST-DIAGNOSIS.md`):

- **Causa del síntoma «5273 no muestra la app»: el servidor web no estaba
  corriendo.** El puerto 5273 estaba libre.
- Al arrancarlo, la app sirve 200, la pantalla de login renderiza en navegador
  real sin errores de consola, y la API responde.
- Se evaluó y **revirtió** un cambio especulativo en el service worker que
  introducía una regresión en la prueba del manifiesto PWA.

**Gate A (acceso local): PASS.**

## Estado tras S0

- Árbol de trabajo limpio (sin cambios de código; solo documentos nuevos).
- Ninguna de las etapas S1–S9 iniciada.
- Veredicto autoritativo intacto: `PHASE_4_NOT_READY`.

## Servicios locales verificados

| Servicio | URL | Estado |
| --- | --- | --- |
| Web | http://localhost:5273/ | Ejecutándose |
| API | http://localhost:3100/api/v1 | Ejecutándose |
| Salud API | http://localhost:3100/api/v1/health | 200 |
| Readiness API | http://localhost:3100/api/v1/health/readiness | 200 |
| OpenAPI/Swagger | http://localhost:3100/api/docs | 200 |
| Consola MinIO | http://localhost:9001/ | 200 |
| Mailpit | http://localhost:8025/ | 200 |

Login con el admin sembrado: **201 (correcto)**. Detalle sanitizado en
`docs/local/LOCAL-ACCESS-GUIDE.md`; credenciales locales en el archivo
gitignored `LOCAL-ACCESS-CREDENTIALS.local.md`.
