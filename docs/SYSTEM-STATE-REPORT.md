---
document_type: system_state_report
project: ERP Express Perú
generated: 2026-07-23
updated: 2026-07-23
generated_by: Claude Opus 4.8 (Claude Code)
audience: AI agent / technical analyst
purpose: Recopilatorio completo del estado funcional para análisis y planificación
verification_basis: inspección directa del código y ejecución real de la suite
human_reviewed: false
superseded_health_assessment_by: docs/reviews/EXECUTIVE-TECHNICAL-REVIEW.md
---

# ERP Express Perú — Informe completo de estado del sistema

> **Cómo leer este documento.** Está escrito para que un agente de IA lo analice.
> Cada capacidad lleva un estado explícito de la enumeración definida en §0.2.
> Todo dato numérico proviene de inspección del repositorio o de ejecución real
> de comandos, no de estimación. Donde algo no está verificado, se dice.

> ## ⚠️ AVISO DE VERIFICACIÓN INDEPENDIENTE (2026-07-23)
>
> Después de generar este informe se ejecutó una **verificación técnica
> independiente** que trató sus conclusiones como hipótesis y las contrastó
> contra la base de datos y la API en ejecución. Resultado:
>
> - **El INVENTARIO de este documento (módulos, tablas, endpoints, permisos)
>   se confirmó correcto.** Puede seguir usándose como mapa del sistema.
> - **La EVALUACIÓN DE SALUD de este documento era demasiado optimista y queda
>   corregida.** En particular, la afirmación «cero defectos en Fases 1–3» y la
>   «línea base verde» eran ciertas solo bajo las condiciones exactas en que se
>   ejecutó la suite, y ocultaban cuatro defectos críticos.
> - **Veredicto de la verificación: `PHASE_4_NOT_READY`.** 5 de 6 puertas de
>   preparación en FAIL.
>
> Los hallazgos críticos, probados por ejecución, están resumidos en §3.6 y
> desarrollados en [`docs/reviews/EXECUTIVE-TECHNICAL-REVIEW.md`](reviews/EXECUTIVE-TECHNICAL-REVIEW.md)
> y [`docs/reviews/PHASE-4-READINESS-DECISION.md`](reviews/PHASE-4-READINESS-DECISION.md).
> **Ante cualquier contradicción entre este documento y los de `docs/reviews/`,
> prevalecen los de `docs/reviews/`.**

> ## 🔧 ESTABILIZACIÓN EN CURSO (Fase 4A-0, actualizado 2026-07-24)
>
> Tras la verificación se inició la estabilización. **Etapas completadas: S0, S1,
> S3.** Detalle en `docs/stabilization/` y en §3.7 de este documento.
>
> - **C-1 (RLS inerte): CORREGIDO Y VERIFICADO.** La API ya no conecta como
>   superusuario: usa el rol restringido `erp_app` (sin BYPASSRLS, no
>   propietario) y RLS se aplica de verdad en 189 tablas. Aislamiento entre
>   tenants probado por comportamiento (lectura cruzada → 0 filas; escritura
>   cruzada → bloqueada 42501).
> - **C-3 (proxy falsificable): CORREGIDO** (en la verificación previa).
> - **C-4 (integración que se autodesactiva): CORREGIDO.** `test:integration`
>   ahora falla sin base y prohíbe omitir en CI.
> - **H-7 (sin CI): CORREGIDO.** Existe `.github/workflows/ci.yml`.
> - **H-6 (cobertura inmedible): CORREGIDO.** Baseline medido.
> - **Además:** pantalla en blanco de SUNAT corregida (deriva de contrato) y
>   añadido un ErrorBoundary de React (no existía).
> - **Sigue abierto:** C-2 (enforcement de módulos, S2), H-1 (dominio muerto),
>   H-3 (API sin pruebas), H-4 (worker), MIG-1 (checksums), y S4–S9.
>
> **El veredicto global sigue siendo `PHASE_4_NOT_READY`** hasta que pasen todas
> las puertas técnicas obligatorias.

---

## 0. Metadatos de interpretación

### 0.1 Identidad del sistema

| Campo | Valor |
| --- | --- |
| Nombre | ERP Express Perú |
| Versión `package.json` | 0.1.0 |
| Versión de paquete demo | 0.3.0 |
| Arquitectura | Monolito modular |
| Stack | TypeScript estricto, NestJS (API), React + Vite PWA (web), Node worker, PostgreSQL |
| Gestor de paquetes | pnpm 10.31.0 (workspace) |
| Idioma del dominio | Español (es-PE) |
| Mercado objetivo | Perú (SUNAT, SST, ANPD, Indecopi) |
| Licencia | MPL-2.0 (**provisional**, sin aprobación legal) |
| Control de versiones | Git, inicializado en Fase 4, 5 commits, sin remoto |

### 0.2 Enumeración de estados

Usada en todo el documento:

| Estado | Significado |
| --- | --- |
| `OPERATIVO` | Implementado, con pruebas, y ejecutado con éxito en esta sesión |
| `IMPLEMENTADO_NO_EJERCITADO` | Código presente y compila, pero sin ejecución verificada extremo a extremo |
| `PREPARADO_APAGADO` | Tablas/contratos existen; el módulo está deshabilitado por defecto y requiere configuración |
| `PLACEHOLDER` | Registrado en el catálogo de módulos con `implemented: false`; sin lógica de negocio |
| `NO_EXISTE` | No hay código, tablas ni contratos |
| `BLOQUEADO_LEGAL` | Técnicamente posible, pero prohibido activar sin revisión/autorización externa |

### 0.3 Métricas medidas

