# QA visual y funcional — Gestión de residuos

**Fecha:** 2026-07-27
**Superficie:** `/residuos`
**Dirección de referencia:** A — Cadena de custodia operativa
**Estado:** **no aprobado para cierre visual; pendiente de corrección y validación final en navegador**

## 1. Alcance y evidencia

Esta revisión es read-only. No se modificó código de producto ni se ejecutó
navegación en navegador durante esta auditoría.

Evidencia inspeccionada:

- `docs/design-system/concepts/direction-a-cadena-custodia.png`, referencia de
  1587 × 991;
- `docs/design/waste-operations-desktop-implementation.png`, captura existente
  de 1280 × 986;
- `docs/design-system/visual-direction.md`;
- `docs/design-system/screen-specifications.md`;
- `docs/design-system/tokens.md`;
- `docs/WASTE-MANAGEMENT.md`;
- `apps/web/src/features/waste/pages/WasteWorkspacePage.tsx`;
- `apps/web/src/features/waste/waste.css`;
- `apps/web/src/App.tsx`;
- `apps/web/src/components/AppShell.tsx`;
- `tests/e2e/waste-management.spec.ts`;
- `playwright.config.ts`.

La captura existente fue inspeccionada como evidencia visual proporcionada por
el repositorio. No acredita por sí sola la fecha, comando, navegador, ausencia
de errores de consola ni resultado completo de una suite. El nombre de los datos
visibles coincide con el patrón que crea la prueba E2E, pero esa prueba **no se
ejecutó en esta revisión**.

No se encontró `docs/design/waste-operations-mobile-implementation.png`, aunque
la prueba E2E contiene una ruta para generarla. Por ello todas las conclusiones
de móvil basadas solo en CSS/TSX se clasifican como inspección estática y quedan
pendientes de validación visual y funcional.

## 2. Veredicto

La implementación conserva correctamente la composición esencial de la
dirección A:

1. contexto y acción de registro;
2. cola `Requiere atención`;
3. rail de nueve fases;
4. registros vinculados;
5. inspector contextual con trazabilidad y excepciones.

También respeta límites importantes del producto: la marca de peligrosidad es
preliminar, el cierre interno permanece bloqueado y los datos visibles provienen
de la API del módulo.

Sin embargo, la captura de escritorio confirma solapamiento y pérdida de lectura
entre rail, tabla e inspector. La inspección estática descubre además estados
vacíos falsamente positivos ante errores parciales, ausencia de comportamiento
de inspector móvil, falta de restauración de foco, límite silencioso de 100
registros y controles de contexto del shell con apariencia interactiva pero sin
acción declarada.

El módulo no cumple todavía el checklist de aceptación visual definido en
`screen-specifications.md`. El estado correcto es:

> Implementación funcional parcial con dirección visual reconocible, defectos
> materiales de escritorio y riesgos de interacción pendientes de validación.

## 3. Hallazgos accionables

### VFQA-01 — Crítico — El rail y la tabla invaden el inspector en escritorio

**Evidencia visual:** en
`docs/design/waste-operations-desktop-implementation.png`, las fases 8 y 9 del
rail aparecen dentro del área del inspector. Las etiquetas `Destino final` y
`Cierre interno` se superponen con `Cantidad`, `Responsable` y `Estado`. La tabla
queda cortada bajo el mismo inspector.

**Evidencia de código:**

- `waste.css:42` reserva 350 px al inspector;
- `waste.css:99-108` exige nueve columnas con mínimo de 90/95 px;
- `waste.css:155` impone 880 px mínimos a la tabla;
- el cambio a una sola columna ocurre recién a `max-width: 980px`, medido contra
  el viewport completo y no contra el ancho útil tras el sidebar.

**Impacto:** información operativa ilegible; las fases finales y columnas de
registro parecen pertenecer al inspector. La captura falla fidelidad,
comparación precisa y reflow.

**Acción requerida:** contener explícitamente cada superficie con `min-width: 0`
y overflow interno verificable; activar antes el inspector overlay o el layout
apilado cuando el ancho útil no soporte rail + tabla + 350 px; considerar
container queries. Comparar de nuevo a 1280, 1366 y 1440 px con sidebar abierto
y colapsado.

