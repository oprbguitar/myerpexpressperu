# Informe del Agente 4 — Seguridad y Privacidad

**Fecha:** 23 de julio de 2026  
**Alcance:** políticas puras nuevas; no se tocaron API, web, migraciones,
persistencia ni datos reales.

## Resultado

Se implementaron políticas fail-closed bajo `packages/security/src/phase3/`:

- clasificación de datos y autorización previa a proveedor;
- redacción estructurada/textual y sanitización de eventos;
- creación, validación y máscara de referencias opacas de secretos;
- reautenticación, MFA y aprobación para acciones sensibles;
- nueve guardas acumulables para reinicio demo;
- detección de contenido hostil y allowlist de herramientas AI/OCR;
- vista previa de retención con exclusión de legal hold.

Las funciones no realizan I/O ni acciones consecuenciales. No resuelven secretos,
no borran datos y no ejecutan herramientas.

## Pruebas ejecutadas

```text
pnpm --filter @erp/security typecheck
Resultado: PASS

pnpm --filter @erp/security test
Resultado: PASS — 4 archivos, 17 pruebas

pnpm exec eslint packages/security/src/phase3 --max-warnings=0
Resultado: PASS

pnpm --filter @erp/security build
Resultado: PASS
```

Casos cubiertos: datos restringidos, proveedor/finalidad/redacción, PII y
secretos, estructuras circulares, evento inválido, reautenticación vencida,
aprobación, producción/demo, aprobadores duplicados, prompt injection,
exfiltración, SQL, herramienta no permitida, referencia opaca y legal hold.

## Checklist de revisión cruzada

### Migraciones y base de datos

- [ ] `tenant_id` y `company_id` obligatorios donde corresponda, con índices de
  ámbito y FKs.
- [ ] RLS probado con rol no propietario y `SET LOCAL` transaccional.
- [ ] Salud, secretos y auditoría sensible usan repositorios/permisos separados.
- [ ] Historial/hold/auditoría append-only y `version` para concurrencia.
- [ ] Down migration revisada sin pérdida silenciosa; semillas solo sintéticas.

### API y worker

- [ ] Ámbito siempre derivado de sesión; IDOR y cross-company negativos.
- [ ] Permiso en caso de uso y API; reautenticación/MFA/aprobación montadas.
- [ ] Queries parametrizadas, límites de lote, idempotencia y autorización de
  descarga.
- [ ] Eventos pasan por sanitización; respuestas no revelan existencia ajena.
- [ ] Jobs fallan cerrados, preservan ámbito y no amplían alcance al reintentar.

### IA, OCR y proveedores

- [ ] Clasificación, finalidad, minimización y proveedor aprobados antes de envío.
- [ ] Datos médicos, credenciales y secretos bloqueados.
- [ ] Prompt/documento tratado como datos; detección de inyección y límites.
- [ ] Lista cerrada de tools, sin SQL irrestricto ni acción consecuencial.
- [ ] OCR queda como borrador con original, confianza y revisión humana.
- [ ] Secretos solo por referencia opaca; timeout, circuit breaker y kill switch.

### Demo

- [ ] Producción se bloquea explícitamente.
- [ ] Modo demo, bandera, marca y tenant esperado son guardas independientes.
- [ ] Frase exacta, reautenticación, MFA y dos aprobadores distintos del actor.
- [ ] Datos sintéticos/licenciados; preview y backup/restore verificados.
- [ ] Evento depurado registra intento permitido y denegado.

## Documentación entregada

- `docs/THREAT-MODEL.md`
- `docs/PRIVACY.md`
- `docs/DATA-RETENTION.md`
- `docs/INCIDENT-RESPONSE.md`

## Riesgos y siguientes revisiones

Las políticas aún deben exportarse desde el punto público del paquete y montarse
en API/worker por el coordinador. Quedan pendientes pruebas reales de RLS,
storage/antimalware, integración de permisos por ruta, gestión/cifrado de
secretos, integridad de auditoría, restore y proveedor. Legal debe revisar textos
y plazos; QA debe ejecutar la matriz adversarial. No se afirma cumplimiento ni
preparación productiva.

## Revisión cruzada obligatoria — migraciones, contratos y API

**Veredicto de Seguridad: FAIL / bloqueante de integración.** Las suites unitarias
de AI/OCR/providers y el typecheck de contratos pasan, pero la base usada por las
pruebas no tiene instaladas las migraciones 0007–0010 y existen brechas de
aislamiento y clasificación que las pruebas actuales no cubren. Esta revisión
fue solo lectura; no se modificó código, migraciones ni base de datos.

### Evidencia ejecutada

```text
pnpm --filter @erp/contracts typecheck
PASS

pnpm --filter @erp/api exec vitest run \
  src/phase3/ai/ai.test.ts \
  src/phase3/ocr/ocr.test.ts \
  src/phase3/providers/providers.test.ts
PASS — 3 archivos, 9 pruebas

node --env-file=.env ./node_modules/vitest/vitest.mjs run \
  tests/integration/phase3-database.test.ts
FAIL — 7 de 7 pruebas fallaron
```

El fallo de integración observado es consistente en las siete pruebas: la base
consultada devolvió cero tablas, políticas, funciones, triggers e índices de
Fase 3. Por ello no existe evidencia runtime actual de RLS, separación médica,
secrets, inmutabilidad legal ni guardas demo. Se requiere migrar una base de
prueba controlada y repetir; un análisis estático del SQL no sustituye esa prueba.

