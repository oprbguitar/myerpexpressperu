---
document_type: system_state_report
project: ERP Express Perú
generated: 2026-07-23
rebuilt_canonical: 2026-07-24
generated_by: Claude Opus 4.8 (Claude Code)
audience: AI agent / technical analyst
verification_basis: inspección de código y ejecución real (repositorio + base de datos viva)
human_reviewed: false
live_status: docs/stabilization/CURRENT-STABILIZATION-STATUS.md
verdict: PHASE_4_NOT_READY
---

# ERP Express Perú — Informe canónico de estado del sistema

> **Este documento fue reconstruido de forma canónica el 2026-07-24** para separar
> el estado ACTUAL del histórico y eliminar métricas contradictorias. El detalle
> de la reconciliación está en [`docs/stabilization/REPORT-RECONCILIATION.md`](stabilization/REPORT-RECONCILIATION.md).
> El registro vivo y cronológico está en
> [`docs/stabilization/CURRENT-STABILIZATION-STATUS.md`](stabilization/CURRENT-STABILIZATION-STATUS.md).
>
> Todo dato numérico se recalculó desde el repositorio o la base de datos en
> ejecución. Donde algo no está verificado, se dice. `human_reviewed: false`.

---

## 0. Metadatos del documento

| Campo | Valor |
| --- | --- |
| Estados usados | ver §0.1 |
| Base de la verificación | código + ejecución real (BD viva) |
| Revisión humana | pendiente |
| Veredicto | `PHASE_4_NOT_READY` |
| Autoridad en conflicto | ante contradicción, prevalecen `docs/reviews/` y `docs/stabilization/` |

### 0.1 Enumeración de estados

```text
VERIFIED_OPERATIONAL      ejecutado extremo a extremo con éxito
IMPLEMENTED_NOT_VERIFIED  el código existe/compila, sin ejecución e2e verificada
PREPARED_DISABLED         tablas/contratos existen; deshabilitado por defecto
PLACEHOLDER               registrado con implemented:false; sin lógica
NOT_PRESENT               sin código, tablas ni contratos
BLOCKED_LEGAL             posible técnicamente; prohibido activar sin autorización
FIXED_VERIFIED            defecto corregido y probado por comportamiento
FIXED_NOT_VERIFIED        corregido en código, sin prueba de comportamiento
PARTIALLY_FIXED           corregido en parte
OPEN                      defecto activo sin corregir
BLOCKED_HUMAN_DECISION    requiere decisión de una persona
NOT_APPLICABLE
```

---

## 1. Estado ejecutivo actual

- **Fases 1–3:** completas como inventario; su SALUD fue corregida por la
  verificación independiente (no eran «cero defectos»).
- **Fase 4:** pasos 1–2 (licenciamiento/procedencia) hechos; ningún módulo
  sectorial existe.
- **Estabilización (Fase 4A-0):** S0, S1, S3 completas; S2 en curso en esta
  ejecución; S4–S9 pendientes.
- **Veredicto:** `PHASE_4_NOT_READY` — 5 de 6 puertas no pasan (§14).

## 2. Versión y métricas técnicas (verificadas 2026-07-24)