### VFQA-02 — Alto — Un error de consulta puede mostrarse como éxito vacío

**Evidencia de código:**

- `WasteWorkspacePage.tsx:285` combina el error de overview o registros;
- `WasteWorkspacePage.tsx:350-351` interpreta `overview.data` ausente como cero
  excepciones y muestra `Sin excepciones abiertas`;
- `WasteWorkspacePage.tsx:374-378` interpreta `records.data` ausente como lista
  vacía y muestra `Aún no hay registros de residuos`.

**Impacto:** una caída de API puede aparecer simultáneamente como error y como
confirmación tranquilizadora. En un espacio auditable esto puede ocultar trabajo
pendiente o hacer creer que no existen registros.

**Acción requerida:** diferenciar `error`, `sin datos confirmados` y `parcial`
por consulta. No renderizar el vacío de una región cuya fuente falló. Conservar
solo las regiones realmente cargadas y rotular el resultado parcial.

### VFQA-03 — Alto — El inspector no adopta el patrón requerido en móvil

**Evidencia estática:** a `max-width: 980px`, `waste.css:211-214` apila la rejilla
y cambia el inspector de sticky a `position: static`. No existe overlay,
pantalla completa, cierre modal, bloqueo del fondo ni foco administrado.

**Impacto esperado:** al tocar un registro, el detalle permanece después de la
lista y del rail; puede quedar muy lejos del elemento activador y no cumplir la
tarea móvil prevista. La afirmación requiere confirmación en navegador.

**Acción requerida:** convertir el inspector seleccionado en vista full-screen
o drawer móvil, conservar la selección, mover foco al título y restaurarlo al
control que abrió el detalle.

### VFQA-04 — Alto — El listado se limita a 100 registros sin paginación ni aviso

**Evidencia de código:** `WasteWorkspacePage.tsx:202-205` solicita
`/waste/records?limit=100`; la interfaz no muestra total, rango, paginación ni
advertencia de truncamiento.

**Impacto:** el usuario puede interpretar la tabla como libro completo aunque
los registros posteriores no estén presentes. El rail del overview y el listado
podrían no explicar el mismo universo visible.

**Acción requerida:** implementar paginación de servidor con total y rango, o
mostrar explícitamente que la vista está limitada. Los filtros de fase deben
preservarse en la paginación.

### VFQA-05 — Alto — Empresa y sede parecen selectores, pero no tienen acción

**Evidencia de código:** `AppShell.tsx:114-117` renderiza dos botones con chevron
para empresa y sede sin `onClick`, menú ni estado deshabilitado.

**Impacto:** son controles visualmente accionables e inertes. En el módulo de
residuos el contexto de sede afecta directamente el alcance operativo, por lo
que la ambigüedad es material.

**Acción requerida:** conectar selección real y autorizada, o representar el
contexto como texto no interactivo hasta que exista la función. No mantener un
chevron que prometa un menú inexistente.

### VFQA-06 — Medio — La cola no sincroniza fase, registros e inspector

**Evidencia de código:** `WasteWorkspacePage.tsx:360` solo ejecuta
`setSelectedId(item.recordId)`. `AttentionItem` no incluye la fase y no se llama
`setPhase`.

**Desviación:** el concepto A y `screen-specifications.md` requieren que una
tarea active la fase y abra el inspector, sincronizando las regiones.

**Impacto:** `Atender` abre un registro, pero el rail y el conjunto filtrado
pueden permanecer en otro contexto.

**Acción requerida:** devolver la fase real en la cola o derivarla del registro
autorizado; actualizar fase, selección y listado de forma atómica. No inferirla
desde el tipo de excepción.

### VFQA-07 — Medio — El rail no implementa el patrón de teclado especificado

**Evidencia de código:** `LifecycleRail` usa nueve botones independientes con
`aria-pressed`, pero no maneja flechas, `Home`, `End` ni roving tabindex
(`WasteWorkspacePage.tsx:130-168`).

**Impacto:** un usuario de teclado debe tabular por las nueve fases. El control
no se comporta como el rail documentado.