### Hallazgos bloqueantes

1. **[CRÍTICO] Selección de proveedor global y mutable entre tenants.**
   `ProviderManagementService` mantiene un único `activeAiProviderId`,
   `activeOcrProviderId` y `activeGeocodingProviderId`
   (`provider-management.service.ts:49-51`). `activate`/`deactivate` cambia esos
   campos sin tenant/empresa (`:116-145`) y el controlador no transmite
   `request.auth` (`provider-management.controller.ts:30-43`). Un administrador
   de una empresa puede cambiar el adaptador usado por solicitudes de otras
   empresas. Debe resolverse por ámbito derivado de sesión y persistencia
   company-scoped antes de montar las rutas.

2. **[CRÍTICO] El prompt libre de AI llega al proveedor sin clasificación.**
   El esquema solo recibe `prompt` (`ai.schemas.ts:4`); el servicio comprueba
   patrones de inyección (`ai.service.ts:82-86`) pero no clasifica ni bloquea
   datos médicos, credenciales o secretos escritos directamente en el prompt.
   Después envía `promptAssessment.boundedContent` como `userPrompt`
   (`ai.service.ts:136`). La política de categorías solo protege documentos
   declarados. Debe existir clasificación/redacción server-side y denegación
   fail-closed antes de cualquier proveedor.

3. **[ALTO] OCR confía clasificación y autorización declaradas por el
   navegador.** `dataCategories`, `identityDocumentAuthorized` y `contentType`
   forman parte del body (`ocr.schemas.ts:18-31`) y son la única base de la
   autorización y del envío (`ocr.service.ts:54-91`). No se consulta el
   documento company-scoped, su clasificación aprobada, finalidad, autorización
   ni MIME real. Un cliente puede declarar `INTERNAL` para un documento
   restringido. Debe derivarse todo ello del repositorio/sesión y validar magic
   bytes/antimalware antes de invocar OCR.

4. **[ALTO] Las guardas SQL de demo no satisfacen la política completa.**
   0010 sí comprueba entorno, bandera runtime, perfil activo, tenant con prefijo
   demo y fingerprint (`0010...up.sql:249-271`), pero el job solo exige la frase
   genérica `RESET DEMO DATA` (`:186`) y no modela reautenticación, MFA ni dos
   aprobadores independientes. Las nueve guardas de
   `packages/security/src/phase3/demo-reset.ts` no están montadas en este flujo.

5. **[ALTO] Las FKs no preservan el ámbito del padre.** Las tablas incluyen
   `tenant_id`/`company_id` y RLS, pero referencias como pipeline/proyecto
   (`0007...up.sql:91,111,174-318`) y employee/SST
   (`0008...up.sql:13-226`) apuntan solo a `id`. Una fila de un ámbito puede
   referenciar por UUID una fila padre de otro ámbito; RLS sobre la fila hija no
   valida esa igualdad y un cascade puede cruzar el límite. Se requieren claves
   únicas y FKs compuestas por ámbito, o triggers equivalentes probados.

6. **[ALTO] Revocación/retiro legal no es representable con el esquema
   inmutable actual.** `legal_acceptances` tiene `revoked_at` y
   `consent_records` tiene `withdrawn_at`, pero ambos reciben triggers que
   impiden todo update/delete (`0010...up.sql:274-275`). No existe en 0010 un
   evento append-only específico de revocación/retiro que enlace el registro
   original. Debe añadirse un modelo append-only explícito y probar su
   trazabilidad sin mutar la aceptación histórica.

### Hallazgos altos/medios adicionales

- **[ALTO] Downgrade de clasificación en resultados de tools.** El registry
  conserva `allowedDataCategories`, pero `AiAssistanceService` etiqueta todo
  resultado como `INTERNAL` (`ai.service.ts:117-123`) y no cruza la política de
  la herramienta con la política activa antes de enviarlo. Una tool admitida
  para `PERSONAL` o `FINANCIAL` puede eludir la política del request.
- **[MEDIO] Secret references no están validadas end-to-end.** 0009/0010
  permiten `secret_reference text` o `encrypted_secret bytea`
  (`0009...up.sql:53-57`, `0010...up.sql:133-141`) y la API acepta
  `secretReference?: string` arbitrario. La RLS restringida de
  `provider_configurations` es positiva, pero no se usa el parser
  `secretref:v1` ni se demuestra repositorio separado, resolución servidor,
  rotación o máscara en el camino real.
- **[MEDIO] La prueba RLS solo inspecciona catálogo.**
  `phase3-database.test.ts:56-78` verifica `relrowsecurity` y texto de políticas,
  no ejecuta lecturas/escrituras con dos tenants, dos empresas, un rol no
  propietario, `SET LOCAL`, flag médica falso/verdadero ni secret access. Tampoco
  comprueba `relforcerowsecurity`; la cuenta propietaria puede omitir RLS.
- **[MEDIO] Idempotencia OCR no liga clave a payload.** Una misma clave dentro
  del ámbito devuelve el trabajo anterior aunque cambien documento/hash/body;
  falta detectar conflicto de fingerprint antes de retornar el replay.

### Controles revisados con resultado positivo