| Métrica | Valor | Fuente |
| --- | --- | --- |
| Versión de aplicación | 0.1.0 | `package.json` |
| Versión de paquete demo | 0.3.0 | `scripts/demo` |
| Archivos `.ts/.tsx` (apps/packages/modules) | 168 | `find` |
| Archivos con encabezado SPDX | 249 / 249 | `pnpm license:headers` |
| Líneas de código (apps + packages) | 18 465 | `wc -l` |
| Tablas de base de datos | **209** | `pg_class` (viva) |
| Pares de migración | **13** | `ls migrations` |
| Tablas con RLS habilitada | **189** | `pg_class.relrowsecurity` |
| Tablas con FORCE RLS | **189** | `pg_class.relforcerowsecurity` |
| Tablas con política | **189** | `pg_policies` |
| Roles de base de datos | 2 (`erp`, `erp_app`) | `pg_roles` |
| Triggers | 25 | `pg_trigger` |
| Permisos definidos | 199 | `seed.ts` |
| Roles de aplicación (seed) | 6 | seed |
| Módulos en el registro | 47 (4 `implemented:false`) | `packages/domain/src/index.ts` |
| Endpoints HTTP | ~147 | decoradores |
| Controladores NestJS | 25 | `find` |
| Páginas React | 23 | `find` |
| Pruebas pasadas / omitidas / falladas | **147 / 10 / 0** | ejecución real (tras S2) |
| — unitarias | 90 | domain 41, security 17, api 16, web 9, database 7 |
| — integración | 22 | incluye 5 de aislamiento RLS |
| — compliance | 15 | |
| — e2e | 20 (+10 omitidas por proyecto) | incluye 2 de enforcement de módulos |
| Cobertura (domain/security/api) | 79.8% / 81.5% / 11.0% | `@vitest/coverage-v8` |
| Trabajos de CI | 5 (configurados, no ejecutados en remoto) | `ci.yml` |
| Componentes SBOM | 742 | `sbom:generate:project` |
| Registros de procedencia | **11** (todos `accepted:false`) | `docs/compliance/ai-provenance/` |

Diferencias respecto a valores previos: ver `REPORT-RECONCILIATION.md`.

## 3. Progreso de estabilización

| Etapa | Alcance | Estado |
| --- | --- | --- |
| S0 | Línea base + acceso local | ✅ Completa |
| S1 | Roles PostgreSQL + RLS efectiva | ✅ Completa y verificada |
| S2 | Enforcement de módulos en runtime | ✅ Completa y verificada |
| S3 | Integración en cerrado + CI + cobertura | ✅ Completa |
| S4 | Normalización de errores de API | ⬜ Pendiente |
| S5 | Checksums de migración | ⬜ Pendiente |
| S6 | Alineación dominio-runtime | ⬜ Pendiente (decisión D-7) |
| S7 | Fiabilidad del worker | ⬜ Pendiente |
| S8 | Arquitectura y madurez de módulos | ⬜ Pendiente |
| S9 | Verificación final | ⬜ Pendiente |

## 4. Capacidades operativas verificadas (`VERIFIED_OPERATIONAL`)

Ejecutadas extremo a extremo en esta sesión o en S1 (con `erp_app` y RLS activa).

- **Núcleo:** multi-tenant con RLS efectiva (189 tablas), autenticación argon2,
  sesiones con TTL/revocación, bloqueo por intentos, RBAC (199 permisos), auditoría
  append-only.
- **Operación comercial (Fase 1/2):** partes, productos, precios, inventario,
  ventas (cotización→pedido→venta→comprobante), compras, finanzas (CxC/CxP, pagos,
  caja), importación/exportación CSV, dashboard, PDF. Verificado en e2e incluida
  confirmación concurrente idempotente.
- **SUNAT básico:** flujo manual + proveedor mock. Pantalla corregida en esta
  sesión (antes daba pantalla en blanco).
- **Fase 3 operativa:** centro de administración, CRM, proyectos, legal,
  privacidad, proveedores, observabilidad, notificaciones.

## 5. Implementado pero no ejercitado / preparado-apagado

- `PREPARED_DISABLED`: RR. HH., SST, activos, mantenimiento, reglas de workflow,
  demo, mapas, OCR, IA (deshabilitados por defecto; requieren configuración).
- `IMPLEMENTED_NOT_VERIFIED`: la capa de dominio de Fase 3 existe pero no está
  cableada al runtime (ver H-1).

## 6. Hallazgos abiertos

| ID | Hallazgo | Severidad | Estado |
| --- | --- | --- | --- |
| H-1 | Capa de dominio de Fase 3 es código muerto (869 líneas). | Alta | `BLOCKED_HUMAN_DECISION` (D-7, S6) |
| H-3 | Superficie de API sin pruebas (`apps/api` 11% cobertura). | Alta | `OPEN` (pruebas HTTP pendientes) |
| VAL-1 | Errores de validación devuelven 500 en vez de 400. | Media | `OPEN` (S4) |
| MIG-1 | El runner de migraciones no calcula checksums. | Media | `OPEN` (S5) |
| WORKER-1 | El worker carece de reintentos/backoff/dead-letter. | Media | `OPEN` (S7) |

