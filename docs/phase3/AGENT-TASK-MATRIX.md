# Matriz de agentes — Fase 3

Estado: propuesta de coordinación para aprobación del Architecture Coordinator.
Fecha de inspección: 2026-07-23.

## Condiciones de ejecución

- La carpeta inspeccionada no contiene un repositorio Git (`git status` devuelve
  `not a git repository`). Por tanto, no hay worktrees ni ramas aisladas
  disponibles. El aislamiento debe hacerse mediante propiedad exclusiva de rutas,
  integración secuencial y revisión de diffs/archivos antes de cada transferencia.
- Ningún agente puede modificar una ruta prohibida ni un contrato compartido sin
  aprobación explícita del Architecture Coordinator.
- Los archivos de integración compartidos son propiedad temporal exclusiva del
  Architecture Coordinator: `package.json`, `.env.example`,
  `apps/api/src/app.module.ts`, `apps/web/src/App.tsx`,
  `packages/domain/src/index.ts`, `packages/contracts/src/index.ts`,
  `packages/database/src/seed.ts`, `apps/worker/src/main.ts` y los índices de
  documentación. Los especialistas entregan archivos nuevos y una propuesta de
  integración; no editan estos hotspots en paralelo.
- Las migraciones de Fase 3 se asignan a un único propietario, se numeran después
  de `0006_phase2_remaining_history_triggers` y siempre incluyen `up`, `down`,
  restricciones, índices, RLS/alcance y prueba de ida/vuelta.
- Cada agente deja un reporte bajo `docs/phase3/agent-reports/`. Un agente revisor
  diferente debe registrar el resultado antes de integrar.
- Una revisión no equivale a verificación. Sólo se marca un control como aprobado
  cuando existe un comando ejecutado y evidencia del resultado.
- No se realiza push ni publicación remota sin autorización explícita.

## Matriz de propiedad

