# Revisión legal y de cumplimiento — módulo de gestión de residuos

**Agente:** 6 — Revisor Legal y de Cumplimiento
**Fecha de revisión:** 27 de julio de 2026
**Alcance:** cambios locales no integrados del módulo `waste-management`
**Revalidación de copy:** 27 de julio de 2026
**Decisión:** **aprobado con condiciones para demostración interna; no aprobado
para uso productivo regulatorio, declaración de cumplimiento ni cierre
documental validado**

## 1. Alcance y límite de la revisión

Esta revisión cubre únicamente:

- el texto visible de `WasteWorkspacePage.tsx`;
- las invariantes de `waste-management.ts`;
- los contratos expuestos por `WasteController` y `WasteService`;
- la migración `0014_waste_management`;
- la documentación de diseño y arquitectura de información creada para el
  módulo.

No constituye asesoría legal, no determina la aplicabilidad de una norma a una
empresa, actividad, residuo, instalación u operador concretos y no acredita
cumplimiento, autorización, habilitación, certificación ni presentación ante una
autoridad.

No se consultaron fuentes oficiales ambientales durante esta revisión. El
repositorio no contiene todavía una matriz ambiental oficial, versionada y
trazable para este módulo. Por ello, este informe no asigna obligaciones,
clasificaciones, colores, plazos, autoridades ni documentos regulatorios.

## 2. Aspectos conformes con el límite de producto

1. La interfaz evita afirmar expresamente «cumplimiento legal».
2. La captura incluye la advertencia de que una marca de peligrosidad no
   sustituye la clasificación técnica o legal.
3. El diseño documental dispone que las citas legales deben conservar fuente
   oficial y fecha de consulta, y prohíbe inferir cumplimiento a partir de
   colores o conteos.
4. La interfaz identifica la última fase como «Cierre interno», declara que no
   acredita cumplimiento ambiental y mantiene el cierre deshabilitado.
5. El modelo mantiene ámbito de tenant y empresa, historial de eventos,
   concurrencia por versión y referencias a documentos del mismo ámbito.
6. Las categorías de excepción no mencionan una autoridad o sistema oficial
   concreto que no haya sido integrado.
7. La lista ya no presenta la marca preliminar como una clasificación firme:
   muestra «Marca preliminar: requiere evaluación».
8. Se eliminó de la interfaz la afirmación de que una evidencia está validada.

Estos controles permiten describir la funcionalidad como **registro y
trazabilidad operativa interna en demostración**, pero no como expediente
regulatorio completo ni como flujo productivo aprobado.

## 3. Revalidación de los hallazgos iniciales

### LEG-WASTE-01 — «Evidencia validada» no estaba respaldada por el contrato

**Estado:** corregido en el copy; riesgo técnico residual
**Ubicación:** inspector contextual y contrato de cierre

La interfaz ya no denomina validada a la evidencia. El aviso actual informa:

> Cierre interno no habilitado. Esta entrega no acredita cumplimiento
> ambiental ni permite cerrar: falta el flujo separado de aprobación y
> evidencia vinculada al registro.

El nuevo texto es coherente con el alcance visible y permite la demostración
interna. El riesgo técnico permanece: el dominio y el servicio todavía admiten
`DOCUMENTARY_CLOSURE` con un documento existente, sin verificar tipo,
relación con el destino, versión, integridad, vigencia, emisor, estado de
revisión ni aprobación. El contador de evidencia también incluye cualquier
documento asociado a un evento.

**Condición:** mantener el cierre inaccesible en la UI y no habilitarlo por otro
cliente o integración. Antes de uso productivo deben alinearse la invariante y
el contrato con un flujo separado de aprobación, o eliminarse la capacidad de
cierre del backend hasta que exista ese flujo.

### LEG-WASTE-02 — La marca de peligrosidad aparenta una clasificación concluida

**Estado:** parcialmente corregido; condición para la demo
**Ubicación:** formulario de generación, tabla y modelo `hazardous`

La tabla fue corregida y ahora muestra «Marca preliminar: requiere evaluación».
Sin embargo, el control del formulario todavía conserva como título «Requiere
tratamiento como residuo peligroso». Aunque la ayuda aclara que la marca no
sustituye la clasificación técnica ni legal, el título sigue expresando una
conclusión más firme que el modelo permite.

**Condición para la demo:** explicar a sus participantes que el campo es
preventivo y no una clasificación. **Corrección pendiente antes de ampliar la
audiencia:** cambiar también el título del control, por ejemplo:

- control: «Marcar para revisión de peligrosidad»;
- ayuda: «La marca es preventiva y no constituye clasificación técnica ni
  legal»;