| Métrica | Valor | Origen |
| --- | --- | --- |
| Archivos fuente originales con SPDX | 220 / 220 | `pnpm license:headers` |
| Líneas de código (apps + packages) | 21 388 | `wc -l` |
| Tablas en base de datos | 208 | `grep create table migrations/*.up.sql` |
| Migraciones (pares up/down) | 11 | `ls migrations/` |
| Políticas RLS (tablas con política) | **189** | `pg_policies` en la base viva (la métrica previa «16» era un artefacto de `grep`) |
| Tablas con `FORCE ROW LEVEL SECURITY` | **189** | tras S1 (antes 0) |
| Roles de base de datos | 2 (`erp` migración, `erp_app` runtime) | tras S1 (antes 1 superusuario) |
| Migraciones (pares up/down) | **13** | `ls migrations/` (tras S1: 0012, 0013) |
| Triggers | 25 | `grep create trigger` |
| Permisos definidos | 199 | `packages/database/src/seed.ts` |
| Roles de aplicación predefinidos | 6 | seed |
| Módulos en el registro | 47 | `packages/domain/src/index.ts:198` |
| Módulos con `implemented: false` | 4 | registro |
| Endpoints HTTP | ~147 | conteo de decoradores en controladores |
| Pruebas totales | **142** | ejecución real (86 unit + 22 integración + 15 compliance + 18 e2e + 1 db) |
| Cobertura (domain / security / api) | 79.8% / 81.5% / 11.0% | `@vitest/coverage-v8`, S3 |
| Trabajos de CI | 5 | `.github/workflows/ci.yml`, S3 |
| Registros de procedencia | 11 | `docs/compliance/ai-provenance/` (todos sin revisión humana) |

Distribución de código:

```text
apps/api            11 271 líneas
apps/web             3 395
packages/domain      2 969
packages/database    1 775
scripts              1 640
packages/security      959
tests                  962
packages/contracts     886
apps/worker            133
```

---

## 1. Situación de fases

### 1.1 Estado global

| Fase | Alcance | Estado |
| --- | --- | --- |
| Fase 1 | Núcleo: organización, identidad, autorización, catálogos, auditoría, documentos | ✅ Completa |
| Fase 2 | Operaciones: partes, productos, precios, inventario, ventas, compras, finanzas, SUNAT básico | ✅ Completa |
| Fase 3 | Administración, CRM, proyectos, RR. HH., SST, activos, legal, privacidad, IA, OCR, mapas, demo | ✅ Completa |
| **Fase 4** | **Sectorial, auditoría interna, identidad reforzada, licenciamiento, autoauditoría, documentación** | 🟡 **Pasos 1–2 de 12** |

### 1.2 Posición exacta dentro de la Fase 4

La instrucción de Fase 4 define 12 pasos (§35). Estado real:

| Paso | Descripción | Estado |
| --- | --- | --- |
| 1 | Inspección, verificación de fases previas, línea base | ✅ Completo |
| 2 | Licenciamiento, titularidad, SPDX, procedencia IA, SBOM | ✅ Completo |
| 3 | Contratos sectoriales, plan de migraciones, permisos, eventos | ❌ Pendiente |
| 4 | Manufactura y calidad | ❌ Pendiente |
| 5 | Transporte y flota | ❌ Pendiente |
| 6 | Construcción, contratistas, agroindustria, sector público avanzado | ❌ Pendiente |
| 7 | Auditoría interna y controles continuos | ❌ Pendiente |
| 8 | MFA, passkeys, sesiones, IP, gobierno de accesos | ❌ Pendiente (excepto corrección de proxy de confianza, ya aplicada — §3.6, C-3) |
| 9 | Autoauditoría, verificador de instalación, deriva de configuración | ❌ Pendiente |
| 10 | Centro de documentación y generación de manuales | ❌ Pendiente |
| 11 | Revisiones (licencias, seguridad, privacidad, legal, accesibilidad) | ❌ Pendiente |
| 12 | Suite completa, manifiesto de release, informe final | ❌ Pendiente |

**Progreso Fase 4: 2/12 pasos ≈ 17 %.**

Razón del alcance limitado: la Fase 4 pide 19 módulos, ~200 tablas nuevas,
~120 permisos, ~45 grupos de rutas y 40 escenarios e2e. La base existente es de
21 388 líneas. Lo pedido equivale a varias veces el sistema actual. Se ejecutaron
los pasos que la propia instrucción sitúa antes de tocar código de negocio.

---

## 2. Qué funciona — verificado por ejecución

Todo lo de esta sección fue **ejecutado** en esta sesión con resultado exitoso.

### 2.1 Suite de verificación

| Comando | Resultado | Detalle |
| --- | --- | --- |
| `pnpm lint` | ✅ PASS | ESLint `--max-warnings=0` |
| `pnpm typecheck` | ✅ PASS | 7 proyectos, TypeScript estricto, sin `any` |
| `pnpm test` | ✅ PASS | 18 archivos, 86 pruebas |
| `pnpm test:integration` | ✅ PASS | 4 archivos, 17 pruebas contra PostgreSQL real |
| `pnpm test:e2e` | ✅ PASS | 24 casos: 18 pasan, 6 omitidos por proyecto |
| `pnpm test:compliance` | ✅ PASS | 15 pruebas de licenciamiento y procedencia |
| `pnpm build` | ✅ PASS | api, web (PWA, 37 entradas precache), worker, database |
| `pnpm audit --prod` | ✅ PASS | Sin vulnerabilidades conocidas |
| `pnpm phase4:verify` | ✅ PASS | Cadena completa, salida 0 |
| `pnpm demo:verify` | ✅ PASS | 34 archivos escaneados, 0 hallazgos de secretos |
| Migraciones ida y vuelta | ✅ PASS | 11 `up` + `reset` completo contra base limpia |

**Total: 136 pruebas en verde bajo estas condiciones.**

> **⚠️ Corrección de la verificación independiente.** La frase original decía
> «Cero defectos en el código de Fases 1–3». **Es incorrecta y queda retirada.**
> La suite pasa, pero:
>
> - `pnpm test:integration` **sale 0 con las 17 pruebas OMITIDAS** cuando falta
>   `DATABASE_URL`. La «verdura» de arriba depende de que la base esté levantada;
>   en CI sin esa variable, el comando reporta éxito sin verificar nada. (§3.6, C-4)
> - 14 de las 17 pruebas de integración solo consultan `information_schema`:
>   afirman que existe una política RLS, no que actúe. (§3.6, H-2)
> - La afirmación correcta es: **«No se detectaron defectos en los escenarios
>   cubiertos por la suite ejecutada»** — que es mucho menos de lo que parecía.

### 2.2 Núcleo (Fase 1) — `OPERATIVO`