| Agent | Scope | Allowed directories | Prohibited directories | Dependencies | Expected outputs | Required tests | Reviewing agent | Integration order |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **1 — Architecture Coordinator** | Inspección, límites, contratos compartidos, ADR, conflictos, orden e integración final | `AGENTS.md`; `docs/`; archivos de integración compartidos enumerados arriba, sólo durante ventanas exclusivas | Implementación interna de módulos cuando pertenezca a otro agente; cambios funcionales no revisados; credenciales; remoto | Línea base de Fases 1–2; reportes de agentes 2–9 | Matriz; ADR aprobados; registro de decisiones/conflictos; registro de integración; actualización coherente de arquitectura y reporte final | Antes de integrar: `pnpm typecheck`, `pnpm lint` y pruebas focalizadas. Cierre: todos los comandos de Fase 3, build, bundle y secretos | **8 — QA**, con gates adicionales de **3**, **4** y **5** | **0** planificación y congelamiento de contratos; luego **10** integración final |
| **2 — Domain and ERP** | Agregados, invariantes, estados, casos de uso y eventos de CRM, proyectos, tiempo/gastos, HR, SST, activos y mantenimiento | `packages/domain/src/phase3/`; `packages/domain/src/*.test.ts` nuevos de Fase 3; `modules/crm/`; `modules/projects/`; `modules/time-and-expenses/`; `modules/human-resources/`; `modules/occupational-safety/`; `modules/assets/`; `modules/maintenance/`; borradores de `docs/DOMAIN-MODEL.md`, `docs/CRM.md`, `docs/PROJECTS.md`, `docs/HUMAN-RESOURCES.md`, `docs/OCCUPATIONAL-SAFETY.md`, `docs/ASSETS-AND-MAINTENANCE.md` | `migrations/`; `apps/web/`; `packages/security/`; infraestructura de proveedores; hotspots compartidos | Contrato de identificadores/eventos aprobado por **1**; esquema lógico acordado con **3**; clasificación HR/médica acordada con **4** | Modelos sin dependencia de Nest/Postgres/proveedores; máquinas de estado; eventos; casos de uso; pruebas unitarias; reporte 02 | Transiciones CRM; conversión de oportunidad; progreso y presupuesto; aprobaciones de tiempo/gasto; ciclo laboral/contratos; riesgo SST/cierre con evidencia; asignación/mantenimiento | **3 — Database** para persistencia y **8 — QA** para invariantes; **4 — Security** para límites médicos | **2**, después de contratos; integración antes de API/UI |
| **3 — Database and Performance** | Diseño físico, migraciones, índices, RLS, concurrencia, retención, vistas, datasets representativos, backup/restore | `migrations/0007*` y posteriores reservadas a Fase 3; `packages/database/src/phase3/`; `tests/integration/phase3*.test.ts`; `tests/performance/`; `docs/DATABASE.md`, `docs/BACKUP-AND-RESTORE.md`, anexos DB del reporte 03 | `apps/web/`; lógica de dominio; UI; proveedores; migraciones 0001–0006 salvo corrección bloqueante aprobada | Modelo de **2**; clasificación/retención de **4** y **5**; contratos de configuración/demo aprobados por **1** | Migraciones `up/down`; constraints e índices; RLS; pruebas de concurrencia/planes; seed representativo acotado; validación documentada de backup/restore; reporte 03 | Migración limpia y sobre Fase 2; rollback/reapply; tenant/company isolation; constraints; concurrencia; EXPLAIN de consultas críticas; backup/restore; dataset sin carga completa en navegador | **4 — Security** para RLS/datos sensibles y **8 — QA** para migración/upgrade | **3**, una vez congelado el modelo; único escritor de migraciones |
| **4 — Security and Privacy** | Threat model, authn/authz, aislamiento, clasificación, secretos/cifrado, headers, OWASP, eventos, respuesta a incidentes, controles AI/OCR/demo | `packages/security/src/`; `tests/security/`; archivos nuevos focalizados bajo `apps/api/src/security/`; `modules/privacy-governance/`; `docs/SECURITY.md`, `docs/THREAT-MODEL.md`, `docs/PRIVACY.md`, `docs/DATA-RETENTION.md`, `docs/INCIDENT-RESPONSE.md`; reporte 04 | Migrations (revisión solamente); UI de negocio; documentos legales sustantivos; secretos reales; bypass de guard global | Arquitectura de **1**; esquema de **3**; requisitos legales de **5**; contratos AI/OCR de **7**; demo de **9** | Modelo de amenazas y matriz de datos; políticas de acceso/reautenticación/redacción; eventos de seguridad; revisión de RLS y providers; reporte 04 | IDOR; cross-tenant/company; escalación; archivos hostiles; secretos/redacción; audit tampering; medical access; AI injection/tool manipulation; demo reset en producción; retención sin aprobación | **8 — QA**; requisitos legales contrastados por **5** | **4a** diseño antes de módulos sensibles; **8a** revisión antes de integración |
| **5 — Legal and Compliance** | Fuentes oficiales peruanas, matriz requisito-control, documentos versionados, aceptación/consentimiento, derechos, transparencia AI, disclaimers demo, licencias/avisos | `modules/legal-compliance/`; contenido nuevo bajo `docs/legal/`; `docs/LEGAL-COMPLIANCE.md`, secciones legales de `docs/PRIVACY.md`, `docs/AI-GOVERNANCE.md`, `docs/DEMO-ENVIRONMENT.md`; fixtures legales sintéticos; reporte 05 | Configuración de seguridad; migraciones; implementación AI/OCR; afirmaciones de garantía; edición in-place de versiones publicadas | Consulta de fuentes oficiales con fecha; arquitectura de documentos de **1**; privacidad de **4**; proveedor/AI de **7**; demo de **9** | Matriz fuente-requisito-control-evidencia; textos configurables y disclaimers; flujo de publicación/aceptación; inventario de asuntos para asesoría legal; reporte 05 con aviso de no sustitución de asesoría | Versionado/publicación; evidencia de aceptación; retiro de consentimiento; historial inmutable; flujo de solicitud; legal hold; presentación/versiones; disclaimers demo/AI | **4 — Security and Privacy** para tratamiento de datos y **8 — QA** para flujos | **1b** mapeo temprano; **8b** revisión de pantallas antes de integrar |
| **6 — Frontend and Mobile** | Control plane, pantallas funcionales, navegación por permisos/módulos, PWA, móvil, accesibilidad, borradores offline y rendimiento visual | `apps/web/AGENTS.md`; `apps/web/src/features/phase3/`; nuevos componentes/páginas de Fase 3 bajo `apps/web/src/`; `apps/web/src/drafts*.ts`; `apps/web/public/` sin secretos; pruebas E2E/UI focalizadas; documentación móvil; reporte 06 | API, dominio, migraciones, worker, secretos, decisiones legales no aprobadas; `apps/web/src/App.tsx` salvo ventana exclusiva de integración | OpenAPI/DTO y permisos de **1/2**; endpoints de módulos; revisión legal de **5**; restricciones sensibles de **4** | Rutas lazy; estados loading/error/empty/pending; flujos móvil; IndexedDB versionado sin tokens ni detalle médico; accesibilidad; sin overflow; reporte 06 | Viewports desktop/Pixel 7/WebKit; teclado/foco/labels; no overflow; PWA instalable; drafts/conflictos/cuota/caducidad; guards de navegación; bundle/lazy loading | **8 — QA** y **5 — Legal** para superficies legales; **4 — Security** para offline/secretos | **6**, después de contratos API estables; montaje en `App.tsx` por **1** |
| **7 — AI, OCR and Provider** | Interfaces/adaptadores AI/OCR/maps, provider management, jobs, tool registry, policy/redaction, inyección, confirmación humana, observabilidad de uso | `packages/contracts/src/phase3/`; `modules/artificial-intelligence/`; `modules/ocr/`; `modules/provider-management/`; `modules/maps/`; archivos nuevos bajo `apps/api/src/phase3/{ai,ocr,providers,maps}/`; worker jobs nuevos no montados; `docs/AI-PROVIDERS.md`, `docs/AI-GOVERNANCE.md`, `docs/OCR.md`, `docs/MAPS.md`; reporte 07 | Contratos existentes compartidos sin aprobación; UI general; migraciones; secretos reales; SQL irrestricto; creación final automática de registros financieros | Contratos aprobados por **1**; tablas de **3**; clasificación/políticas de **4**; transparencia de **5** | Interfaces locales/cloud reemplazables; mock explícitamente rotulado; timeouts/circuit breaker; OCR reviewable; tool registry limitado; citas/traza; kill switch; reporte 07 | OCR confianza/duplicado/archivo; confirmación humana; AI deshabilitada; permisos de tools; redacción; presupuesto; fallo proveedor; prompt injection; exfiltración; map fallback | **4 — Security and Privacy** obligatorio; **8 — QA** adversarial; **5 — Legal** para notice/copy AI | **5**, después de schema y security policy; montaje API/worker por **1** |
| **8 — QA and Adversarial Review** | Estrategia y ejecución de unit/integration/E2E/security/performance/mobile/accessibility/upgrade/demo; revisión independiente | `tests/`; `scripts/phase3-verify*`; fixtures sintéticos; `docs/TESTING.md`; `docs/phase3/verification/`; reporte 08 | Código de producto, migraciones y contratos salvo corrección separada y reasignada; credenciales; reducción de assertions para “hacer pasar” pruebas | Entregables de todos los agentes; entornos y seed reproducibles; matriz de aceptación | Plan trazable a 53 criterios; resultados con comando/fecha/salida; defectos y re-test; lista de claims no verificados; reporte 08 | Suite previa; todos los tests exigidos en §36; typecheck/lint/build/bundle/secrets; package smoke; consola/logs; performance representativo | **1 — Architecture Coordinator** revisa cobertura, pero no puede autoaprobar defectos de su integración | **1a** baseline; revisiones continuas; **9** gate final antes de release |
| **9 — Demo and Release** | Tenant demo aislado, perfiles/escenarios/seed/reset, paquete portable, manifests, SBOM/licencias, smoke y reporte de release | `modules/demo-management/`; `deployment/demo/`; `scripts/demo/`; `packages/database/src/phase3/demo*`; `docs/DEMO-ENVIRONMENT.md`, `docs/PORTABLE-DEMO.md`, artefactos bajo `artifacts/demo/`; reporte 09 | Datos reales; secretos; producción; migraciones; publicación remota sin autorización; claims comerciales/legales no aprobados | Guard de entorno de **4**; schema/seed hooks de **3**; módulos estables; textos de **5**; QA de **8** | Tres escenarios sintéticos; reset idempotente/aislado; paquete y checksum; instrucciones Win/Linux/macOS; SBOM/licencias; limitaciones; reporte 09 | Reset demo y rechazo en producción; snapshot restore; límites; clean startup; smoke; secrets scan del artefacto; checksum; licencias/SBOM; escenarios | **4 — Security** para aislamiento, **5 — Legal** para disclaimers y **8 — QA** para package smoke | **7**, después de módulos integrados; release sólo tras gate de **8** |

