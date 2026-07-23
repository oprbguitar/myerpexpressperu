# Informe del Agente 3 — Database and Performance

Fecha: 2026-07-23  
Responsabilidad: diseño físico, migraciones, RLS, rendimiento y backup/restore.

## Resultado

Se implementaron cuatro migraciones transaccionales y reversibles, numeradas
`0007`–`0010`, sin modificar `0001`–`0006` ni las semillas existentes. Cubren
las 124 tablas obligatorias de la sección 27 y agregan una tabla adicional para
aislar el payload médico cifrado.

Tras revisión de Seguridad se añadió
`0011_phase3_security_hardening`, también reversible y sin editar migraciones
anteriores. Incorpora:

- FKs compuestas `(id, tenant_id, company_id)` para detalle médico/examen,
  configuración/definición de proveedor, OCR/documento,
  aceptación/versión legal, consentimiento/versión y reset/perfil-snapshot demo.
- `legal_acceptance_revocations` y `consent_withdrawals` como eventos
  append-only con RLS y referencia compuesta al ámbito original.
- vistas de estado efectivo `security_invoker=true` para no actualizar
  aceptación o consentimiento ni omitir el RLS del llamador.

| Migración | Tablas y controles principales |
|---|---|
| `0007` | Control administrativo, CRM y proyectos; aprobación/versionado, estados, tableros e índices de vencimiento |
| `0008` | RR. HH., SST, activos y mantenimiento; datos médicos separados y acceso RLS adicional |
| `0009` | OCR, IA, mapas y workflows; revisión humana, clasificación, presupuestos, herramientas limitadas e historial append-only |
| `0010` | Legal, privacidad, retención, proveedores, demo y observabilidad; versiones publicadas inmutables, secretos protegidos y reinicio demo con guardas múltiples |

Todos los agregados empresariales nuevos incluyen `tenant_id`, `company_id`,
timestamps y `version`. Se habilitó RLS en todas las tablas. Las políticas
especiales de detalle médico y configuración de proveedores requieren además un
flag de sesión que debe establecer la API tras autorizar.

## Verificación ejecutada

Base aislada: `erp_phase3_verify` en PostgreSQL 17 local.

| Prueba | Resultado |
|---|---|
| Aplicación limpia `0001`–`0010` | PASS |
| Comparación automática de lista §27 contra `CREATE TABLE` | PASS: 124/124, sin faltantes |
| Rollback `0010`→`0007` y reaplicación | PASS |
| `tests/integration/phase3-database.test.ts` | PASS: 7/7, antes y después del rollback/reapply final |
| RLS con rol no propietario y dos empresas | PASS: 1 fila visible de 2 |
| Backup custom y restore a base vacía | PASS |
| Restore representativo (tablas/migraciones/leads) | 207 / 10 / 5.002 |
| Restore estructural final (tablas/migraciones/políticas RLS) | 207 / 10 / 187 |

## Revisión de Seguridad — `0011`

| Prueba | Resultado |
|---|---|
| Instalación limpia `0001`–`0011` | PASS |
| Upgrade de base de desarrollo `0010`→`0011` | PASS |
| Rollback/reapply aislado de `0011` | PASS |
| Suites DB + hardening en base temporal | PASS: 10/10 |
| Suites DB + hardening sobre upgrade actual con `.env` | PASS: 10/10 |
| Referencias cross-company OCR/provider/médico/legal/consent/demo | Rechazadas |
| Revocación y retiro cross-company | Rechazados |
| Mutación de aceptación, consentimiento y eventos | Rechazada |
| Vistas de estado efectivo tras eventos | `active=false` |
| Catálogo actual después de `0011` | 211 relaciones tipo tabla/vista, 11 migraciones, 189 políticas RLS |

El rol temporal, los dumps y ambas bases temporales se eliminaron al terminar.

## Rendimiento representativo

Dataset sintético temporal: 5.002 leads, 200 proyectos y 5.000 tareas.

- Bandeja de leads calificados por ámbito: `Bitmap Index Scan` sobre
  `leads_pipeline_search`; 1.000 candidatos, 50 filas devueltas, ~0,99 ms.
- Tareas abiertas de proyecto: índice `project_tasks_board`; 19 filas, ~0,81 ms.

Los tiempos son una observación local en caliente, no un SLA. El navegador no
debe cargar estos conjuntos completos: la API debe paginar y limitar.

## Revisión de seguridad solicitada

- Confirmar que el despliegue usa un rol PostgreSQL no propietario sin
  `BYPASSRLS`.
- Verificar que `app.medical_access` y `app.provider_secret_access` solo se
  establezcan después de autorización y con `SET LOCAL`.
- Revisar la prohibición de claves sensibles dentro de
  `non_secret_settings`.
- Ejecutar prueba negativa de guardas demo desde API/worker.
- Confirmar que el fingerprint de runtime se obtiene de configuración confiable
  del despliegue y no del navegador.