**Acción requerida:** decidir y documentar un patrón accesible estable. Si se
mantiene como grupo de botones, ofrecer navegación por flechas y un solo punto
de entrada; anunciar fase y número de resultados al activar.

### VFQA-08 — Medio — Selección y mutaciones carecen de anuncios y foco

**Evidencia de código:** después de crear, avanzar o seleccionar se invalidan
queries y cambia el inspector, pero no existe región `aria-live`, movimiento
explícito de foco ni restauración al cerrar (`WasteWorkspacePage.tsx:220-277`,
`428-455`).

**Impacto:** el cambio puede no ser perceptible para lector de pantalla. En
móvil el detalle puede abrir fuera del viewport sin señal.

**Acción requerida:** anunciar creación, transición, error y cantidad filtrada;
mover foco al encabezado del inspector solo cuando corresponda; restaurar foco
al botón `Revisar` o `Atender` al cerrar.

### VFQA-09 — Medio — La captura de referencia contiene datos E2E no aptos para cierre visual

**Evidencia visual:** los registros se llaman `Paños absorbentes de prueba
desktop-chromium-...` y se repiten con timestamps extensos.

**Impacto:** el contenido demuestra resistencia parcial a cadenas largas, pero
distorsiona jerarquía, fuerza wraps y no sirve como captura final profesional.
Tampoco debe presentarse como dato productivo.

**Acción requerida:** conservar esta captura como evidencia técnica rotulada;
generar capturas finales con semillas sintéticas deterministas, claramente
identificadas como demostración, y con escenarios de vacío, atención y bloqueo.

### VFQA-10 — Medio — Evidencia y responsabilidad están incompletas frente al concepto

**Evidencia:** la tabla expone un conteo de evidencia y el inspector muestra
icono por evento, pero no ofrece lista o acceso a evidencia. El responsable es
solo texto y no hay asignación. La cola no muestra responsable.

**Impacto:** la pantalla reconstruye fase y evento, pero no permite verificar
desde la interfaz qué documento respalda una transición ni quién debe actuar.

**Acción requerida:** mantener estos campos ausentes o textuales hasta tener
casos de uso reales; después vincular documento autorizado, responsable y
acción. No copiar los controles conceptuales sin API y permisos.

### VFQA-11 — Medio — El estado de filtro no es compartible ni persistente

**Evidencia de código:** fase y selección residen solo en `useState`
(`WasteWorkspacePage.tsx:174-175`). La URL no conserva fase ni registro.

**Impacto:** refrescar, volver o compartir la investigación pierde contexto.

**Acción requerida:** codificar fase y selección en parámetros de URL cuando el
routing del módulo lo apruebe; validar IDs en API y no guardar datos sensibles.

### VFQA-12 — Bajo — Doble representación de registros aumenta costo móvil

**Evidencia de código:** se renderizan simultáneamente tabla y tarjetas
(`WasteWorkspacePage.tsx:381-422`); CSS oculta una u otra según breakpoint
(`waste.css:167`, `228-229`).

**Impacto:** hasta 100 registros se duplican en el DOM/React, aunque una copia no
se pinte. No es un defecto visual confirmado, pero incrementa costo en móviles.

**Acción requerida:** elegir la representación por media query en el componente
o compartir un modelo renderizado sin duplicar todo el conjunto; medir antes y
después.

## 4. Fidelidad a la dirección A