## Secuencia de integración y gates

1. **Baseline QA:** Agent 8 ejecuta la línea base de Fases 1–2 y registra cualquier
   bloqueo sin atribuirlo a Fase 3.
2. **Congelamiento arquitectónico:** Agents 1, 2, 3, 4, 5 y 7 acuerdan los
   contratos compartidos y ADR indicados abajo.
3. **Dominio y datos:** Agent 2 entrega invariantes; Agent 3 materializa el esquema
   y Agent 4 revisa aislamiento/clasificación antes de aplicar migraciones.
4. **Plataforma administrativa:** configuración, flags, perfiles y providers se
   integran primero porque habilitan el resto de módulos.
5. **Operación:** CRM/proyectos; luego HR/SST; después activos/mantenimiento.
6. **Providers:** OCR; después AI; luego mapas, reglas y notificaciones. AI no se
   habilita hasta aprobar la política de tools y clasificación.
7. **Legal/privacidad:** se integran flujos versionados y sus pantallas sólo con
   revisión Agents 4 y 5.
8. **Demo:** Agent 9 construye sobre módulos ya estabilizados; jamás introduce un
   camino alternativo que omita permisos o guards.
9. **Integración de hotspots:** Agent 1 monta módulos en API/web/worker y actualiza
   manifests en ventanas exclusivas, una entrega a la vez.