| Capacidad | Evidencia |
| --- | --- |
| Multi-tenant con `tenant_id` / `company_id` | 209 tablas, **189 con RLS forzada y efectiva** tras S1. La API conecta con el rol restringido `erp_app`; aislamiento entre tenants probado por comportamiento (§3.6/§3.7, C-1 corregido) |
| Autenticación por contraseña (argon2) | `auth.service.ts`, pruebas de seguridad |
| Sesiones con TTL y revocación | `sessions`, `GET /auth/sessions` |
| Bloqueo por intentos fallidos | `login_attempts`, `LOGIN_MAX_ATTEMPTS=5` |
| Restablecimiento de contraseña | `password_reset_tokens`, TTL 1800 s |
| Roles y permisos (RBAC) | 199 permisos, 6 roles, `resolveEffectivePermissions` |
| Auditoría con cadena de integridad | `audit_events`, `audit_integrity_checkpoints` |
| Tablas append-only por trigger | 25 triggers, migraciones 0005/0006 |
| Documentos privados en almacenamiento | `documents`, MinIO/S3 vía `storage.service.ts` |
| Activación modular progresiva | 47 módulos, `validateModuleEnablement` |

### 2.3 Operaciones (Fase 2) — `OPERATIVO`

| Dominio | Endpoints | Estado |
| --- | --- | --- |
| Partes (clientes/proveedores) | 9 | ✅ Modelo unificado con roles |
| Productos y categorías | 9 | ✅ Ítems, códigos de barras, unidades |
| Listas de precios | 3 | ✅ Resolución con vigencia |
| Inventario | 6 | ✅ Movimientos, saldos, transferencias, ajustes |
| Ventas | 11 | ✅ Cotización → pedido → venta → comprobante |
| Compras | 9 | ✅ Compras y gastos con confirmación/cancelación |
| Finanzas | 9 | ✅ CxC, CxP, pagos, reversiones, caja |
| Comprobantes comerciales | — | ✅ Numeración por serie, eventos |
| SUNAT básico | 6 | ⚠️ Solo flujo manual + proveedor mock |
| Importación/exportación CSV | 4 | ✅ Previsualización y ejecución auditada |
| Dashboard operativo | 1 | ✅ Datos reales del servidor |
| Generación de PDF | 1 | ✅ Verificado en e2e |

Reglas de negocio verificadas en e2e: **confirmación concurrente idempotente** y
cancelación de venta.

### 2.4 Fase 3 — `OPERATIVO` / `PREPARADO_APAGADO`

| Módulo | Estado | Nota |
| --- | --- | --- |
| Centro de administración | `OPERATIVO` | 26 endpoints bajo `/admin` |
| Perfiles de negocio | `OPERATIVO` | Plantillas configurables por actividad |
| CRM | `OPERATIVO` | Leads, oportunidades, pipelines, actividades |
| Proyectos | `OPERATIVO` | Tareas, hitos, entregables, presupuestos, riesgos |
| Tiempo y gastos de proyecto | `OPERATIVO` | Registro y aprobación |
| Centro legal | `OPERATIVO` | Documentos, versiones, aceptaciones, revocaciones |
| Privacidad | `OPERATIVO` | Consentimientos, solicitudes ARCO, retención, legal holds |
| Gestión de proveedores | `OPERATIVO` | Configuración, salud, test, activación |
| Observabilidad | `OPERATIVO` | Salud, métricas, eventos |
| Notificaciones avanzadas | `OPERATIVO` | Preferencias y digest |
| Recursos humanos | `PREPARADO_APAGADO` | `defaultEnabled: false` |
| SST | `PREPARADO_APAGADO` | Inspecciones, hallazgos, EPP, accidentes |
| Activos | `PREPARADO_APAGADO` | Registro, asignación, ciclo de vida |
| Mantenimiento | `PREPARADO_APAGADO` | Planes y órdenes de trabajo |
| Reglas de workflow | `PREPARADO_APAGADO` | Versionadas, con simulación |
| Gestión demo | `PREPARADO_APAGADO` | Escenarios, aislamiento, reset con guardas |
| Mapas | `PREPARADO_APAGADO` | Proveedor manual, sin dependencia externa |
| OCR | `PREPARADO_APAGADO` | Solo borradores con confirmación humana |
| Inteligencia artificial | `PREPARADO_APAGADO` | Herramientas registradas de solo lectura |

### 2.5 Fase 4 pasos 1–2 — `OPERATIVO`

| Capacidad | Comando | Resultado real |
| --- | --- | --- |
| Cobertura SPDX | `pnpm license:headers` | 220/220 archivos |
| Escaneo de licencias | `pnpm license:scan` | 769 paquetes, 0 desconocidas, 0 prohibidas |
| Compatibilidad | `pnpm license:compatibility` | Sin bloqueantes |
| Avisos de terceros | `pnpm license:notices` | 769 paquetes, 11 licencias |
| Procedencia IA | `pnpm provenance:verify` | 7 registros válidos |
| Puerta de release | `pnpm provenance:verify --strict` | ⛔ Salida 1 — **correcto**, nada aceptado |
| SBOM del proyecto | `pnpm sbom:generate:project` | 709 componentes, 0 malformados |

---

## 3. Qué NO funciona o no existe

### 3.1 Módulos declarados como no implementados

En `packages/domain/src/index.ts:239-242`, con `implemented: false`. El sistema
**rechaza activamente su activación** vía `validateModuleEnablement`.

| Módulo | Código | Estado | Fase 4 lo pide |
| --- | --- | --- | --- |
| Manufactura | `manufacturing` | `PLACEHOLDER` | Sí (§8) |
| Transporte | `transport` | `PLACEHOLDER` | Sí (§10) |
| Sector público | `public-sector` | `PLACEHOLDER` | Sí (§15) |
| SUNAT producción | `sunat` | `BLOQUEADO_LEGAL` | No — fase futura |

### 3.2 Módulos de Fase 4 que no existen en absoluto

Ninguno tiene tablas, contratos, rutas ni entrada en el registro:

| Módulo Fase 4 | Sección | Estado |
| --- | --- | --- |
| Gestión de calidad | §9 | `NO_EXISTE` |
| Operaciones de flota | §11 | `NO_EXISTE` |
| Construcción y contratos | §12 | `NO_EXISTE` |
| Preparación contratista minero | §13 | `NO_EXISTE` |
| Agroindustria | §14 | `NO_EXISTE` |
| Auditoría interna | §16 | `NO_EXISTE` |
| Monitoreo continuo de controles | §17 | `NO_EXISTE` |
| Aseguramiento de identidad (MFA/passkeys) | §18 | `NO_EXISTE` |
| Gobierno de accesos | §20 | `NO_EXISTE` |
| Analítica de seguridad | §21 | `NO_EXISTE` |
| Autoauditoría | §22 | `NO_EXISTE` |
| Verificación de instalación | §23 | `NO_EXISTE` |
| Centro de documentación | §24 | `NO_EXISTE` |
| Gobierno de releases | §19 | `NO_EXISTE` |

**Resumen: de los 19 módulos que pide la Fase 4, 0 están implementados.**
3 tienen placeholder registrado; 16 no existen.

### 3.3 Brechas de seguridad frente a lo pedido en Fase 4

| Capacidad | Estado actual | Pedido en Fase 4 |
| --- | --- | --- |
| Contraseña + argon2 | ✅ Existe | Mantener |
| MFA / TOTP | ❌ `NO_EXISTE` | §18.1 obligatorio |
| WebAuthn / passkeys | ❌ `NO_EXISTE` | §18.1 obligatorio |
| Códigos de recuperación | ❌ `NO_EXISTE` | §18.1 |
| Listado de dispositivos | ❌ `NO_EXISTE` | §18.1 |
| Historial de inicios de sesión | ⚠️ Parcial (`login_attempts`) | §19.1 ampliado |
| Reautenticación en operaciones sensibles | ⚠️ Parcial | §18.2 perfiles |
| Reglas IP / red (allowlist, denylist) | ❌ `NO_EXISTE` | §19.4 |
| Soporte IPv6 y proxy confiable | ⚠️ Corregido a `REQUIRES_CONFIGURATION` (§3.6, C-3) | §19.4 crítico |
| Indicadores de riesgo de sesión | ❌ `NO_EXISTE` | §19.3 |
| Revisión periódica de accesos | ❌ `NO_EXISTE` | §20 |
| Reglas de segregación de funciones | ❌ `NO_EXISTE` | §15.1, §20 |
| Revocación de sesión de terceros | ⚠️ Solo propias | §18.1 |

**El control de IP con proxy confiable (§19.4) era el punto de mayor riesgo:**
sin validación de `X-Forwarded-For`, cualquier allowlist basada en IP sería
falsificable. La verificación independiente **confirmó y corrigió** este riesgo:
`trustProxy: true` incondicional permitía falsificar la IP y evadir el limitador
de tasa por completo. Corregido con `TRUSTED_PROXIES` (§3.6, C-3). No se deben
introducir allowlists por IP hasta cerrar los pendientes de ese hallazgo.

### 3.4 Limitaciones funcionales heredadas y declaradas

Documentadas en `docs/PHASE-3-REPORT.md` y `docs/PHASE-4-READINESS.md`:

| Área | Limitación | Clasificación |
| --- | --- | --- |
| SUNAT | Sin conectividad productiva; solo flujo manual y mock | `BLOQUEADO_LEGAL` |
| Firma digital IOFE | No implementada | `BLOQUEADO_LEGAL` |
| Planillas | No implementadas | `NO_EXISTE` |
| Contabilidad completa | No implementada — afecta §8.5 de Fase 4 | `NO_EXISTE` |
| Diagnóstico médico | Prohibido por diseño | `BLOQUEADO_LEGAL` |
| Decisiones laborales automatizadas | Prohibidas por diseño | `BLOQUEADO_LEGAL` |
| Proveedores IA/OCR cloud | Deshabilitados; solo modos mock rotulados | `PREPARADO_APAGADO` |
| Despliegue remoto | Nunca ejecutado; entregable local y portable | No verificado |
| Pruebas de carga y recuperación | No ejecutadas | No verificado |

### 3.5 Deuda técnica identificada

| ID | Descripción | Severidad | Estado |
| --- | --- | --- | --- |
| SBOM-1 | Sufijo de dependencias de pares corrompía nombre/versión en el generador de SBOM | Alta | ✅ Corregido en Fase 4 |
| SBOM-2 | Paquetes hoja (`'pkg@1.0.0': {}`) omitidos: 257 de 709 componentes, 36 % del árbol | Alta | ✅ Corregido en Fase 4 |
| WORKER-1 | El worker son 133 líneas: un bucle de outbox. Fase 4 pide colas, reintentos y jobs programados | Media | ❌ Abierto |
| MOD-1 | `modules/*` solo contiene `AGENTS.md`; el código de Fase 3 vive en `apps/api/src/phase3/`. La convención de ubicación es ambigua para Fase 4 | Media | ❌ Abierto |
| OWN-1 | Titularidad de derechos sin resolver; MPL-2.0 sin aprobación legal | Alta (legal) | ❌ Abierto |
| REV-1 | Los 7 registros de procedencia están sin revisión humana | Alta (proceso) | ❌ Abierto |
| MIG-1 | El runner de migraciones no calcula checksums; Fase 4 §22.4 pide detectar discrepancias | Media | ❌ Abierto |
| VAL-1 | Errores de validación (`ZodError` en handlers) devuelven HTTP 500 en vez de 400 | Media | ❌ Abierto (hallado en verificación) |

---

## 3.6 Hallazgos críticos de la verificación independiente (2026-07-23)

Estos hallazgos **no estaban en la versión original** de este informe. Fueron
descubiertos por una revisión independiente que trató este documento como
hipótesis y contrastó contra la base de datos y la API en ejecución. Cada uno se
**probó por ejecución**, no por lectura. Desarrollo completo en
[`docs/reviews/EXECUTIVE-TECHNICAL-REVIEW.md`](reviews/EXECUTIVE-TECHNICAL-REVIEW.md).