- Revisar política de retención de `ai_interactions`, OCR, métricas y eventos
  antes de una liberación.

## Revisión final de limpieza/reset demo

Fecha de revisión: 2026-07-23.  
Alcance: revisión estática de `packages/database/src/phase3/demo-seed.ts`,
guardas, Compose y catálogo PostgreSQL actual. No se modificó la
implementación.

**Dictamen del agente de Base de Datos: FAIL para el gate final de reset.**

La identidad de la base y el aislamiento del tenant están bien defendidos, pero
el mecanismo de limpieza desactiva precisamente los controles de integridad e
inmutabilidad que el esquema declara y no preserva todas las historias
append-only. Debe corregirse y repetirse el reset real antes de aprobar
distribución.

| Control revisado | Resultado | Evidencia y observación |
|---|---|---|
| Selección de tablas | PASS | `resetScenarioRows` cruza `information_schema.columns` con `information_schema.tables` y exige `table_type='BASE TABLE'`; las vistas no entran en la limpieza. El identificador dinámico además se valida con `^[a-z][a-z0-9_]*$`. |
| Aislamiento de tenant | PASS condicionado | Cada `DELETE` usa `WHERE tenant_id=$1` con el UUID demo reservado. Las guardas exigen entorno, flag, tenant, prefijo `demo-`, base exacta, fingerprint y perfil. No filtra `company_id`: borrará todas las compañías del tenant demo si en el futuro existe más de una. |
| Base dedicada | PASS | Compose usa `erp_express_demo`, volumen y red nominados para demo; PostgreSQL no publica puerto al host. |
| `session_replication_role` | **FAIL bloqueante** | La limpieza ejecuta `SET LOCAL session_replication_role=replica`. Esto requiere privilegio elevado y desactiva triggers y FKs durante todos los deletes dinámicos. El usuario creado por la imagen PostgreSQL es también el usuario utilizado por migración, API y reset, por lo que el reset opera con privilegios de propietario/superusuario. |
| Restauración del rol de replicación | PASS transaccional | En éxito vuelve a `origin`. En error no lo hace explícitamente, pero la excepción fuerza rollback de la transacción exterior y revierte el `SET LOCAL`. |
| Preservación de auditoría primaria | PASS | Se excluyen `audit_events`, `security_events`, `audit_integrity_checkpoints`, `demo_reset_jobs` y `demo_reset_history`. |
| Preservación de historiales append-only | **FAIL bloqueante** | La lista no preserva `legal_acceptance_revocations`, `consent_withdrawals`, `legal_acceptances`, `consent_records`, `provider_usage_records`, `ai_tool_calls`, `ocr_corrections`, movimientos financieros/stock ni otros historiales con triggers de inmutabilidad. Al usar modo `replica`, sus triggers quedan desactivados y las filas del tenant se eliminan. La afirmación genérica de “preservación de historiales” solo es cierta para la lista explícita. |
| Registro de reset fallido | **FAIL bloqueante** | `demo_reset_jobs` se inserta dentro de la misma transacción que limpieza y reseed. Si algo falla, el job también revierte; queda log de proceso, pero no evidencia durable en `demo_reset_jobs`, `demo_reset_history` o `security_events`. |
| Integridad después del reseed | PASS parcial | Limpieza, identidad, seed Fase 2, seed Fase 3, checksum y conteo ocurren en una transacción. Sin embargo, el conteo solo prueba cantidad de filas del tenant en tablas no preservadas; no ejecuta una validación posterior de FKs porque fueron omitidas durante el borrado. |
| Secuencias | PASS / no aplicable | El catálogo actual no contiene secuencias en `public`; las claves son UUID y no hay `serial`, `identity` ni `nextval`. No corresponde `setval` o `RESTART IDENTITY`. Debe revisarse de nuevo si una migración futura introduce secuencias. |

### Bloqueantes antes de aprobar

1. Sustituir la limpieza bajo `session_replication_role=replica` por un plan
   explícito y revisable de tablas reseteables, ordenado por dependencias, con
   FKs y triggers activos. Si se mantiene una excepción, debe ejecutarse con un
   rol exclusivo de mantenimiento, no con la credencial compartida por API.
2. Definir por política qué historias sobreviven a un reset. Como mínimo no
   debe poder borrarse silenciosamente evidencia legal, privacidad, seguridad,
   integridad ni historia de resets. La allowlist de preservación debe incorporar
   las tablas de `0011` o el reset debe operar sobre un esquema/base recreable
   completa conservando la bitácora fuera de ella.
3. Persistir un evento de intento/fallo fuera de la transacción destructiva o en
   una bitácora externa, sin marcar éxito hasta completar reseed y verificaciones.
4. Añadir una prueba negativa que inserte una segunda compañía en el mismo
   tenant demo y demuestre el alcance decidido; añadir también fixtures en cada
   tabla append-only para verificar exactamente cuáles sobreviven.