10. **Gate final:** Agent 8 ejecuta la matriz completa. Agent 1 cierra únicamente
    cuando no quedan conflictos ni pruebas fallidas.

## Contratos compartidos que requieren aprobación previa

No puede comenzar implementación dependiente hasta que el Architecture Coordinator
registre la versión aprobada de cada contrato:

1. **Identidad y alcance:** tipos estables de `TenantId`, `CompanyId`, `UserId`,
   `BranchId`, propagación del contexto autenticado y regla de que el navegador no
   elige tenant/company autoritativos.
2. **Registro de módulos:** códigos, dependencias, versión, estado implementado,
   health, provider requirements y semántica de desactivación que conserva datos.
3. **Permisos:** catálogo granular completo de Fase 3 y convención
   `modulo.recurso.acción`; el feature flag nunca concede autorización.
4. **Eventos/outbox:** envelope con evento, agregado, tenant, company, versión,
   actor, correlación, idempotencia y política de datos sensibles.
5. **Errores/API:** envelope versionado, request ID, códigos de dominio,
   paginación/filtros, idempotencia y redacción; no stack trace productivo.
6. **Configuración y aprobación:** `ConfigurationVersion`,
   `ConfigurationChange`, `ConfigurationApproval`, optimistic concurrency,
   export/restore y four-eyes para cambios de alto riesgo.
7. **Providers:** lifecycle, capabilities, health, timeout, cancellation,
   circuit-breaker, uso, secret reference/redaction y modos
   `DISABLED`, `MANUAL`, `LOCAL`, `MOCK`, `CLOUD`.
8. **Clasificación de datos:** niveles, finalidades, acceso, logs, exportación,
   retención y separación de aptitud/restricción frente a detalle médico.
9. **OCR:** estados del job, campos/confianza, corrección, duplicados, provenance
   y handoff que sólo crea un borrador tras confirmación humana.
10. **AI tools:** input/output tipado, permisos, scope, clasificación permitida,
    límite de filas/contexto, lectura por defecto, confirmación para acciones,
    citations y registro; nunca SQL o scripting irrestricto.
11. **Demo reset:** identificador de entorno/tenant, doble guard de
    `APP_ENVIRONMENT` + `DEMO_RESET_ENABLED`, límites, snapshot, idempotencia y
    auditoría.