| ID | Hallazgo | Severidad | Estado |
| --- | --- | --- | --- |
| C-1 | La app conectaba a PostgreSQL como **superusuario con `BYPASSRLS`**; las políticas RLS estaban **inertes**. Lectura cruzada real devolvía 3 filas en vez de 0. | **Crítica** | ✅ **`FIXED_VERIFIED` (S1)**: rol `erp_app` restringido + FORCE RLS en 189 tablas + contexto por petición. Lectura cruzada → 0, escritura cruzada → 42501. |
| C-2 | **Desactivar un módulo no protege los ~80 endpoints de Fase 1/2**, y `disable-impact` afirma al operador que sí. `@RequireModule` solo se usa en Fase 3. | **Crítica** | `OPEN` — corresponde a la etapa S2 (aún no ejecutada) |
| C-3 | `trustProxy: true` incondicional: **IP falsificable y limitador de tasa evadible**. | **Crítica** | ✅ `FIXED_VERIFIED` (`TRUSTED_PROXIES`), reclasificado a `REQUIRES_CONFIGURATION` |
| C-4 | **La suite de integración se autodesactiva**: sin `DATABASE_URL`, las pruebas se omiten y el comando **sale 0**. | **Crítica** | ✅ **`FIXED_VERIFIED` (S3)**: `test:integration` falla sin base; en CI se prohíbe omitir; guarda de conteo. |
| H-1 | **La capa de dominio de Fase 3 es código muerto** (869 líneas). Sus 25 pruebas verdes no prueban comportamiento. | Alta | `BLOCKED_HUMAN_DECISION` (D-7) — etapa S6 |
| H-2 | **RLS se afirma pero nunca se ejerce**: pruebas solo consultan `information_schema`. | Alta | ✅ **`FIXED_VERIFIED` (S1)**: `rls-isolation.test.ts` prueba denegación real a través de `erp_app`. |
| H-3 | **73 archivos de API sin pruebas**, incluidos `auth.guard.ts`. | Alta | `OPEN` — medido (apps/api 11% cobertura) en S3; pruebas HTTP pendientes |
| H-4 | **El worker ignora la activación de módulos.** | Alta | `OPEN` — etapa S2/S7 |
| H-6 | **Sin herramienta de cobertura**: la cobertura era inmedible. | Alta | ✅ **`FIXED` (S3)**: `@vitest/coverage-v8`, baseline medido |
| H-7 | **Sin CI**: no existe `.github/`. | Alta | ✅ **`FIXED` (S3)**: `ci.yml` con 5 trabajos (validez real al primer push) |
| VAL-1 | Errores de validación devuelven **500 en vez de 400**. | Media | `OPEN` — etapa S4 |

**Veredicto de la verificación: sigue `PHASE_4_NOT_READY`.** La estabilización ha
cerrado C-1, C-3, C-4, H-2, H-6, H-7; siguen abiertos C-2, H-1, H-3, H-4, VAL-1 y
las etapas S2, S4–S9. Ver §3.7 y `docs/stabilization/`.

## 3.7 Progreso de estabilización (Fase 4A-0)

| Etapa | Alcance | Estado |
| --- | --- | --- |
| S0 | Línea base + diagnóstico de acceso local | ✅ Completa. `localhost:5273` no cargaba porque el dev server no estaba corriendo. |
| S1 | Roles PostgreSQL + RLS efectiva | ✅ Completa y verificada. `docs/stabilization/S1-RLS-REMEDIATION.md` |
| S2 | Enforcement de módulos en runtime | ⬜ Pendiente (cierra C-2, H-4) |
| S3 | Integración en cerrado + CI | ✅ Completa. `docs/stabilization/S3-TEST-CI-REMEDIATION.md` |
| S4 | Normalización de errores de API | ⬜ Pendiente (cierra VAL-1) |
| S5 | Integridad de migraciones (checksums) | ⬜ Pendiente (MIG-1) |
| S6 | Alineación dominio-runtime | ⬜ Pendiente (H-1, decisión D-7) |
| S7 | Fiabilidad del worker | ⬜ Pendiente (H-4, WORKER-1) |
| S8 | Arquitectura y madurez de módulos | ⬜ Pendiente |
| S9 | Verificación final | ⬜ Pendiente |

Correcciones adicionales de esta sesión, fuera de las etapas numeradas:

- **Pantalla en blanco de SUNAT básico**: deriva de contrato (`SunatPage` leía
  `provider`/`warnings`; la API devuelve `mode`/`messages`). Corregido y
  verificado en navegador real.
- **ErrorBoundary de React**: no existía ninguno, por lo que cualquier error de
  render dejaba la app en blanco. Añadido, contiene el fallo por página.

---

## 4. Inventario técnico detallado

### 4.1 Superficie de API

Base: `/api/v1`. Agrupada por controlador:

```text
app                    3   /health, /health/readiness, /me
auth                   6   login, logout, sessions, cambio y reset de contraseña
users                  3   listar, crear, desactivar
roles                  2   listar, crear
audit                  1   consulta de eventos
modules                4   listar, habilitar, impacto, deshabilitar
organization           3   empresa actual, actualizar, sedes
parties                9   partes, clientes, proveedores, roles, crédito
catalog                9   ítems, categorías, unidades, listas de precios
inventory              6   almacenes, saldos, movimientos, transferencias, ajustes
sales                 11   cotizaciones, pedidos, ventas, comprobantes
purchases              9   compras, gastos, confirmación, cancelación
finance                9   CxC, CxP, pagos, reversiones, caja
documents              3   listar, subir, descargar
imports                4   plantilla, previsualización, ejecución, exportaciones
notifications          2   listar, marcar leída
dashboard              1   resumen operativo
pdf                    1   generación por tipo
sunat                  6   configuración, documentos, historial, mock
admin                 26   settings, features, perfiles, CRM, proyectos, RR.HH., SST, activos
admin/providers        5   listar, test, activar, desactivar, exportar
governance            14   legal, privacidad, retención, legal holds, observabilidad
ai                     5   query, documentos, feedback, uso, incidentes
ocr                    4   jobs, estado, extracciones, confirmación
maps                   1   geocodificación
─────────────────────────
TOTAL                ~147 endpoints
```

### 4.2 Modelo de datos por dominio

208 tablas. Agrupación aproximada:

| Dominio | Tablas | Ejemplos |
| --- | --- | --- |
| Núcleo / identidad | ~20 | `tenants`, `companies`, `branches`, `users`, `sessions`, `roles`, `permissions` |
| Partes y catálogos | ~20 | `parties`, `party_roles`, `items`, `price_lists`, `units_of_measure` |
| Inventario | ~7 | `warehouses`, `stock_balances`, `stock_movements`, `stock_reservations` |
| Ventas y compras | ~15 | `sales`, `quotations`, `purchases`, `commercial_documents` |
| Finanzas | ~14 | `accounts_receivable`, `payments`, `cash_sessions`, `exchange_rates` |
| CRM | ~9 | `leads`, `opportunities`, `pipelines`, `commercial_activities` |
| Proyectos | ~16 | `projects`, `project_tasks`, `project_budgets`, `project_risks` |
| RR. HH. | ~15 | `employees`, `employment_contracts`, `employee_vacations` |
| SST | ~15 | `sst_inspections`, `sst_hazards`, `sst_accidents`, `sst_ppe_deliveries` |
| Activos y mantenimiento | ~14 | `assets`, `maintenance_work_orders`, `meter_readings` |
| Legal y privacidad | ~18 | `legal_documents`, `consent_records`, `privacy_requests`, `legal_holds` |
| IA y OCR | ~16 | `ai_interactions`, `ai_policies`, `ocr_jobs`, `ocr_extractions` |
| Gobierno y demo | ~15 | `feature_flags`, `provider_configurations`, `demo_scenarios` |
| Auditoría y observabilidad | ~8 | `audit_events`, `audit_integrity_checkpoints`, `system_metrics` |

### 4.3 Capa web

24 páginas React, 33 componentes TSX, 3 395 líneas. PWA con service worker
(37 entradas de precache), soporte offline y `navigateFallback`.

Verificado en e2e: login accesible sin overflow, manifiesto PWA disponible,
dashboard con datos reales, flujo móvil sin desbordamiento horizontal en
viewport Pixel 7, generación de PDF autorizada.

Cobertura por viewport: `desktop-chromium`, `mobile-chromium` (Pixel 7), `webkit`.

### 4.4 Worker

**133 líneas.** Un único bucle que procesa la tabla `outbox_events` de forma
transaccional. No hay colas, reintentos con backoff, jobs programados ni
recuperación de fallos. Es el componente más débil frente a lo que pide Fase 4
(§34: `queues`, `scheduled jobs`, recuperación de colas).

---

## 5. Cumplimiento y gobernanza

### 5.1 Licenciamiento — `OPERATIVO`

| Elemento | Estado |
| --- | --- |
| `LICENSE` (MPL-2.0 canónico, 16 726 bytes, sha256 `3f3d9e00…`) | ✅ Verificado íntegro |
| Cobertura SPDX | ✅ 220/220 archivos |
| Dependencias escaneadas | ✅ 769, 0 desconocidas, 0 prohibidas |
| GPL / AGPL / LGPL / SSPL / BUSL / Elastic | ✅ Ninguna presente |
| SBOM CycloneDX 1.6 | ✅ 709 componentes, 659 con licencia |
| `THIRD-PARTY-NOTICES.md` | ✅ Generado, con sección de atribución CC-BY-4.0 |

Distribución: MIT 576, Apache-2.0 129, ISC 30, BSD-3-Clause 10, BlueOak-1.0.0 9,
BSD-2-Clause 9, 0BSD 2, Python-2.0 1, CC-BY-4.0 1, `(MIT AND Zlib)` 1,
`(MIT OR CC0-1.0)` 1.

### 5.2 Procedencia de IA — `OPERATIVO` con acción humana pendiente

7 registros (`AIP-2026-0001` a `0007`; los dos últimos cubren el informe de
estado y la verificación independiente). **Todos con `human_reviewer: pending` y
`accepted: false`.** El verificador rechaza cualquier registro que declare
`accepted: true` sin revisor verificado.

Marcos de gobernanza (NIST AI RMF, Perfil de IA Generativa, SSDF, SP 800-218A,
Reglamento de IA de la UE, Oficina de Derechos de Autor de EE. UU.) registrados
como **referencias de diseño con `assessed: false`**. No se afirma conformidad ni
certificación con ninguno.

### 5.3 Marco legal peruano

Trazable a fuentes oficiales en `docs/phase3/LEGAL-REQUIREMENT-MATRIX.md`:
DS 115-2025-PCM (IA), DS 016-2024-JUS (protección de datos), IOFE (firma
digital), SUNAT CPE (comprobantes), Indecopi (Libro de Reclamaciones).

El sistema **no declara cumplimiento automático**; exige revisión jurídica por
empresa.

### 5.4 Bloqueantes legales abiertos

| ID | Cuestión | Impacto |
| --- | --- | --- |
| OWN-1 | Titular de derechos sin declarar; marcador provisional «ERP Express Perú contributors» | Bloquea distribución externa |
| OWN-2 | MPL-2.0 sin aprobación legal. Si se planea edición propietaria, decidir **antes** de distribuir | Estratégico |
| OWN-3 | Autoría de Fases 1–3 no derivable: no hubo Git hasta Fase 4 | Requiere declaración del propietario |
| OWN-4 | Régimen de las partes asistidas por IA para registro de propiedad intelectual | Requiere abogado |

Detalle en `docs/legal/OWNERSHIP-REVIEW.md`.

---

## 6. Análisis de brecha: Fase 4 pedida vs. entregada

| Requisito §37 (criterios de aceptación) | Estado |
| --- | --- |
| 1. Fases previas operativas | ✅ |
| 2. Pruebas existentes siguen pasando | ✅ |
| 3. Política MPL-2.0 documentada | ✅ |
| 4. SPDX cubre archivos originales | ✅ |
| 5. Avisos de terceros preservados | ✅ |
| 6. Licencias de dependencias escaneadas | ✅ |
| 7. SBOM generado | ✅ |
| 8. Registros de procedencia implementados | ✅ |
| 9. Revisión humana exigida | ✅ (mecanismo); ❌ (no ejecutada) |
| 10–19. Módulos sectoriales y auditoría | ❌ |
| 20–26. MFA, passkeys, sesiones, IP, accesos | ❌ |
| 27–28. Autoauditoría e instalador | ❌ |
| 29. Informes sin secretos | ✅ |
| 30–40. Centro de documentación y guías | ❌ |
| 41. Móvil | ✅ (heredado de Fase 3) |
| 42. Sin overflow horizontal | ✅ (heredado de Fase 3) |
| 43–44. Aislamiento de tenant/empresa | ⚠️ **Degradado a parcial por la verificación**: funciona por filtrado de aplicación, no por RLS (§3.6, C-1). §37 pide que «pase», y por RLS **no pasa** |
| 45–54. Pruebas, tipos, lint, build | ⚠️ Pasan, pero la suite de integración se autodesactiva sin base (§3.6, C-4) y la cobertura es inmedible (H-6) |
| 55. Manifiesto de release | ❌ |
| 56. Informe final honesto sobre limitaciones | ✅ |