- **PASS estático:** datos médicos en tabla separada con `encrypted_payload
  bytea`, referencia de clave y política adicional `app_has_medical_access`
  (`0008...up.sql:208-215,353-382`).
- **PASS estático:** contenido confidencial/restringido de interacciones AI no
  puede persistirse en claro (`0009...up.sql:88-95`).
- **PASS unitario:** registry AI cerrado, esquema Zod, permiso, solo lectura,
  límites de filas/salida, citas y redacción; no existe herramienta SQL genérica.
- **PASS unitario:** OCR bloquea las categorías prohibidas declaradas, conserva
  hash/idempotencia básica, exige revisión humana y entrega únicamente
  `REVIEWED_DRAFT_ONLY`.
- **PASS unitario:** endpoints de proveedor se limitan a loopback/orígenes HTTPS
  permitidos; existen timeout, respuesta acotada y circuit breaker.
- **PASS estático:** versión legal publicada, aceptaciones, consentimientos,
  uso de proveedores, historial demo, eventos de seguridad y checkpoints tienen
  triggers de inmutabilidad.
- **PASS estático parcial:** el trigger demo contiene cinco guardas SQL
  independientes; el resultado sigue siendo FAIL hasta montar reautenticación,
  MFA, doble aprobación y pruebas negativas runtime.

### Decisión de revisión

- [x] Contratos compilan y expresan proveedor deshabilitado, contexto de ámbito,
  revisión humana, tools de solo lectura y atributos observables acotados.
- [ ] Migraciones 0007–0010 verificadas en una base migrada.
- [ ] RLS y FKs cross-scope verificadas adversarialmente.
- [ ] Datos médicos y secretos verificados con roles reales.
- [ ] AI clasifica el prompt y respeta categorías de tool sin downgrade.
- [ ] OCR deriva clasificación/autorización/MIME del servidor.
- [ ] Provider management queda aislado por tenant/empresa.
- [ ] Demo reset monta reautenticación, MFA y dos aprobadores.
- [ ] Revocación/retiro legal tiene evento append-only operativo.

**No aprobar integración hasta cerrar los puntos anteriores y repetir la suite
de base con 7/7 PASS.**

## Segunda revisión cruzada — hardening 0011 y remediaciones

**Veredicto actualizado: FAIL / bloqueante por AI, OCR y ownership de
proveedores.** La persistencia 0007–0011 queda ahora comprobada en la base local
y el aislamiento del proveedor activo ya se resuelve por tenant/empresa. No
obstante, pruebas adversariales directas confirman dos caminos de salida de
contenido sensible, y el registro de configuraciones de proveedor continúa sin
propietario de ámbito.

La revisión fue solo lectura salvo este informe. No se modificaron
implementación, migraciones ni datos persistentes.

### Resultados ejecutados

```text
pnpm --filter @erp/security test
PASS — 4 archivos, 17 pruebas

pnpm --filter @erp/api exec vitest run \
  src/phase3/ai/ai.test.ts \
  src/phase3/ocr/ocr.test.ts \
  src/phase3/providers/providers.test.ts
PASS — 3 archivos, 9 pruebas

pnpm --filter @erp/api typecheck
PASS

node --env-file=.env ./node_modules/vitest/vitest.mjs run \
  tests/integration/phase3-database.test.ts \
  tests/integration/phase3-security-hardening.test.ts
PASS — 2 archivos, 10 pruebas

pnpm --filter @erp/database exec vitest run \
  src/phase3/demo-guards.test.ts
PASS — 1 archivo, 7 pruebas
```

También se ejecutaron tres sondas adversariales en memoria, sin red ni
persistencia:

```text
AI prompt sintético:
entrada = "El paciente vive con VIH y toma medicación diaria"
resultado = accepted:true, echoedSensitiveSynthetic:true

OCR sintético:
body.dataCategories = ["MEDICAL"], requestedDocumentType = "UNKNOWN"
categoría recibida por el adapter = ["INTERNAL"]

Provider ownership:
provider rotulado para tenant A activado en scope tenant B
resultado = crossScopeActivationAccepted
```

### Bloqueos cerrados

1. **PASS — objetos 0007–0011 instalados.** La suite de base que antes devolvía
   cero objetos ahora pasa 7/7.
2. **PASS — relaciones sensibles seleccionadas.** 0011 agrega FKs compuestas
   para detalle médico, configuración de provider, documento OCR, aceptación,
   consentimiento y job demo (`0011...up.sql:24-49`). La prueba runtime rechaza
   referencias cross-company en esos límites.
3. **PASS — revocación/retiro append-only.** Las nuevas tablas
   `legal_acceptance_revocations` y `consent_withdrawals` tienen FK de ámbito,
   RLS, trigger inmutable e índices (`0011...up.sql:51-105`). Las vistas
   `security_invoker` calculan estado efectivo sin mutar la historia
   (`:108-137`). La prueba confirma revocación, retiro, rechazo cross-company y
   resistencia a update/delete.
4. **PASS — selección activa por ámbito.** AI, OCR y geocoding usan mapas por
   clave tenant/company y los servicios pasan `request.auth`. Se cerró el efecto
   directo por el que una activación cambiaba el provider activo de todas las
   empresas.
5. **PASS parcial — OCR.** Ahora valida magic bytes, rechaza MIME discordante,
   exige permiso server-side para documentos de identidad y liga idempotency key
   a documento/hash (`ocr.service.ts:54-78`).