| Elemento                 | Estado                                | Evidencia y desviación                                                                                             |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Identidad y shell ERP    | Parcialmente conforme                 | Conserva marca, sidebar y topbar; falta colapso de sidebar y los selectores de contexto son inertes                |
| Cola antes de métricas   | Conforme en estructura                | `Requiere atención` precede al rail; el vacío no afirma cumplimiento, pero falla ante error de fuente              |
| Rail de ciclo de vida    | Parcialmente conforme                 | Nueve fases reales y seleccionables; overflow confirmado y teclado incompleto                                      |
| Registros vinculados     | Parcialmente conforme                 | Columnas explícitas, caption, `scope` y lista móvil; faltan paginación, filtros visibles y truncamiento declarado  |
| Inspector contextual     | Parcialmente conforme                 | Resumen, avance, timeline y excepciones; no sincroniza fase desde cola, no restaura foco y no es full-screen móvil |
| Trazabilidad             | Conforme para el alcance implementado | Lista ordenada con fecha, notas e icono de evidencia; no se afirma cierre completo                                 |
| Evidencia                | Pendiente                             | Solo conteo/indicador; sin vínculo o revisión desde la superficie                                                  |
| Excepciones              | Parcialmente conforme                 | Alta y lista con severidad textual; no hay resolución/verificación de cierre en UI                                 |
| Acción primaria          | Conforme en fuente                    | `Registrar generación` está condicionada por permiso y ejecuta una mutación real                                   |
| Cierre interno           | Conforme al límite                    | Bloqueado en interfaz con explicación explícita                                                                    |
| Búsqueda/command palette | Desviación aceptable                  | No se muestra porque no existe índice funcional; coincide con las reglas                                           |
| Periodo activo           | Pendiente                             | No aparece en implementación; no se debe añadir como control hasta tener contrato real                             |
| Densidad visual          | Parcialmente conforme                 | Sobria y profesional; rail y tabla dejan de ser legibles en el ancho capturado                                     |
| Estado vacío             | Parcialmente conforme                 | Copy honesto con consulta exitosa; estado incorrecto si la fuente falla                                            |
| Móvil orientado a tareas | Pendiente de evidencia                | CSS cambia tabla por lista y rail por vertical, pero no existe captura ni inspector full-screen                    |

## 5. Jerarquía visual

### Fortalezas confirmadas en la captura

- El título y la acción primaria son inmediatamente visibles.
- No existe hero, parrilla de KPI ni decoración ambiental genérica.
- La cola usa prioridad superior al rail y al libro.
- Superficies, bordes y tipografía conservan la identidad sobria del ERP.
- El inspector tiene encabezado y cierre explícitos.
- La nota de cierre separado protege confianza y alcance.

### Riesgos confirmados

- El título `Cadena de custodia operativa` ocupa más peso que `Gestión de
residuos`; es coherente con la dirección elegida, pero la captura no ofrece un
  identificador breve adicional en topbar móvil.
- Los nombres E2E extremadamente largos dominan el inspector y las filas.
- El solapamiento destruye la jerarquía a partir de la fase 8 y de la columna
  responsable.
- El sidebar permanece muy ancho en un viewport donde la especificación propone
  colapsarlo o convertir el inspector en overlay.

## 6. Contraste estimado desde CSS

Los ratios siguientes se calcularon a partir de colores declarados; no
constituyen validación de navegador, antialiasing, estados hover/focus ni zoom.

| Uso                            | Colores               | Ratio estimado | Evaluación preliminar                     |
| ------------------------------ | --------------------- | -------------: | ----------------------------------------- |
| Texto principal                | `#0b2138` / `#ffffff` |        16.29:1 | Pasa texto AA                             |
| Texto secundario en superficie | `#5c6f82` / `#ffffff` |         5.18:1 | Pasa texto normal AA                      |
| Texto secundario sobre fondo   | `#5c6f82` / `#f4f7fa` |         4.82:1 | Pasa texto normal AA                      |
| Acción azul                    | `#0b63ce` / `#ffffff` |         5.69:1 | Pasa texto normal AA                      |
| Vacío positivo                 | `#176247` / `#ffffff` |         7.31:1 | Pasa texto normal AA                      |
| Severidad media/alta           | `#9a5700` / `#ffffff` |         5.62:1 | Pasa texto normal AA                      |
| Severidad crítica              | `#b42318` / `#ffffff` |         6.57:1 | Pasa texto normal AA                      |
| Conector del rail              | `#b9c7d5` / `#ffffff` |         1.72:1 | Riesgo 1.4.11 si el conector es necesario |
| Borde de superficie            | `#d8e1ea` / `#ffffff` |         1.32:1 | No sirve como único límite de control     |

El texto observado tiene una base adecuada. Deben probarse focus visible,
controles deshabilitados, selección, bordes de inputs y conectores a 200 % de
zoom. El rail no debe depender de la línea de 1.72:1 para comunicar secuencia.