5. Ejecutar una comprobación posterior de integridad referencial y de conteos por
   escenario, además del conteo agregado actual.

### Segunda revisión posterior a correcciones

Fecha: 2026-07-23. Esta revisión sustituye el estado de los cinco bloqueantes
anteriores.

**Dictamen actualizado: FAIL con un único bloqueante de preservación.**

| Corrección informada | Resultado de revisión |
|---|---|
| Roles admin/runtime/reset separados | PASS. API y worker usan `erp_demo_runtime`; reset usa `erp_demo_reset`; migración/seed conservan el administrador. |
| Runtime/reset sin privilegios elevados | PASS. Ambos se crean `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`; solo reset recibe `GRANT SET ON PARAMETER session_replication_role`. |
| Alcance de exactamente una empresa | PASS. Antes del job, `resetAll` exige una sola fila en `companies` para el tenant y que sea el UUID reservado. |
| Registro durable de fallo | PASS condicionado. El `catch` abre una segunda transacción y registra un job `failed` cuando el perfil demo válido sigue disponible; el error original no queda oculto. Fallos de conectividad o de identidad que impidan ese segundo insert solo pueden quedar en logs. |
| Padres y eventos legal/consent preservados | PASS. Se preservan documentos/versiones/aceptaciones/revocaciones y propósitos/versiones/registros/retiros. |
| Historial de solicitudes de privacidad | **FAIL bloqueante.** La allowlist contiene `privacy_request_history`, pero esa tabla no existe. La tabla real creada por `0010` es `privacy_request_actions`; no está preservada, por lo que el reset la elimina mientras conserva `privacy_requests`. Esto pierde el historial de acciones de la solicitud. |
| Comprobación de huérfanos | PASS para el límite preservado. Después del reseed comprueba revocación→aceptación→versión legal y retiro→consentimiento→versión, con tenant/empresa compuestos. |
| Orden de storage | PASS. Los scripts ejecutan primero el reset DB y después `storage-reset`; MinIO ya no ignora el error de borrado y verifica bucket vacío. |
| `BASE TABLE` y secuencias | PASS. Se conserva el filtro `BASE TABLE`; el catálogo continúa sin secuencias de aplicación. |
| Evidencia Docker positiva/negativa | PASS según ejecución registrada por Demo/Release: rechazo con segunda compañía, job `failed` durable, reset positivo, cero huérfanos y storage vacío. |
| Verificación estática actual | PASS: `pnpm demo:verify`; 7 marcadores generados y 34 archivos sin hallazgos de secretos. |

Para aprobar el gate falta corregir la allowlist para preservar
`privacy_request_actions` (o definir y migrar una tabla de historia distinta),
repetir el reset Docker con una acción de privacidad fixture y verificar que
request y acciones sobreviven juntos. No se modificó la implementación durante
esta revisión.

### Cierre final de Base de Datos

Fecha: 2026-07-23.

**Dictamen final: PASS para la estrategia de limpieza/reset de la demo local.**

La allowlist ahora contiene el nombre real `privacy_request_actions`; no quedan
referencias a `privacy_request_history`. Se verificó correspondencia exacta con
la tabla creada por `0010` y con la lista RLS. Por tanto, solicitud y acciones de
privacidad quedan preservadas junto con los eventos append-only legales y de
consentimiento.

La comprobación final ejecutada fue:

- inspección estática del código y migración: PASS;
- `pnpm demo:verify`: PASS;
- 7 marcadores de secretos generables;
- 34 archivos revisados, 0 hallazgos de secretos.

La evidencia Docker positiva/negativa citada arriba corresponde a la ejecución
integral anterior a esta última corrección nominal. El cambio final solo sustituye
el identificador inexistente por la tabla ya migrada y no altera el algoritmo de
reset. Una repetición Docker con fixture en `privacy_request_actions` sigue
siendo una buena prueba de regresión para QA, pero ya no existe un bloqueante de
diseño o implementación identificado por Base de Datos.

## Riesgos residuales

1. Las FKs históricas de Fases 1–2 no siempre son compuestas por ámbito. Los
   casos de uso y RLS deben seguir filtrando tenant/empresa; una futura
   migración de endurecimiento requiere análisis de datos existentes.
2. `version` habilita concurrencia optimista, pero cada repositorio debe usarla
   explícitamente en el `WHERE`; la columna sola no evita lost updates.
3. El cifrado real depende del gestor de claves/adaptador. La base impide
   columnas de secreto o diagnóstico en texto plano, pero no implementa KMS.
4. Las referencias polimórficas (`entity_type`, `entity_id`) no pueden tener FK
   directa; se validan en casos de uso.
5. La evidencia backup/restore es local; faltan pruebas periódicas del entorno
   elegido, objetos, PITR y objetivos RPO/RTO.