6. **PASS para herramienta demo local actual.** El reset CLI exige entorno demo,
   bandera, tenant exacto y marcado, base dedicada, fingerprint y perfil activo
   (`demo-guards.ts:25-58`), además de las guardas SQL. Las 7 pruebas negativas
   pasan y 0011 protege job/profile/snapshot por ámbito.

### Bloqueantes restantes

1. **[CRÍTICO] El filtro de prompt AI es una lista de palabras, no
   clasificación fail-closed.** `prohibitedPromptData`
   (`ai.service.ts:40-42`) solo reconoce algunas expresiones. La sonda con dato
   médico sintético “VIH” fue aceptada y el mock confirmó que llegó al provider.
   `redactText` (`ai.service.ts:144`) oculta correo, documentos, IP y bearer,
   pero no categorías médicas ni secretos arbitrarios. Se requiere que el
   cliente declare una clasificación validada server-side o, preferiblemente,
   que el prompt se construya desde campos/fuentes clasificados; cloud debe
   denegar contenido no clasificable. Una regex no cierra este control.

2. **[CRÍTICO] OCR todavía deriva clasificación de un tipo controlado por el
   navegador.** `serverDataCategories` se calcula desde
   `input.requestedDocumentType` (`ocr.service.ts:58,201-208`) y el `documentId`
   no se resuelve contra un repositorio company-scoped antes del envío
   (`:93-101`). La sonda declaró `MEDICAL` pero eligió `UNKNOWN`; el adapter
   recibió `INTERNAL`. El servidor debe cargar documento, clasificación,
   finalidad y autorización persistidas por `(document_id, tenant_id,
   company_id)`, ignorar clasificación/tipo del body para autorización y aplicar
   antimalware antes del provider.

3. **[ALTO] El adapter/configuración registrado sigue siendo global.**
   `ManagedProvider` y `RegisterManagedProviderInput` no contienen tenant/company
   (`provider-management.service.ts:19-47`); `register`, `list`,
   `testConnection` y `exportNonSecretConfiguration` operan sobre el mapa global
   (`:91-100,121-127,167-180`). El mapa de selección activa está correctamente
   scoped, pero cualquier scope puede seleccionar por ID un adapter que contiene
   endpoint/secret reference de otro cliente. La sonda de activación cross-scope
   fue aceptada. Registrar/configurar/listar/probar/exportar/activar debe exigir
   ownership derivado de sesión o limitar el registro global a tipos de adapter
   sin credenciales, resolviendo la configuración company-scoped desde base.

4. **[ALTO] Resultado de tools AI conserva downgrade a `INTERNAL`.**
   `ai.service.ts:125-131` sigue descartando
   `tool.policy.allowedDataCategories`. No existe cruce entre categorías reales
   de la tool y `this.policy.allowedDataCategories`; el resultado personal o
   financiero puede entrar como interno. La categoría efectiva debe viajar en
   `AiToolResult` y autorizarse antes de formar `supportingContext`.

### Riesgos residuales no bloqueantes para demo local

- El reset actual es un comando operativo local, no una acción autenticada del
  control plane. Sus guardas múltiples impiden el objetivo de producción y se
  consideran suficientes **solo mientras no exista endpoint remoto**. Si se
  expone por API/UI, debe montar `authorizeDemoReset`: frase ligada al tenant,
  reautenticación, MFA y dos aprobadores independientes. Hoy
  `demo-seed.ts:473-510` no monta esa política.
- 0011 endurece siete relaciones críticas, no todas las FKs de Fase 3.
  Permanecen cadenas indirectas o de negocio con FK solo por `id`, por ejemplo
  `legal_document_versions -> legal_documents`,
  `consent_versions -> consent_purposes`, proyectos y RR. HH. Deben inventariarse
  y cerrarse antes de afirmar integridad cross-scope completa.
- Secret references siguen aceptando texto arbitrario y no montan de extremo a
  extremo el parser `secretref:v1`, rotación y resolución servidor. La nueva FK
  de provider impide cruce del padre, pero no valida el formato/gestor del
  secreto.
- Las suites AI/OCR actuales pasan porque no incluyen las dos sondas
  adversariales anteriores. Deben convertirse en regresiones permanentes.

### Decisión actual

- [x] Persistencia 0007–0011: 10/10 pruebas runtime.
- [x] Relaciones críticas de 0011 y eventos legales append-only.
- [x] Provider activo aislado por tenant/empresa.
- [x] MIME, identidad e idempotencia OCR mejorados.
- [x] Reset demo local con múltiples guardas y 7/7 pruebas.
- [ ] Prompt AI con clasificación real y negativa médica/secretos.
- [ ] OCR con clasificación/autorización desde repositorio server-side.
- [ ] Registro/configuración de provider con ownership tenant/company.
- [ ] Tool output conserva y aplica su clasificación efectiva.

**Seguridad no aprueba la integración de rutas AI/OCR/provider cloud mientras
los cuatro bloqueantes permanezcan. El resto del hardening 0011 puede
integrarse.**

## Revisión final de las cuatro remediaciones

**Veredicto final: FAIL para habilitar AI/OCR externos; PASS condicionado para
integrar Fase 3 con AI y OCR externos deshabilitados.** Ownership de providers y
el límite de categorías de tools quedaron corregidos. Los controles AI/OCR
mejoraron, pero siguen dependiendo de heurísticas o metadatos originados en el
navegador y dos sondas alternativas todavía atraviesan el límite.

