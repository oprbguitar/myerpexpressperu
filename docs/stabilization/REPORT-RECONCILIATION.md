# Reconciliación de SYSTEM-STATE-REPORT.md

- **Fecha:** 2026-07-24
- **Archivo previo:** `docs/reports/archive/SYSTEM-STATE-REPORT-before-report-s2-20260724-1033.md`
- **Método:** recálculo desde el repositorio y la base de datos viva; no se copiaron valores previos.

## Contradicciones encontradas y resueltas

| Métrica | Valores en conflicto | Valor verificado | Fuente / razón |
| --- | --- | --- | --- |
| Tablas de base de datos | 208 vs 209 | **209** | `pg_class` viva. La migración 0001–0011 daba 208; S1 no añade tablas, pero el conteo real por catálogo es 209 (incluye `schema_migrations`, que el `grep` de migraciones no cuenta). |
| Pares de migración | 11 vs 13 | **13** | `ls migrations/*.up.sql`. S1 añadió 0012 y 0013. |
| Políticas RLS | 16 vs 189 | **189** | `pg_policies` viva. El «16» era un artefacto de `grep create policy` (las migraciones posteriores las crean en bucle). |
| Tablas con FORCE RLS | 0 vs 189 | **189** | `pg_class.relforcerowsecurity`. Antes de S1 eran 0. |
| Pruebas totales | 136 vs 142 | **141 pasadas + 6 omitidas** | Ejecución real. Desglose abajo. |
| Pruebas de integración | 17 vs 22 | **22** | S1 añadió `rls-isolation.test.ts` (5). |
| Registros de procedencia | 7 vs 11 | **11** | `ls docs/compliance/ai-provenance/AIP-*.yml`. |
| Roles de base de datos | 1 (superusuario) vs 2 | **2** (`erp`, `erp_app`) | S1. |

## Desglose de pruebas (verificado 2026-07-24)

| Suite | Pasadas | Omitidas | Falladas |
| --- | --- | --- | --- |
| Unitarias (domain 41, security 17, api 12, web 9, database 7) | 86 | 0 | 0 |
| Integración | 22 | 0 | 0 |
| Compliance | 15 | 0 | 0 |
| E2E | 18 | 6 | 0 |
| **Total** | **141** | **6** | **0** |

Las 6 omitidas de E2E son omisiones por proyecto (móvil solo en `mobile-chromium`;
PDF y concurrencia solo en `desktop-chromium`). **No se cuentan como pasadas.**

## Estado de CI

| Estado | Aplica |
| --- | --- |
| `CI_CONFIGURED` | ✅ `.github/workflows/ci.yml`, 5 trabajos |
| `CI_EXECUTED_LOCALLY` | Parcial: la lógica de fallo-en-cerrado y cada comando invocado se probaron localmente |
| `CI_EXECUTED_REMOTELY` | ❌ nunca (sin remoto, sin push) |
| `CI_PASSING_REMOTELY` | ❌ no verificable aún |

## Hallazgos movidos a histórico (FIXED_VERIFIED)

C-1, C-3, C-4, H-2, H-6, H-7. Ya no se listan como defectos activos; su evidencia
queda en la sección de histórico del informe y en `docs/stabilization/`.

## Cobertura medida (no inventada)

domain 79.76%, security 81.46%, api 11.03% (sentencias). web/worker/contracts/
database: sin medición propia significativa. Detalle en `COVERAGE-BASELINE.md`.

## Incertidumbre restante

- El conteo de endpoints (~147) proviene de decoradores; rutas parametrizadas
  pueden variar levemente la superficie efectiva.
- LOC (18 465) cuenta `apps/` + `packages/` sin `node_modules`/`dist`; incluir
  `tests/` y `scripts/` da un número mayor (el informe previo usaba 21 388).
- El conteo de archivos varía según extensión: 168 `.ts/.tsx` en apps/packages/
  modules; 249 archivos con encabezado SPDX (incluye `.mjs`, `.sql`, `.yml`).