## 7. Hallazgos corregidos y evidencia (`FIXED_VERIFIED`)

| ID | Corrección | Evidencia |
| --- | --- | --- |
| C-1 | Rol `erp_app` restringido + FORCE RLS + contexto por petición. | Lectura cruzada→0, escritura cruzada→42501; `rls-isolation.test.ts`. `S1-RLS-REMEDIATION.md` |
| C-3 | `TRUSTED_PROXIES` (proxy no falsificable). | XFF falsificado→127.0.0.1; limitador restaurado. `TRUSTED-PROXY-AND-IP-REVIEW.md` |
| C-4 | Integración falla sin base; prohibido omitir en CI. | 4 casos probados. `S3-TEST-CI-REMEDIATION.md` |
| H-2 | Prueba de comportamiento de RLS a través de `erp_app`. | `rls-isolation.test.ts` (5) |
| H-6 | Cobertura medible (`@vitest/coverage-v8`). | `COVERAGE-BASELINE.md` |
| H-7 | CI configurada (`ci.yml`, 5 trabajos). | validez remota pendiente del primer push |
| C-2 | Enforcement de módulos en API (guard + fail-closed). | cash deshabilitado → 409 MODULE_DISABLED; `S2-MODULE-ENFORCEMENT.md` |
| H-4 | Worker respeta activación de módulos. | filtro EXISTS por generador; ciclo verificado |
| SUNAT | Deriva de contrato corregida + ErrorBoundary. | render verificado en navegador |

## 8. Base de datos y aislamiento

- 209 tablas; 189 con RLS `ENABLE`+`FORCE`+política por `tenant_id`+`company_id`.
- 11 tablas de identidad/auth sin RLS por tenant (se usan antes del contexto); 9
  tablas globales sin `tenant_id`. Clasificación en `TENANT-ISOLATION-MATRIX.md`.
- La API conecta con `erp_app` (sin SUPERUSER/BYPASSRLS, no propietario). Guarda
  de arranque rechaza roles privilegiados en producción.
- Migraciones y semilla usan `DATABASE_MIGRATION_URL` (rol propietario).

## 9. Pruebas y CI

- 141 pasadas, 6 omitidas, 0 falladas (§2). Las omitidas nunca se cuentan como
  pasadas.
- `test:integration` **falla en cerrado** sin base; en CI se prohíbe omitir.
- CI: `CI_CONFIGURED` sí; `CI_EXECUTED_REMOTELY` no. No se afirma CI verificada
  remotamente.
- Cobertura: domain 79.8%, security 81.5%, api 11.0%. web/worker/contracts/
  database sin medición propia.

## 10. Acceso local

Servicios verificados por comportamiento — ver §10 de
[`docs/local/LOCAL-ACCESS-GUIDE.md`](local/LOCAL-ACCESS-GUIDE.md) y
`docs/stabilization/LOCAL-ACCESS-VERIFICATION.md`.

| Servicio | URL | Estado |
| --- | --- | --- |
| Web | http://localhost:5273/ | En ejecución con `pnpm dev` |
| API | http://localhost:3100/api/v1 | En ejecución |
| Salud / Readiness | `/api/v1/health` · `/api/v1/health/readiness` | 200 |
| OpenAPI | http://localhost:3100/api/docs | 200 |
| MinIO / Mailpit | :9001 · :8025 | 200 |
| Documentación / Demo | — | `NOT_IMPLEMENTED` / `NOT_STARTED` |

Credenciales locales: archivo gitignored `LOCAL-ACCESS-CREDENTIALS.local.md`.
Nunca en este informe.

## 11. Enforcement de módulos

