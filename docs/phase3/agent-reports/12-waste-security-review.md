# Revisión de Seguridad — módulo de gestión de residuos

**Agente:** Revisor obligatorio de Seguridad
**Fecha:** 27 de julio de 2026
**Alcance:** `packages/domain/src/waste-management*`,
`packages/database/src/seed.ts`, API y frontend de `waste-management`,
registro/ownership del módulo, migraciones `0014` y `0015`, y pruebas
específicas del módulo.
**Cambios de código realizados por este agente:** ninguno.

## Dictamen actual

**PASS de Seguridad, limitado al seguimiento operativo interno implementado.**

Las correcciones cierran los hallazgos inmediatos de mayor riesgo:

- el servicio de avance no permite `DOCUMENTARY_CLOSURE` y responde con un
  conflicto HTTP controlado;
- el contrato de avance ordinario ya no acepta `evidenceDocumentId`;
- la UI no ofrece la acción de cierre y declara que el flujo aún no está
  habilitado;
- el evento inicial usa la hora del servidor;
- una fecha de generación superior a cinco minutos en el futuro es rechazada;
- la creación de excepciones usa idempotencia, auditoría y outbox dentro de la
  misma transacción;
- el rol `erp_app` ya no tiene `DELETE` sobre las tablas del módulo ni `UPDATE`
  sobre los eventos de ciclo de vida.

La prueba E2E de seguridad se reejecutó contra la API reconstruida y recargada:
pasó `2/2`, incluido cierre rechazado con `409`, replay idempotente de excepción
con `201/201` y avance concurrente con `201/409`.

Este dictamen tampoco aprueba el módulo como cadena regulatoria, cumplimiento
ambiental ni cierre documental. El alcance implementado sigue siendo registro
y seguimiento operativo interno hasta destino final. La aprobación final de
integración continúa sujeta a la ejecución completa de los comandos
obligatorios de `AGENTS.md` por el coordinador.

## Controles verificados

### Ámbito, RLS e IDOR

- Los endpoints no aceptan `tenant_id` ni `company_id` desde el navegador.
- El servicio deriva tenant, empresa y usuario de `request.auth`.
- Las consultas SQL están parametrizadas y añaden ámbito explícito de tenant y
  empresa.
- Las mutaciones usan `scopedTransaction`, por lo que heredan el contexto RLS
  de la sesión.
- Las tablas `waste_records`, `waste_lifecycle_events` y `waste_exceptions`
  tienen RLS habilitado y forzado, con `USING` y `WITH CHECK`.
- La prueba de comportamiento RLS se ejecutó con `erp_app` sin `SUPERUSER` ni
  `BYPASSRLS`: permitió leer el registro propio, ocultó el registro de otro
  tenant/empresa y rechazó la escritura fuera de ámbito.

### Autorización y módulos

- Todos los endpoints del controlador tienen permisos API; la visibilidad de
  botones en React no es el único control.
- El controlador declara `@OwnedByModule("waste-management")`.
- El registro de ownership contiene la ruta y el controlador del módulo.
- El guard comprueba que el módulo esté implementado y habilitado para la
  empresa de la sesión.
- `DOCUMENTARY_CLOSURE` se rechaza en `WasteService` mediante
  `ConflictException`. No existe endpoint alternativo de cierre en esta
  entrega.
- El schema del avance ordinario solo acepta fase, versión y notas; una
  propiedad `evidenceDocumentId` enviada por el cliente es descartada por Zod y
  no llega al caso de uso.
- La UI no presenta un botón de cierre y comunica que faltan aprobación y
  evidencia vinculada.

### Integridad, concurrencia e idempotencia

- La generación valida textos, cantidad decimal positiva, unidad, fecha ISO y
  tolerancia máxima de cinco minutos hacia el futuro.
- `generated_at` conserva la fecha de negocio, mientras el evento inicial deja
  que PostgreSQL asigne `occurred_at` con la hora del servidor.
- Los avances solo permiten la fase consecutiva, bloquean registros cerrados y
  usan `version` más `FOR UPDATE`.
- Los avances ordinarios escriben `evidence_document_id = null`; no pueden
  asociar un documento arbitrario ni usarlo para simular cierre.
- Crear registro, avanzar y crear excepción exigen `Idempotency-Key`.
- La excepción completa la clave idempotente y publica
  `WasteExceptionCreated` en la misma transacción que el registro y la
  auditoría.
- Durante el E2E, dos envíos de la misma excepción devolvieron el mismo
  resultado, y dos avances concurrentes produjeron un éxito y un conflicto.

### Auditoría, exposición y frontend

- Creación, avance y excepción escriben eventos de auditoría con actor,
  tenant, empresa y request ID derivados de la petición.
- Creación, avance y excepción publican eventos outbox con ámbito.
- No se encontraron secretos, IDs de ámbito ni SQL sin parámetros expuestos por
  el módulo.
- Los textos de usuario se renderizan mediante interpolación React; no existe
  `dangerouslySetInnerHTML` ni construcción manual de HTML.
- El módulo no implementa carga de archivos. Esto evita una nueva superficie de
  upload, pero también significa que no hay un flujo ordinario de evidencia ni
  cierre.

### Privilegios de base de datos