## 7. Checklist escritorio

| Comprobación                   | Estado                        | Nota                                                                          |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------- |
| Identidad visual especializada | Pasa                          | Se reconoce como espacio operativo de residuos, no dashboard genérico         |
| Dirección A reconocible        | Pasa                          | Cola + rail + registros + inspector                                           |
| Acción primaria real y visible | Pasa por inspección de fuente | Condicionada por `waste.create`; no ejecutada en esta revisión                |
| Cola accionable                | Parcial                       | Abre registro; no sincroniza fase                                             |
| Rail legible completo          | Falla                         | Solapamiento confirmado a 1280 px                                             |
| Tabla legible completa         | Falla                         | Columnas quedan ocultas/cortadas bajo inspector                               |
| Inspector conserva contexto    | Parcial                       | Sticky en escritorio; invade contenido por ancho y no restaura foco           |
| Encabezados/tabla semánticos   | Pasa por fuente               | `caption`, `scope="col"` y acción nombrada                                    |
| Estados loading                | Parcial                       | Existe carga total y carga de detalle; no hay skeleton contextual             |
| Estado empty real              | Falla en error parcial        | Puede afirmar vacío cuando la consulta falló                                  |
| Estado error recuperable       | Parcial                       | `ErrorNotice` visible; no se observa reintento local ni separación por fuente |
| Estado blocked                 | Pasa por fuente               | Cierre interno explícitamente bloqueado                                       |
| Estado offline                 | Pendiente                     | Shell muestra conexión; comportamiento del módulo no validado                 |
| Estado permission denied       | Pendiente                     | Route/permisos existen; no se ejecutó por rol                                 |
| Sin overflow del documento     | No suficiente                 | E2E lo comprueba, pero la captura confirma overflow/solapamiento interno      |
| Zoom 200 %                     | Pendiente                     | No ejecutado                                                                  |
| WebKit                         | Pendiente en esta revisión    | Configurado, no ejecutado                                                     |

## 8. Checklist móvil

| Comprobación                    | Estado                     | Nota                                                                           |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| Captura 390 × 844               | Pendiente                  | No existe captura móvil en el repositorio                                      |
| Captura 360 × 800               | Pendiente                  | No existe                                                                      |
| Navegación drawer               | Pendiente                  | No ejecutada; auditoría accesible separada identifica riesgos globales de foco |
| Encabezado y CTA en una columna | Previsto por CSS           | Requiere captura                                                               |
| Cola antes del panorama         | Previsto por DOM           | Requiere navegación y captura                                                  |
| Rail vertical                   | Previsto por CSS           | Requiere validar conectores, scroll y foco                                     |
| Tabla sustituida por lista      | Previsto por CSS           | Requiere validar lectura y que no falten campos esenciales                     |
| Inspector full-screen           | Falla por fuente           | Se apila como contenido estático                                               |
| Restauración de foco            | Falla por fuente           | No implementada                                                                |
| Objetivos de 44 × 44 px         | Parcial                    | CTA principal 48 px; botón de cierre 36 × 36 px                                |
| Teclado virtual/formulario      | Pendiente                  | No ejecutado                                                                   |
| Reflow sin scroll bidimensional | Pendiente                  | No ejecutado                                                                   |
| Pixel 7 Chromium                | Pendiente en esta revisión | Proyecto configurado; captura esperada ausente                                 |
| Safari/iOS                      | Pendiente                  | No existe proyecto móvil WebKit                                                |

## 9. Estados y flujos que requieren captura final

La validación final debe producir evidencia separada y rotulada de:

1. escritorio 1920 × 1080, 1440 × 900 y 1366 × 768;
2. móvil 390 × 844 y 360 × 800;
3. sin registros;
4. con registros y sin excepciones;
5. con excepción crítica y plazo;
6. filtro por fase con cero resultados;
7. error solo en overview;
8. error solo en registros;
9. carga y error de detalle;
10. usuario `waste.read` sin permisos de crear, avanzar o gestionar excepciones;
11. formulario válido e inválido;
12. avance de fase exitoso, conflicto de versión y doble envío;
13. bloqueo de `DOCUMENTARY_CLOSURE`;
14. offline y recuperación;
15. 200 % de zoom, teclado completo y reduced motion.