**Cumplidos: ~20 de 56 ≈ 36 %** (revisado a la baja tras la verificación: los
criterios de aislamiento y de pruebas ya no cuentan como plenamente cumplidos).
Los cumplidos son íntegramente los de infraestructura y licenciamiento; ninguno
de los funcionales sectoriales.

---

## 7. Sugerencias para las siguientes fases

### 7.1 Bloqueantes previos a cualquier código nuevo

> La verificación independiente convirtió esta lista en **condiciones
> obligatorias de puerta**. Lista completa y clasificación por puerta en
> [`docs/reviews/PHASE-4-READINESS-DECISION.md`](reviews/PHASE-4-READINESS-DECISION.md).
> Resumen:

**Bloqueantes técnicos (los añade la verificación):**

1. **Crear un rol de aplicación restringido en PostgreSQL** sin `SUPERUSER` ni
   `BYPASSRLS`, aplicar `FORCE ROW LEVEL SECURITY`, y añadir una prueba de
   comportamiento que imponga 0 filas en lectura cruzada (C-1 / D-8).
2. **Aplicar `@RequireModule` a los endpoints de Fase 1/2** o impedir desactivar
   módulos sin punto de aplicación; corregir el texto de `disable-impact` (C-2).
3. **Hacer que `test:integration` FALLE sin `DATABASE_URL`** e **introducir CI**
   (C-4 / H-7). Sin CI, todas las demás correcciones son reversibles en silencio.
4. **Implementar checksums de migración** (MIG-1).
5. **Decidir el destino de la capa de dominio muerta de Fase 3**: cablearla o
   eliminarla (H-1 / D-7).

**Bloqueantes de gobernanza (no puede resolverlos una IA):**

6. **Resolver la titularidad** (`docs/legal/OWNERSHIP-REVIEW.md`).
7. **Revisar y aceptar o rechazar los 7 registros de procedencia.** Mientras
   sigan pendientes, bajo la política del propio proyecto nada está aceptado.
8. **Asignar responsables** en `docs/compliance/COMPONENT-OWNERS.yml`. Hoy todos
   son `null`, lo que deja inoperante el control de revisión independiente.

### 7.2 Secuencia recomendada

La instrucción original agrupa demasiado. Propuesta de subfases ejecutables:

#### Fase 4A — Fundaciones sectoriales (paso 3)

**Objetivo:** contratos compartidos antes de cualquier módulo.

- Definir contratos hexagonales sectoriales en `packages/contracts`.
- Resolver **MOD-1**: decidir si el código sectorial va en `modules/*` o en
  `apps/api/src/phase4/`. La ambigüedad actual costará refactorizaciones.
- Plan de secuenciación de migraciones (`0012`–`00XX`).
- Añadir checksums al runner de migraciones (**MIG-1**), requisito de §22.4.
- Registrar los 19 módulos en `moduleRegistry` con `implemented: false`, para que
  el sistema los rechace explícitamente hasta que existan.

**Criterio de salida:** contratos compilan, migraciones numeradas, registro
actualizado, suite en verde.

#### Fase 4B — Manufactura y calidad (pasos 4)

**Objetivo:** probar el patrón sectorial completo **una vez** antes de replicarlo.

- BOM versionado, rutas, centros de trabajo, órdenes de producción.
- Máquina de estados de §8.3 (10 estados) en `packages/domain` con pruebas.
- Integración transaccional con inventario.
- Calidad: planes, inspecciones, no conformidades, acciones correctivas.
- **Riesgo:** §8.5 pide cálculo de costos, pero **no existe contabilidad
  completa**. Limitar a costeo operativo y declararlo explícitamente.

**Criterio de salida:** flujo demanda → orden → consumo → calidad → recepción →
costo, con pruebas de concurrencia.

#### Fase 4C — Identidad reforzada (paso 8) — *prioridad elevada*

**Recomiendo adelantarla antes que el resto de módulos sectoriales.** Razón: es
transversal, la exige toda operación regulada, y la brecha de proxy confiable
(§19.4) es un riesgo de seguridad activo, no una funcionalidad faltante.

- MFA/TOTP + códigos de recuperación.
- WebAuthn/passkeys.
- Dispositivos, sesiones, revocación de terceros.
- Reglas IP/red con **validación de proxy confiable e IPv6**.
- Segregación de funciones.

**Criterio de salida:** rechazo verificable de acceso desde red prohibida y
prueba de que `X-Forwarded-For` arbitrario no se acepta.

#### Fase 4D — Auditoría interna y controles continuos (paso 7)

Depende de que exista más superficie funcional que auditar. Ejecutar después de
4B y 4C.

#### Fase 4E — Autoauditoría e instalador (paso 9)

Alto valor y bajo acoplamiento: puede ejecutarse en paralelo. La mitad de los
checks de §22.4 ya son verificables con la infraestructura de Fase 4 (licencias,
SPDX, SBOM, procedencia, secretos, demo en producción).

#### Fase 4F — Resto sectorial (pasos 5, 6)

Transporte, flota, construcción, contratistas, agroindustria, sector público.
Solo después de validar el patrón en 4B.

#### Fase 4G — Documentación y release (pasos 10–12)

### 7.3 Reevaluación de esfuerzo

Estimación basada en la densidad real del código existente (~21 400 líneas para
3 fases):

| Subfase | Tablas nuevas | Esfuerzo relativo |
| --- | --- | --- |
| 4A Fundaciones | ~0 | Bajo |
| 4B Manufactura + calidad | ~22 | Alto |
| 4C Identidad | ~17 | Medio-alto |
| 4D Auditoría interna | ~24 | Alto |
| 4E Autoauditoría | ~5 | Medio |
| 4F Resto sectorial | ~90 | Muy alto |
| 4G Documentación | ~3 | Alto |