La migración `0015_waste_privileges_hardening` revoca los privilegios heredados
de `0014` y concede:

| Tabla                    | Privilegios de `erp_app`     |
| ------------------------ | ---------------------------- |
| `waste_records`          | `SELECT`, `INSERT`, `UPDATE` |
| `waste_lifecycle_events` | `SELECT`, `INSERT`           |
| `waste_exceptions`       | `SELECT`, `INSERT`, `UPDATE` |

La consulta a `information_schema.role_table_grants` sobre la base local
confirmó exactamente esa matriz. No apareció `DELETE`.

## Pruebas ejecutadas en esta revisión

```text
pnpm --filter @erp/domain test -- waste-management.test.ts
PASS — 1 archivo, 5 pruebas

node --env-file-if-exists=.env ./node_modules/vitest/vitest.mjs run \
  tests/integration/waste-management.test.ts
PASS — 1 archivo, 3 pruebas

node --env-file-if-exists=.env ./node_modules/vitest/vitest.mjs run \
  tests/integration/rls-isolation.test.ts
PASS — 1 archivo, 7 pruebas

pnpm test:e2e -- tests/e2e/waste-management.spec.ts \
  --project=desktop-chromium
PASS — 2 pruebas
```

El E2E comprobó:

- replay idempotente de la excepción (`201`, `201`, mismo payload);
- concurrencia de avance (`201`, `409`);
- cierre ordinario rechazado (`409`);
- rechazo sin sesión (`401`).

## Condiciones de mantenimiento del dictamen

1. Mantener el cierre deshabilitado hasta que exista un caso de uso separado
   con aprobación, segregación de funciones y evidencia realmente vinculada.
2. Ejecutar la suite obligatoria completa del repositorio antes de integrar.
3. Ejecutar también los proyectos E2E móvil y WebKit previstos.
4. Automatizar la comprobación de ACL de `0015`; la matriz fue verificada
   manualmente en esta revisión, pero la prueba de integración actual solo
   inspecciona RLS, índices y restricciones.

## Pruebas aún faltantes

- Permiso negativo por endpoint: usuario autenticado sin `waste.read`,
  `waste.create`, `waste.transition` o `waste.exceptions.manage`.
- Módulo deshabilitado para la empresa, con rechazo `MODULE_DISABLED`.
- IDOR a nivel HTTP para detalle, avance y excepción entre dos empresas, además
  de la prueba RLS directa ya existente.
- Clave idempotente reutilizada con payload distinto y concurrencia de dos
  excepciones con la misma clave.
- Atomicidad negativa: confirmar que un fallo posterior no deja excepción,
  auditoría, outbox o clave idempotente parcial.
- Límites temporales con reloj controlado: dentro y fuera de los cinco minutos,
  fechas inválidas y política de backdating.
- Texto hostil almacenado en descripción, notas y acciones correctivas,
  comprobando respuesta JSON y renderizado sin XSS.
- Estado de módulo y permisos con roles personalizados; las pruebas actuales
  usan principalmente el administrador sembrado.
- Cobertura E2E móvil y WebKit del módulo corregido.
- Cuando exista cierre: reautenticación o aprobación, segregación de funciones,
  documento no eliminado y vinculado al registro, estado de revisión,
  autorización de lectura y pruebas de evidencia ajena.

## Riesgos residuales

1. **Permiso de transición aún amplio.** `waste.transition` permite a un mismo
   usuario avanzar desde generación hasta destino final. El cierre está
   bloqueado, pero todavía no existe segregación por fase, área, sede o rol
   ambiental.
2. **Fases sin evidencia estructurada.** Clasificación, segregación,
   almacenamiento, traslado, despacho y destino final pueden avanzar sin datos
   específicos de la fase. No debe describirse este historial como prueba
   regulatoria o custodia validada.
3. **Backdating sin política específica.** Se impide el futuro mayor a cinco
   minutos, pero no existe límite histórico ni permiso separado para registrar
   fechas antiguas.
4. **Ámbito por empresa, no por sede.** Las lecturas son empresariales y la
   creación usa la primera sede derivada de sesión. Si el modelo futuro exige
   restricción por sede o área generadora, deberá añadirse autorización y RLS
   más granular.
5. **Roles ambientales pendientes.** Los permisos nuevos siguen asignados a
   roles genéricos de demostración. Antes de uso real se requiere matriz de
   responsabilidades, aprobación y pruebas por rol.
6. **Sin flujo de evidencia/upload.** No hay carga, selector ni validación de
   documentos en el workspace. Es correcto mantener el cierre deshabilitado
   hasta que ese flujo exista y pase revisión de Seguridad y Legal.

## Límite del PASS

El PASS cubre únicamente los controles revisados del módulo operativo:
aislamiento tenant/empresa, permisos en API, módulo habilitado, idempotencia,
concurrencia, auditoría/outbox, cierre fail-closed, XSS por renderizado y mínimo
privilegio SQL.

No cubre ni autoriza cumplimiento ambiental, clasificación técnica, cadena de
custodia regulatoria, cierre, presentación ante autoridades ni operación
productiva. Cualquier implementación futura de evidencia o cierre requiere una
nueva revisión obligatoria de Seguridad y Legal.