No se modificó implementación, migraciones ni datos persistentes durante esta
revisión.

### Evidencia repetida

```text
pnpm --filter @erp/api typecheck
PASS

pnpm --filter @erp/api exec vitest run \
  src/phase3/ai/ai.test.ts \
  src/phase3/ocr/ocr.test.ts \
  src/phase3/providers/providers.test.ts
PASS — 3 archivos, 11 pruebas

node --env-file=.env ./node_modules/vitest/vitest.mjs run \
  tests/integration/phase3-database.test.ts \
  tests/integration/phase3-security-hardening.test.ts
PASS — 2 archivos, 10 pruebas

pnpm --filter @erp/security test
PASS — 4 archivos, 17 pruebas
```

Sondas adversariales en memoria:

```text
AI exacta anterior, "El paciente vive con VIH...":
PASS — rechazada con AI_PROMPT_SENSITIVE_DATA_PROHIBITED

AI variante, "La persona usa insulina diariamente por diabetes tipo 1":
FAIL — aceptada y ecoada por el provider mock

Provider tenant A activado desde tenant B:
PASS — rechazado con PROVIDER_NOT_FOUND

Tool FINANCIAL con política activa solo INTERNAL:
PASS de egress — bloqueado con AI_TOOL_DATA_CATEGORY_NOT_ALLOWED
Observación — la tool read-only se ejecutó antes de evaluar la categoría

OCR con metadata persistida owner_entity_type="supplier-invoice",
body.dataCategories=["MEDICAL"] y contenido médico sintético:
FAIL — el adapter recibió ["FINANCIAL"]
```

### Remediaciones aprobadas

1. **PASS — ownership completo de provider en la capa actual.**
   `RegisterManagedProviderInput` exige tenant/company; `list`, `testConnection`,
   `exportNonSecretConfiguration`, `activate`, `deactivate` y resolución del
   adapter aplican `isVisible`. El controlador pasa siempre `request.auth`. La
   sonda cross-scope quedó rechazada.

2. **PASS de no-egress — categorías de tools.** El contexto usa
   `toolPolicy.allowedDataCategories` y la política activa bloquea `FINANCIAL`
   cuando solo admite `INTERNAL`. La salida no llegó al provider. Como
   endurecimiento adicional, conviene obtener/evaluar `policyFor` **antes** de
   `tools.execute`; actualmente la consulta read-only se ejecuta y luego se
   bloquea (`ai.service.ts:116-136`).

3. **PASS parcial — vínculo OCR con documento.** El servicio usa
   `scopedTransaction`, resuelve por empresa, compara MIME/hash/nombre, exige un
   owner conocido y mantiene permiso restringido de identidad
   (`ocr.service.ts:62-101`). Esto cierra sustitución de bytes y el bypass
   anterior con owner desconocido.

4. **PASS parcial — filtro AI ampliado.** La sonda exacta con paciente/VIH y la
   nueva prueba de regresión se bloquean. No constituye clasificación general,
   como demuestra la variante diabetes/insulina.

### Bloqueantes restantes

1. **[CRÍTICO] Prompt AI continúa protegido por enumeración de palabras.**
   `prohibitedPromptData` es una regex (`ai.service.ts:40-42`); una condición,
   fármaco o dato sensible no enumerado atraviesa el control. La sonda alternativa
   fue aceptada y ecoada. No se puede garantizar “nunca enviar datos médicos” con
   una lista. Para habilitar cloud se requiere una frontera estructurada:
   clasificación/finalidad server-side, prompts construidos desde campos
   clasificados y rechazo de texto libre no clasificable. Mientras tanto,
   `CLOUD` debe estar deshabilitado para AI.

2. **[CRÍTICO] `owner_entity_type` no es una clasificación confiable.**
   OCR lo trata como fuente server-side, pero `/documents` recibe
   `ownerEntityType` directamente del body y lo persiste sin allowlist ni
   autorización (`apps/api/src/documents.controller.ts:36-56`). Un cliente puede
   subir contenido médico como `supplier-invoice`; el servicio lo reclasifica
   `FINANCIAL` y lo entrega al adapter. Se necesita una clasificación inmutable
   asignada por caso de uso/repositorio autorizado, no por el endpoint genérico
   de upload, y el OCR debe leer esa clasificación explícita.

3. **[ALTO funcional] El flujo web OCR actual no coincide con el nuevo
   clasificador.** `OcrReviewPage` carga el documento con
   `ownerEntityType: "OCR_SOURCE"` y después solicita
   `SUPPLIER_RECEIPT` (`OcrReviewPage.tsx:53-68`). `documentTypeForOwner` no
   reconoce `OCR_SOURCE`, por lo que el servicio responde
   `OCR_DOCUMENT_CLASSIFICATION_UNRESOLVED`. Las pruebas unitarias usan un mock
   con `supplier-invoice` y no ejercitan el upload real.

### Riesgos residuales aceptables con features apagadas

- La ejecución de tool precede a la validación de su categoría. No hay egress y
  las tools son read-only/permisadas, pero debe reordenarse para minimización.