- lista: «Peligrosidad pendiente de revisión».

Para mostrar «Residuo peligroso» como estado firme se requiere un modelo de
clasificación con criterio o catálogo aplicable, fuente/versionado, autor,
fecha, estado de revisión e historial.

### LEG-WASTE-03 — «Cierre documental» puede confundirse con cierre regulatorio

**Estado:** corregido en UI; bloqueante residual para producción
**Ubicación:** fase visible «Cierre interno», estado técnico `CLOSED` y dominio

La UI usa «Cierre interno», declara que no acredita cumplimiento ambiental y
explica que el cierre no está habilitado. El riesgo de comunicación inicial
queda corregido para una demo interna.

El modelo técnico aún podría cerrar un registro con la mera existencia de un
documento y no modela transportista, operador, infraestructura de destino,
recepción, pesaje, manifiesto, certificado, aplicabilidad documental ni
revisión. En ese contexto, el estado `CLOSED` no puede interpretarse como
obligación ambiental satisfecha.

**Condición:** no exponer ni documentar el endpoint de cierre como capacidad
lista para producción. Un cierre regulatorio futuro debe depender de reglas de
aplicabilidad versionadas y evidencia específica revisada.

### LEG-WASTE-04 — No existe base legal o procedimental trazable por evento

**Estado:** no bloquea la demo interna; bloquea una superficie regulatoria
**Ubicación:** modelo de eventos y especificación de pantalla

El encargo y la especificación visual requieren base legal o procedimental en
cada fase. El modelo de eventos actual guarda notas y evidencia, pero no
distingue:

- requisito legal obligatorio;
- requisito condicional;
- estándar técnico;
- requisito contractual;
- control interno;
- práctica recomendada.

Tampoco vincula fuente oficial, versión, fecha de consulta, vigencia o regla de
aplicabilidad. Mostrar una «base legal» con el esquema actual exigiría texto
libre no gobernado.

**Condición:** no publicar referencias regulatorias en esta pantalla
hasta incorporar una matriz ambiental versionada y revisada. Las reglas internas
pueden mostrarse como «Procedimiento interno» si están identificadas, versionadas
y separadas de una obligación legal.

## 4. Hallazgos importantes

### LEG-WASTE-05 — Categorías que suponen hechos no verificados

`EXPIRED_AUTHORIZATION`, `MISSING_DESTINATION_EVIDENCE` y
`MISSING_SUBMISSION_DOCUMENTATION` son categorías manuales. El sistema no
registra actualmente la autorización evaluada, su emisor o vigencia, ni la
presentación o documento aplicable.

**Acción recomendada:** presentar estas categorías como incidencias reportadas,
no como determinaciones del sistema. En el detalle debe quedar visible quién
reportó el hecho, cuándo, sobre qué documento o requisito y si fue verificado.
No renombrar una presentación genérica como una obligación o plataforma
específica sin fuente oficial y contrato real.

### LEG-WASTE-06 — Trazabilidad operativa incompleta respecto del destino

El rail registra cambios de fase, pero no conserva los sujetos y objetos
necesarios para reconstruir un traslado y destino: instalación de origen,
transportista, operador, infraestructura receptora, cantidades despachada y
recibida y documentos tipificados. El término «cadena de custodia operativa» es
aceptable como dirección de diseño, pero debe describirse como alcance parcial
en la documentación de estado.

**Acción recomendada:** usar «trazabilidad operativa del registro» en textos de
alcance hasta que los eslabones estén modelados y probados.

### LEG-WASTE-07 — Documentación de auditoría desactualizada frente al código

`current-product-audit.md`, `information-architecture.md` y
`data-visualization-plan.md` indican que residuos está bloqueado o es futuro,
mientras la rama ya registra módulo, dominio, API, migración y pantalla. Esa
contradicción impide determinar el alcance implementado y puede inducir a
afirmaciones erróneas.

**Acción recomendada:** conservar claramente la fecha y naturaleza de la línea
base, y añadir una sección posterior que distinga:

- implementado y probado;
- implementado con limitaciones;
- diseñado pero no implementado;
- bloqueado por validación legal, de datos o de seguridad.

No reescribir la línea base como si el módulo hubiera existido antes.

### LEG-WASTE-08 — Falta política específica de conservación y rectificación

Los eventos son trazables en la aplicación, pero la migración concede
`update` y `delete` al rol de runtime sobre todas las tablas nuevas y no
documenta conservación, corrección por contrasiento, bloqueo o exportación. Este
hallazgo no determina un plazo legal; identifica una ausencia de gobierno.