**S2 completa (`FIXED_VERIFIED`).** El guard global emite `MODULE_DISABLED` (409)
para cualquier endpoint de un módulo deshabilitado; verificación fail-closed en
arranque y CI; worker filtra por módulo; frontend oculta nav y bloquea rutas;
`disable-impact` computado del registro. Probado: cash deshabilitado → 409, otros
módulos del mismo controlador y core siguen 200. Detalle en
`S2-MODULE-ENFORCEMENT.md`, `S2-MODULE-OWNERSHIP-MATRIX.md`, `S2-MODULE-TEST-MATRIX.md`.

## 12. Alcance de Fase 4

0 de 19 módulos sectoriales implementados. 3 con placeholder (`manufacturing`,
`transport`, `public-sector`); `sunat` producción `BLOCKED_LEGAL`. Los 16
restantes `NOT_PRESENT`.

## 13. Bloqueantes legales y de decisión humana

`docs/reviews/HUMAN-DECISIONS-REQUIRED.md`: titularidad sin resolver (D-1..D-3),
MPL-2.0 sin aprobación, 11 registros de procedencia sin revisión humana,
`COMPONENT-OWNERS.yml` sin responsables, destino del dominio muerto (D-7),
alcance del rol de BD (D-8, ya ejecutado en S1).

## 14. Puertas de preparación

| Puerta | Estado | Nota |
| --- | --- | --- |
| Arquitectura | CONDITIONAL_PASS | C-2 cerrado (S2); queda H-1 (dominio muerto, decisión D-7) y unificación de estructura (S8) |
| Base de datos | CONDITIONAL_PASS | RLS efectiva (S1); faltan checksums (S5) |
| Seguridad | FAIL | proxy corregido; falta MFA, revocación admin, IDOR |
| Fiabilidad | FAIL | worker sin modelo de reintentos; sin staging/respaldo |
| Calidad | CONDITIONAL_PASS | integración en cerrado + CI + cobertura; falta cobertura de API y e2e en CI |
| Gobernanza | CONDITIONAL_PASS | licenciamiento/procedencia ok; titularidad y revisión humana pendientes |

**Veredicto: `PHASE_4_NOT_READY`.** Completar S2 no cambia el veredicto global.

### Delta 2026-07-27 — gestión operativa de residuos

Se incorporó un vertical slice aditivo `waste-management` con registro,
transiciones consecutivas hasta destino final, timeline y excepciones. Las
migraciones `0014`–`0015` agregan RLS forzado y privilegios mínimos. La ruta
local es `/residuos`.

Estado: apto para demo interna controlada, no para uso productivo o regulatorio.
El cierre interno está bloqueado; no existe todavía evidencia documental
vinculada, segregación de aprobación, catálogo técnico ambiental ni presentación
ante autoridades. Este delta no cambia `PHASE_4_NOT_READY`.

## 15. Siguiente acción recomendada

S2 completa. Siguiente: **S4** (normalización de errores de API, cierra VAL-1),
luego **S5** (checksums de migración, MIG-1) y **S6** (decisión D-7 sobre el
dominio muerto). No iniciar módulos sectoriales.

## 16. Cambios históricos de evaluación

El informe original (2026-07-23) afirmaba «cero defectos en Fases 1–3» y línea
base «verde». La verificación independiente lo desmintió con cuatro críticos
(C-1..C-4). C-1/C-3/C-4 ya están corregidos (§7). Los informes de punto-en-el-
tiempo se conservan en `docs/reviews/` y los archivos previos en
`docs/reports/archive/`. Ninguna afirmación histórica se borró; se movió aquí.

Historial de metricas contradictorias resueltas: `REPORT-RECONCILIATION.md`.

## 17. Evidencia y trazabilidad

- Estabilización: `docs/stabilization/` (S0, S1, S3, reconciliación, estado vivo).
- Revisión independiente: `docs/reviews/`.
- Licencias/procedencia/SBOM: `docs/compliance/`, `dist/compliance/`.
- Método: inspección de código + ejecución real. No verificado: carga,
  rendimiento, recuperación ante desastres, despliegue remoto, proveedores
  externos reales, CI en remoto.
- Revisión humana: **pendiente**. Registro de esta reconstrucción: `AIP-2026-0012`.