- `dataCategories`, `identityDocumentAuthorized` y el tipo solicitado siguen en
  el body aunque ya no sean autoridad suficiente; eliminarlos o marcarlos como
  hints reduce ambigüedad.
- El inventario de FKs no críticas y la validación `secretref:v1` end-to-end
  continúan como hardening posterior documentado.

### Decisión de seguridad

- [x] Migraciones y hardening 0011.
- [x] Aislamiento/ownership de providers.
- [x] Tools no envían categorías fuera de política.
- [x] Sonda exacta paciente/VIH bloqueada.
- [ ] Clasificación AI general; una variante médica todavía atraviesa.
- [ ] Clasificación OCR de confianza; owner metadata sigue controlado por cliente.
- [ ] Flujo web OCR operativo con clasificación validada.

**Se autoriza integrar el código únicamente con AI/OCR externos en estado
`DISABLED` y sin afirmar preparación cloud. Seguridad no autoriza activar
providers `CLOUD` de AI u OCR hasta cerrar los dos bloqueantes críticos y añadir
las sondas anteriores como regresiones permanentes.**

## Cierre definitivo de Seguridad

**Veredicto final: PASS para el alcance declarado de Fase 3. Sin bloqueantes
abiertos.** El modo autorizado mantiene AI/OCR cloud prohibidos por código; solo
se admiten proveedores deshabilitados, mock o locales conforme a su política. El
PASS no autoriza ni afirma preparación de AI/OCR cloud.

### Evidencia final ejecutada

```text
pnpm --filter @erp/api typecheck
PASS

pnpm --filter @erp/web typecheck
PASS

pnpm --filter @erp/api exec vitest run \
  src/phase3/ai/ai.test.ts \
  src/phase3/ocr/ocr.test.ts \
  src/phase3/providers/providers.test.ts
PASS — 3 archivos, 11 pruebas

node --env-file=.env ./node_modules/vitest/vitest.mjs run \
  tests/integration/phase3-database.test.ts \
  tests/integration/phase3-security-hardening.test.ts
PASS — 2 archivos, 10 pruebas

pnpm --filter @erp/security test
PASS — 4 archivos, 17 pruebas
```

Sondas negativas independientes:

```text
Prompt "La persona usa insulina diariamente por diabetes tipo 1"
PASS — AI_PROMPT_SENSITIVE_DATA_PROHIBITED

Activación AI CLOUD en development con confirmación
PASS — EXTERNAL_SENSITIVE_PROVIDER_NOT_AVAILABLE_PHASE3

Activación OCR CLOUD en development con confirmación
PASS — EXTERNAL_SENSITIVE_PROVIDER_NOT_AVAILABLE_PHASE3

Upload con ownerEntityType="OCR_SOURCE"
PASS — ZodError antes de storage/persistencia

Tool FINANCIAL con política activa solo INTERNAL
PASS — AI_TOOL_DATA_CATEGORY_NOT_ALLOWED; executed=false
```

### Cierres verificados

1. **Clasificación AI:** la variante diabetes/insulina tiene prueba permanente y
   se bloquea antes del provider. La regex sigue siendo defensa auxiliar, no una
   clasificación universal; el control definitivo para Fase 3 es que AI cloud
   no puede activarse.
2. **Frontera OCR/documentos:** `/documents` aplica una allowlist cerrada de
   owner types; la UI usa `supplier-receipt`; OCR coteja documento
   company-scoped, MIME, hash, nombre y tipo persistido. Tipos no resolubles
   fallan cerrados.
3. **Provider management:** ownership tenant/company protege
   registro/list/test/export/activate/deactivate y la selección activa.
4. **Cloud sensible:** `ProviderManagementService.activate` rechaza siempre
   modo `CLOUD` para categorías `AI` y `OCR`, en cualquier ambiente o
   confirmación.
5. **Tools AI:** la política y categorías se validan antes de
   `tools.execute`; la sonda confirmó `executed=false`.
6. **Persistencia:** 0011, RLS crítica, FKs compuestas sensibles,
   revocación/retiro append-only, vistas `security_invoker` y guardas demo
   permanecen en verde.

### Condiciones del PASS

- Mantener `EXTERNAL_SENSITIVE_PROVIDER_NOT_AVAILABLE_PHASE3` hasta diseñar y
  aprobar una clasificación estructurada y una evaluación legal/privacidad para
  proveedores externos.
- No describir AI/OCR cloud como habilitado, homologado, certificado ni listo
  para producción.
- Si una fase futura habilita cloud, `owner_entity_type` y regex no bastan como
  clasificación: se requiere una asignación confiable del caso de uso,
  finalidad, categoría, transferencia y autorización.
- Convertir las sondas de activación cloud y allowlist de upload en regresiones
  permanentes es recomendable; la verificación manual actual quedó registrada.
- Conservar AI deshabilitada como operación válida, OCR como borrador revisable,
  tools solo lectura y demo restringida a su entorno dedicado.

**Seguridad aprueba la integración de Fase 3 bajo estas condiciones.**

## Revisión focalizada — reset demo final

**Veredicto del reset completo: FAIL.** El reset transaccional de PostgreSQL,
sus guardas y el alcance del tenant son correctos para la base demo dedicada,
pero el borrado de storage falla abierto y el runtime comparte la credencial
PostgreSQL privilegiada requerida por `session_replication_role`. No se ejecutó
el reset destructivo; la revisión combinó inspección y pruebas no destructivas.