**Acción recomendada:** definir, con asesoría aplicable al despliegue, qué
registros pueden corregirse, anularse o eliminarse, quién lo aprueba y cómo se
preserva la historia. No publicar «historial inmutable» hasta que el control sea
efectivo y probado.

## 5. Lenguaje aprobado y lenguaje que debe evitarse

| Uso             | Lenguaje recomendado                        | Evitar                                      |
| --------------- | ------------------------------------------- | ------------------------------------------- |
| Alcance general | «Registro y trazabilidad operativa interna» | «Gestión ambiental conforme»                |
| Evidencia       | «Documento vinculado»                       | «Evidencia validada» sin revisión           |
| Peligrosidad    | «Marcado para revisión de peligrosidad»     | «Peligroso» desde un booleano no revisado   |
| Cierre          | «Cierre interno del registro»               | «Cumplimiento completado»                   |
| Excepción       | «Incidencia reportada»                      | «Incumplimiento confirmado» sin evaluación  |
| Normas          | «Referencia oficial consultada el [fecha]»  | «Normativa vigente» sin control de vigencia |
| Estado exitoso  | «Operación registrada»                      | «Obligación cumplida»                       |

## 6. Condiciones y riesgos residuales

### 6.1 Aprobación limitada para demostración interna

La demostración interna queda aprobada con estas condiciones:

1. identificar el entorno y los datos como demostración;
2. mantener el cierre interno deshabilitado;
3. no describir documentos vinculados como revisados, válidos o suficientes;
4. explicar que la marca de peligrosidad es preventiva y requiere evaluación;
5. tratar las excepciones como incidencias reportadas, no como infracciones o
   incumplimientos confirmados;
6. no mostrar citas, obligaciones, plazos o estados regulatorios sin fuentes
   oficiales revisadas;
7. no usar la demo como evidencia de cumplimiento, autorización o habilitación.

### 6.2 Riesgos residuales

1. El título del control de peligrosidad todavía expresa «Requiere tratamiento
   como residuo peligroso»; la lista ya fue corregida, pero el formulario debe
   usar también lenguaje preliminar.
2. La API y el dominio conservan una transición técnica de cierre que la UI no
   expone. Otro cliente podría invocarla si cuenta con permiso.
3. Un documento vinculado no tiene tipología, revisión ni aprobación ambiental
   demostrada por este módulo.
4. Las excepciones relativas a autorización o documentación son reportes
   manuales sin objeto documental o requisito aplicable estructurado.
5. La cadena no modela todavía todos los sujetos, cantidades y evidencias de
   despacho y destino.
6. No existe una matriz legal ambiental oficial, versionada y con reglas de
   aplicabilidad para este producto.
7. La documentación de línea base debe distinguir el estado previo del vertical
   slice actualmente implementado.
8. La política de conservación, corrección, anulación e inmutabilidad de estos
   registros no está aprobada para un despliegue concreto.

### 6.3 Condiciones antes de uso productivo

Además de cerrar los riesgos anteriores, un uso productivo requiere:

1. revisión jurídica aplicable a la empresa, actividad, residuos, instalaciones
   y terceros concretos;
2. alineamiento del modelo, API y UI con el alcance aprobado;
3. reglas de clasificación, evidencia y cierre gobernadas y probadas;
4. matriz de responsabilidades y segregación de funciones;
5. controles de autorización, historial, aislamiento y conservación aprobados
   por Seguridad y Base de Datos;
6. documentación que diferencie controles internos de obligaciones legales;
7. pruebas completas de los flujos y límites comunicados.

Una futura superficie de cumplimiento ambiental exige una revisión separada con
fuentes oficiales peruanas consultadas y fechadas, reglas de aplicabilidad por
caso, trazabilidad de cambios y asesoría legal del despliegue concreto.

## 7. Dictamen

El copy corregido resuelve la afirmación de evidencia validada, cambia la fase a
«Cierre interno», comunica que la entrega no acredita cumplimiento ambiental y
mantiene el cierre deshabilitado. La tabla también identifica la peligrosidad
como marca preliminar pendiente de evaluación.

Por ello, la decisión actual es:

- **demo interna controlada:** aprobada con las condiciones de la sección 6.1;
- **uso operativo productivo:** no aprobado en esta revisión;
- **flujo regulatorio, expediente ambiental o evidencia de cumplimiento:** no
  aprobado;
- **clasificación confirmada de residuos peligrosos:** no aprobada;
- **cierre documental validado o cierre regulatorio:** no aprobado.

La corrección del título del control de peligrosidad sigue siendo necesaria,
pero ya no impide una demo interna si el alcance preliminar se explica y el
entorno conserva los avisos revisados.