**La Fase 4 tal como está especificada no es una fase: son entre seis y siete.**
Tratarla como una sola unidad garantiza o incumplimiento o funcionalidad
simulada, que es exactamente lo que su §36 prohíbe.

### 7.4 Riesgos a vigilar

| Riesgo | Mitigación |
| --- | --- |
| Costeo de producción sin contabilidad | Limitar a costeo operativo; declararlo |
| Proxy confiable mal implementado | Nunca confiar en `X-Forwarded-For` sin allowlist de proxies |
| Worker insuficiente para jobs de Fase 4 | Rediseñar antes de 4D/4E |
| Datos médicos en módulo minero (§13) | No exponer detalle; solo aptitud booleana |
| IA en decisiones de personal | Prohibido por §13; mantener revisión humana obligatoria |
| Sector público simulando integración oficial | Solo adaptadores; nunca afirmar interoperabilidad |
| Deriva documentación/código | `pnpm docs:verify` debe fallar CI, no advertir |

---

## 8. Resumen ejecutivo para el agente analista

```yaml
estado_global:
  fases_completas: [1, 2, 3]   # inventario completo; salud revisada abajo
  fase_actual: 4
  progreso_fase_4: "2 de 12 pasos (17%)"
  criterios_aceptacion_fase_4: "~20 de 56 (36%), revisado a la baja"
  veredicto_verificacion_independiente: "PHASE_4_NOT_READY"
  puertas_de_preparacion: "5 de 6 en FALLO, 1 condicional, 0 en PASS"
  salud_base: >-
    NO es verde. La suite pasa solo con la base levantada; la de integracion
    sale 0 con 17 pruebas omitidas si falta DATABASE_URL. La afirmacion previa
    de '0 defectos' queda retirada: 4 defectos criticos confirmados por ejecucion.

hallazgos_criticos_confirmados_por_ejecucion:
  C-1: "app conecta a postgres como superusuario con BYPASSRLS; las 16 politicas RLS estan inertes; aislamiento solo por filtrado de aplicacion"
  C-2: "desactivar un modulo no protege ~80 endpoints de fase 1/2, y la API afirma al operador que si"
  C-3: "trustProxy incondicional permitia falsificar IP y evadir el limitador de tasa — CORREGIDO en esta revision"
  C-4: "la suite de integracion se autodesactiva y sale 0 sin DATABASE_URL; no hay CI"

fortalezas_confirmadas:
  - "direccion de dependencias limpia: domain y contracts sin framework"
  - "controladores delgados; sin reglas de negocio en React"
  - "dominio puro de fase 1/2 bien probado y correctamente cableado (IGV, transiciones, topes de pago)"
  - "ambito tenant/empresa derivado de sesion, nunca de entrada del cliente"
  - "SQL parametrizado; auditoria en la misma transaccion que la mutacion"
  - "licenciamiento, SPDX, SBOM y procedencia verificados y operativos"

debilidades:
  - "aislamiento de tenant sin respaldo de base de datos (RLS inerte)"
  - "limites de modulo no aplicados en fase 1/2 ni en el worker"
  - "capa de dominio de fase 3 es codigo muerto; sus 25 pruebas no prueban comportamiento"
  - "73 archivos de API sin pruebas, incluido auth.guard.ts; cobertura inmedible; sin CI"
  - "0 de 19 modulos sectoriales de fase 4 implementados"
  - "sin MFA, passkeys, gobierno de accesos; worker insuficiente"
  - "titularidad legal sin resolver; 7 registros de procedencia sin revision humana"

recomendacion_inmediata:
  1: "NO empezar modulos sectoriales; ejecutar subfase 4A de estabilizacion primero"
  2: "rol de postgres restringido + FORCE RLS + prueba de comportamiento (C-1)"
  3: "aplicar @RequireModule en fase 1/2 y corregir el texto de disable-impact (C-2)"
  4: "hacer que test:integration falle sin base + introducir CI (C-4)"
  5: "resolver bloqueantes de gobernanza: titularidad, procedencia, propietarios"

referencia_autoritativa: "docs/reviews/PHASE-4-READINESS-DECISION.md (prevalece sobre este documento en caso de conflicto)"

advertencia_para_planificacion: >-
  La fase 4 especificada equivale a entre seis y siete fases reales. Ademas, la
  base no esta lista: construir 19 modulos sobre RLS inerte, limites no aplicados
  y una suite que pasa sin ejecutarse multiplicaria los defectos por cada modulo.
  Estabilizar (4A) antes de cualquier vertical sectorial.
```

---

## 9. Trazabilidad de este informe

| Aspecto | Detalle |
| --- | --- |
| Método | Inspección directa del código y ejecución real de comandos |
| Comandos ejecutados | lint, typecheck, test, test:integration, test:e2e, test:compliance, build, audit, license:*, provenance:verify, sbom:generate:project, demo:verify, migración ida y vuelta |
| No verificado | Carga, rendimiento, recuperación ante desastres, despliegue remoto, proveedores externos reales |
| Revisión humana | **Pendiente** |
| Registro de procedencia (generación) | `AIP-2026-0006` |
| **Actualización 2026-07-23** | Incorporados los hallazgos de la verificación independiente (§3.6, avisos en §0, §2.1, §5.2, §6, §7.1, §8). El inventario original se conservó; la evaluación de salud se corrigió. Registro de la verificación: `AIP-2026-0007` |
| Documentos autoritativos de la verificación | `docs/reviews/EXECUTIVE-TECHNICAL-REVIEW.md`, `docs/reviews/PHASE-4-READINESS-DECISION.md`, `docs/reviews/TENANT-ISOLATION-RESULTS.md`, `docs/reviews/TRUSTED-PROXY-AND-IP-REVIEW.md` |

**Ninguna capacidad se describe como funcional sin haber sido ejecutada.** Las
marcadas `IMPLEMENTADO_NO_EJERCITADO` o `PREPARADO_APAGADO` se declaran así
precisamente porque no se verificó su operación extremo a extremo.