### Evidencia ejecutada

```text
pnpm --filter @erp/database exec vitest run \
  src/phase3/demo-guards.test.ts
PASS — 7/7

pnpm demo:verify
PASS — configuración verificada; 34 archivos escaneados; 0 secretos

node --env-file=.env ./node_modules/vitest/vitest.mjs run \
  tests/integration/phase3-database.test.ts \
  tests/integration/phase3-security-hardening.test.ts
PASS — 10/10

pnpm check:secrets
PASS — sin patrones de secretos reales
```

### PostgreSQL y `session_replication_role`

**PASS del algoritmo de base, bajo su entorno dedicado:**

- `resetAll` lee base, tenant, código, perfil, estado y fingerprint persistidos
  antes de crear el job o desactivar triggers
  (`demo-seed.ts:417-504`).
- Las guardas exigen `APP_ENVIRONMENT=demo`, flag exacta, tenant exacto y
  marcado `demo-`, base exacta `erp_express_demo`, fingerprint y perfil activo
  con reset habilitado. Variables de entorno por sí solas no son suficientes.
- El borrado descubre solo tablas base `public` con `tenant_id`, valida cada
  identificador y parametriza el tenant (`demo-seed.ts:431-455`).
- El target no procede de entrada: usa el UUID demo reservado y comprobado.
  El reset es deliberadamente tenant-wide; no debe describirse como reset de una
  sola empresa.
- `SET LOCAL session_replication_role=replica` ocurre dentro de la transacción
  de `PostgresDatabase.transaction`; se vuelve a `origin` antes de resembrar. Si
  existe un fallo, la excepción provoca `ROLLBACK`, que también revierte el
  ajuste local (`demo-seed.ts:440-463`,
  `packages/database/src/index.ts:12-24`).
- El bypass temporal evita triggers/FKs únicamente durante la limpieza. La
  semilla, job completado e historial se escriben después de restaurar `origin`.
- Auditoría, eventos de seguridad, perfiles/snapshots demo y el historial de
  reset están en la lista preservada. El job queda además protegido por las
  guardas SQL y las FKs compuestas de 0011.

### Bloqueantes

1. **[ALTO] Storage reset falla abierto.** La entrada del contenedor ejecuta:

   ```text
   mc rm --recursive --force demo/erp-demo-private || true
   ```

   (`deployment/demo/docker-compose.demo.yml:177`). Un error de autenticación,
   red o borrado se convierte en éxito; `mc mb --ignore-existing` también puede
   continuar sobre el bucket anterior. Después el script inicia el reset de
   PostgreSQL y muestra “Reset demo completado”. Esto puede conservar archivos
   cargados por usuarios y contradice la afirmación de reset determinista.
   El borrado debe fallar cerrado y verificarse que el bucket está vacío antes
   de continuar.

2. **[ALTO] API, worker y reset comparten el superusuario PostgreSQL.**
   `POSTGRES_USER=${DEMO_DB_USER}` crea el usuario administrador y el mismo
   `DATABASE_URL` se entrega a migrate, seed, API, worker y demo-reset
   (`docker-compose.demo.yml:9,64,77,98,124,155`).
   `session_replication_role=replica` requiere privilegio elevado; con esta
   topología el API/worker también pueden omitir RLS y triggers durante toda su
   operación normal. El reset debe tener una credencial de mantenimiento
   dedicada y efímera; API/worker deben usar un rol no propietario sin
   `BYPASSRLS` ni permiso para cambiar replication role.

### Riesgo de consistencia

Storage y PostgreSQL son dos operaciones separadas: storage se elimina primero.
Si el reset de base falla, la transacción SQL revierte pero los objetos ya no
existen. No hay transacción distribuida, por lo que se requiere al menos un
estado de job, verificación previa/posterior y recuperación/reintento que no
declare éxito parcial. Este riesgo se considera remediable para demo una vez que
storage falle cerrado y el resultado se verifique.

### Secretos

**PASS con observaciones:**

- `.env.demo` está ignorado por Git y excluido del paquete/escaneo.
- Linux usa `umask 077`, `chmod 600` y `/dev/urandom`; Windows usa
  `RandomNumberGenerator`.
- Compose recibe el path del env file y los scripts de reset no imprimen sus
  valores.
- PostgreSQL y servicios internos no publican puertos; API/web/storage se
  enlazan a loopback.

Como hardening, la credencial de mantenimiento no debe compartirse con API ni
worker y cada contenedor debe recibir solo las variables necesarias. La
contraseña demo mostrada por `demo-start` es una decisión de usabilidad local y
no debe capturarse en logs o soporte.

### Decisión

- [x] Guardas independientes y negativas: 7/7.
- [x] Target de base y tenant observado, fijo y parametrizado.
- [x] Borrado SQL transaccional; replication role local y restaurado/rollback.
- [x] Semillas sintéticas y secretos generados/ignorados.
- [ ] Storage falla cerrado y demuestra bucket vacío.
- [ ] Rol de mantenimiento separado del rol runtime sujeto a RLS.
- [ ] Prueba de reset end-to-end confirma DB + storage o informa fallo parcial.

**Seguridad no aprueba publicar ni afirmar el reset demo completo hasta cerrar
los dos bloqueantes. El resto del PASS de Fase 3 no cambia.**