Para cada captura deben registrarse URL, viewport, navegador, commit o árbol
observado, estado de datos y resultado de consola. La captura debe compararse con
el concepto A al mismo ancho útil, no solo con el mismo ancho de imagen.

## 10. Criterios de salida

La QA visual y funcional puede pasar únicamente cuando:

- VFQA-01 a VFQA-05 estén corregidos;
- no exista solapamiento, corte o scroll horizontal inesperado en todos los
  viewports acordados;
- error, vacío, parcial y permiso denegado sean estados distintos;
- la cola, fase, registros e inspector mantengan selección sincronizada;
- el inspector sea overlay/full-screen en móvil y restaure foco;
- la lista declare total, rango y paginación;
- se ejecuten rutas principales por permisos relevantes;
- se verifiquen consola, foco, teclado, zoom, offline y reduced motion;
- existan capturas de escritorio y móvil con datos sintéticos deterministas;
- las desviaciones intencionales frente al concepto A queden documentadas.

Hasta completar esas verificaciones, no debe declararse fidelidad final,
navegación validada, ausencia de regresiones visuales, conformidad WCAG 2.2 AA
ni aceptación de producción.

## 11. Revalidación del coordinador después de correcciones

La revisión independiente anterior encontró los defectos antes de la última
iteración. El coordinador corrigió y ejecutó después:

- `VFQA-01`: rail, tabla e inspector ahora quedan contenidos. A 1280 × 900 se
  midió `railRight=901`, `tableRight=900` e `inspectorLeft=917`, sin
  solapamiento y sin overflow del documento;
- `VFQA-02`: un error de overview o registros ya no se representa como vacío
  confirmado;
- `VFQA-03` y `VFQA-08`: el inspector seleccionado es una vista fija en móvil,
  su título recibe foco y el cierre intenta restaurarlo al activador;
- `VFQA-04`: la interfaz declara que muestra como máximo los 100 registros más
  recientes. La paginación real sigue pendiente;
- `VFQA-05`: empresa, sede y usuario dejaron de ser nombres ficticios o
  selectores inertes; el shell muestra contexto genérico derivado de sesión;
- se agregó enlace de salto, región viva de conectividad y foco visible de doble
  contraste.

Validación real en navegador local:

| Viewport    | Documento                | Representación         | Resultado |
| ----------- | ------------------------ | ---------------------- | --------- |
| 360 × 800   | sin overflow             | lista móvil            | PASS      |
| 390 × 844   | sin overflow             | lista + inspector fijo | PASS      |
| 412 × 915   | sin overflow             | lista móvil            | PASS      |
| 768 × 1024  | sin overflow             | lista móvil            | PASS      |
| 1366 × 768  | sin overflow             | tabla                  | PASS      |
| 1920 × 1080 | sin overflow             | tabla                  | PASS      |
| 1280 × 900  | sin solapamiento interno | tabla + inspector      | PASS      |

Evidencia:

- `docs/design/waste-operations-final-selected-1280x900.png`;
- `docs/design/waste-operations-final-detail-390x844.png`;
- `docs/design/waste-operations-final-1440x900.png`.

### Comparación final con la dirección A

1. Se conserva el shell sobrio y el contexto activo, pero se omiten búsqueda,
   comando y periodo porque no tienen contrato real.
2. `Requiere atención` usa excepciones reales; no replica las tareas ficticias
   del concepto.
3. El rail mantiene las nueve fases y agrega conteos provenientes de la API.
4. El libro usa columnas explícitas y representación móvil, sin filtros,
   búsqueda o paginación aparentes.
5. El inspector implementa resumen, avance, timeline y excepciones reales; no
   muestra asignación, base procedimental o adjuntos inexistentes.
6. En móvil el inspector se convierte en una tarea de pantalla completa.

**Dictamen final del coordinador:** PASS visual y funcional limitado al demo
interno y a los viewports ejecutados. No acredita WCAG 2.2 AA completa,
producción, cumplimiento ambiental, cierre interno ni los escenarios avanzados
que permanecen pendientes en las secciones 9 y 10.