12. **Observabilidad:** `MetricsProvider`, `TraceProvider` y
    `ErrorReportingProvider`, correlación request/job/provider y lista de campos
    prohibidos en logs.

## Conflictos potenciales y resolución

| Hotspot | Agentes en conflicto | Regla de resolución |
| --- | --- | --- |
| `packages/domain/src/index.ts` y registro de módulos | 1, 2, 6, 9 | Agent 2 entrega exports/definiciones en archivo nuevo; Agent 1 integra después de revisar dependencias. |
| `packages/contracts/src/index.ts` | 1, 4, 7 | Agent 7 propone contratos en `phase3/`; Agents 1 y 4 aprueban; Agent 1 exporta. |
| Migraciones/seed | 2, 3, 4, 5, 9 | Agent 3 es único escritor de migraciones; Agent 9 sólo agrega seed demo en archivo separado; Agent 4 revisa RLS/sensibles. |
| `apps/api/src/app.module.ts` | 2, 4, 7, 9 | Especialistas crean módulos autocontenidos; Agent 1 registra imports/providers/controladores secuencialmente. |
| `apps/web/src/App.tsx` y navegación | 5, 6, 7, 9 | Agent 6 entrega rutas lazy en un manifiesto de feature; Agent 1 realiza el montaje final tras revisión legal/security. |
| `apps/worker/src/main.ts` | 3, 7, 9 | Jobs en archivos separados; Agent 1 registra uno por uno y Agent 8 prueba que módulos deshabilitados no ejecuten jobs. |
| `.env.example`, `package.json`, scripts | 1, 4, 7, 8, 9 | Cada agente propone claves/comandos; Agent 1 integra; Agent 4 revisa secretos y Agent 8 ejecuta. |
| Documentos de privacidad/AI/demo | 4, 5, 7, 9 | Agent 5 controla afirmaciones legales; Agent 4 controla tratamiento; Agent 1 resuelve contradicciones y conserva limitaciones. |

Un conflicto no resuelto se registra como bloqueo; nunca se elige silenciosamente
una de dos definiciones incompatibles.

## ADR propuestos

Los siguientes ADR deben redactarse y aprobarse antes del módulo dependiente:

- **ADR-003 — Límites de Fase 3 en el monolito modular:** estructura de módulos,
  dirección de dependencias y montaje API/web/worker sin microservicios.
- **ADR-004 — Configuración versionada y four-eyes:** optimistic locking,
  approvals, export/restore y auditoría de cambios sensibles.
- **ADR-005 — Proveedores y secretos:** interfaces hexagonales, secret references,
  health, modos operativos, timeouts y circuit breaker.
- **ADR-006 — Clasificación y separación de datos HR/SST:** modelo de acceso,
  aptitud/restricciones, detalle médico segregado y retención.
- **ADR-007 — OCR con revisión humana:** provenance, confianza, correcciones,
  duplicados y creación exclusiva de borradores.
- **ADR-008 — AI mediante tools controladas:** registro tipado, policy engine,
  redacción, bounded context, prompt-injection boundary y kill switch.
- **ADR-009 — Aislamiento y reset de demo:** tenant dedicado, doble guard de
  entorno, snapshots, límites, datos sintéticos y paquete sin secretos.
- **ADR-010 — Observabilidad reemplazable y segura:** interfaces provider-neutral,
  correlación y exclusión de PII/finanzas/salud/secretos.
- **ADR-011 — Estrategia de migraciones de Fase 3:** bloques numerados,
  reversibilidad, RLS, índices, concurrencia y validación de upgrade/restore.

## Definition of done por entrega

Una entrega sólo queda lista para integración si:

- respeta la propiedad de rutas y los contratos aprobados;
- incluye reporte del implementador y revisión de otro especialista;
- añade pruebas proporcionales al riesgo y conserva las pruebas previas;
- documenta datos sensibles, permisos, auditoría e idempotencia aplicables;
- no contiene secretos, PII real, `any`, SQL/herramientas AI irrestrictas ni
  afirmaciones de cumplimiento garantizado;
- registra limitaciones y conflictos pendientes;
- adjunta comandos realmente ejecutados y sus resultados.