## Revisión focal final — reset demo corregido

Fecha: 2026-07-23. Esta revisión **sustituye** el FAIL focal anterior.

**Veredicto actualizado de la implementación y el artefacto: PASS.** Los dos
bloqueantes de seguridad quedaron corregidos: el almacenamiento falla cerrado y
el runtime ya no comparte la credencial PostgreSQL con el reset. La corrida
Docker real registrada por Demo/Release confirmó el rechazo negativo, el job
fallido durable, el reset positivo, el bucket vacío y la salud final.

### Evidencia actual

```text
pnpm --filter @erp/database typecheck
PASS

pnpm --filter @erp/database exec vitest run \
  src/phase3/demo-guards.test.ts
PASS — 7/7

pnpm demo:verify
PASS — 7 marcadores generados; 34 archivos; 0 hallazgos

pnpm check:secrets
PASS — sin patrones de secretos reales
```

La evidencia Docker positiva y negativa se toma de la ejecución real
documentada en `09-demo-release.md`: migraciones y seed en base limpia, salud
web/API, rechazo al introducir una segunda empresa, persistencia de un
`demo_reset_job` con estado `failed`, reset exitoso, un historial de reset,
escenarios A/B/C restaurados y almacenamiento vacío. El stack fue detenido y
sus volúmenes sintéticos eliminados después de la prueba.

### Cierre de bloqueantes

1. **Storage fail-closed: PASS.** `storage-reset` ya no oculta el error de
   `mc rm`; cualquier fallo detiene el contenedor. Después recrea el bucket
   privado y exige que `mc find` no devuelva objetos
   (`docker-compose.demo.yml:190-210`).
2. **Orden y éxito parcial: PASS.** Los scripts POSIX y PowerShell ejecutan
   primero `demo-reset` y sólo tras su éxito ejecutan `storage-reset`. Si el
   segundo paso falla no imprimen éxito y reportan que la base ya fue
   restablecida, permitiendo un reintento explícito
   (`demo-reset.sh:19-21`, `demo-reset.ps1:23-27`).
3. **Separación de privilegios: PASS.** Migración/seed usan
   `erp_demo_admin`; API/worker usan `erp_demo_runtime`; reset usa
   `erp_demo_reset`. Runtime y reset se crean `NOSUPERUSER`, `NOCREATEDB`,
   `NOCREATEROLE`, `NOINHERIT` y `NOBYPASSRLS`. Sólo reset recibe
   `GRANT SET ON PARAMETER session_replication_role`
   (`docker-compose.demo.yml:55-113,117-155,177-188`).
4. **Guardas negativas y job durable: PASS para la base demo válida.** Antes de
   borrar, el reset exige exactamente la empresa reservada. Un rechazo o fallo
   revierte la transacción principal y abre otra transacción para insertar un
   job `failed`; la corrida Docker confirmó ambos efectos. Si se pierde la
   conectividad o la identidad deja de permitir ese segundo insert, el error
   sólo puede quedar en logs, limitación correcta y explícita del mecanismo
   (`demo-seed.ts:490-518,566-608`).
5. **Historial legal y privacidad: PASS en fuente.** La exclusión del borrado
   conserva documentos/versiones/aceptaciones/revocaciones legales,
   propósitos/versiones/registros/retiros de consentimiento, solicitudes y la
   tabla real `privacy_request_actions`, además de retención y legal holds
   (`demo-seed.ts:82-90`). La comprobación posterior valida que no haya
   revocaciones o retiros huérfanos antes de completar el job
   (`demo-seed.ts:530-549`).

### Cierre del artefacto

El paquete portable fue regenerado desde la fuente corregida. La revisión final
confirmó:

```text
SHA-256 registrado y recalculado
PASS — coincide con dist/demo/erp-express-peru-demo-v0.3.0.zip.sha256

pnpm demo:smoke
PASS — 18 archivos requeridos; 259 checksums; 452 componentes SBOM;
       Docker Compose aprobado

rg privacy_request_history dist/demo
PASS — 0 coincidencias

rg privacy_request_actions dist/demo
PASS — migración y demo-seed empaquetado contienen el nombre correcto
```

La sustitución final por `privacy_request_actions` también quedó cubierta por
inspección, typecheck, `demo:verify` y una regresión Docker específica: se creó
una solicitud sintética con una acción asociada, se ejecutó el reset final y
ambos conteos permanecieron en `1/1`. Web y API continuaron saludables después
del reset.

### Decisión final

- [x] Storage falla cerrado y verifica bucket vacío.
- [x] DB se restablece antes de storage y no se declara éxito parcial.
- [x] Roles admin/runtime/reset separados; runtime sujeto a RLS.
- [x] Sólo reset puede cambiar temporalmente `session_replication_role`.
- [x] Segunda empresa bloquea el reset antes del borrado.
- [x] Un fallo con identidad demo válida deja job durable.
- [x] Historiales legal, consentimiento y privacidad preservados en fuente.
- [x] Solicitud y acción de privacidad preservadas en un reset Docker final.
- [x] ZIP regenerado desde la fuente final, checksum y smoke verificados.
- [x] Distribución sin `privacy_request_history` y con
  `privacy_request_actions`.

**Seguridad aprueba la implementación del reset demo y retira los dos
bloqueantes anteriores. El artefacto portable final también queda aprobado por
esta revisión focal.**
