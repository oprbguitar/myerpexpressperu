# Auditoría de accesibilidad y rendimiento

**Producto:** ERP Express Perú
**Superficie:** `apps/web` (React 19 + Vite PWA)
**Fecha de corte:** 2026-07-27
**Objetivo:** evaluación orientada a WCAG 2.2 nivel AA y línea base técnica de rendimiento
**Resultado:** **condicional; no se puede declarar conformidad WCAG 2.2 AA ni cumplimiento de Core Web Vitals**

## 1. Alcance y método

Esta auditoría revisa el código fuente, estilos, configuración de compilación, artefactos web generados y pruebas E2E existentes. No modifica código.

Evidencia revisada:

- `apps/web/src/App.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/Ui.tsx`
- `apps/web/src/components/Charts.tsx`
- `apps/web/src/features/shared/OperationalUi.tsx`
- `apps/web/src/features/phase3/components/Phase3Ui.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/features/phase3/phase3.css`
- `apps/web/vite.config.ts`
- `playwright.config.ts`
- `tests/e2e/shell.spec.ts`
- `tests/e2e/phase3.spec.ts`
- `tests/e2e/module-enforcement.spec.ts`
- `apps/web/dist`

Límites de la evidencia:

- No se ejecutó Lighthouse.
- No existen mediciones actuales de LCP, INP, CLS, TTFB ni FCP.
- No se ejecutó axe-core ni otra prueba automática equivalente.
- No se realizó recorrido manual completo solo con teclado.
- No se realizó validación con NVDA, JAWS, VoiceOver ni TalkBack.
- No se verificaron contraste y estados interactivos mediante navegador en esta auditoría; los ratios indicados se calcularon únicamente a partir de colores declarados en CSS.
- No se probaron zoom al 200 %, reflow a 320 CSS px ni todos los viewports de aceptación.

Por esos límites, los hallazgos son riesgos o defectos observables en código, no una certificación de conformidad.

## 2. Línea base verificada

### 2.1 Compilación y paquete

| Artefacto            |                   Tamaño |          Gzip | Lectura                                                                                                                                             |
| -------------------- | -----------------------: | ------------: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript principal |                290.34 kB |      91.44 kB | Es el costo compartido más importante; está por debajo del aviso configurado de 500 kB, pero todavía necesita presupuesto y medición de carga real. |
| Chunk `zod`          |                 73.88 kB |      22.37 kB | Costo compartido relevante para validación; debe mantenerse fuera de rutas que no lo necesiten.                                                     |
| CSS principal        |                 22.17 kB | No registrado | Base global.                                                                                                                                        |
| CSS Fase 3           |                  9.57 kB | No registrado | Carga adicional de Fase 3.                                                                                                                          |
| Precache PWA         | 37 entradas, 1422.36 KiB |     No aplica | Incluye todos los chunks de rutas y el icono PWA.                                                                                                   |

El código sí usa división por ruta mediante `lazy()` y `Suspense` en `apps/web/src/App.tsx`. Las páginas de Fase 2 y Fase 3 se generan como chunks separados.

### 2.2 Pruebas E2E

Resultado registrado: **20 pruebas pasan y 10 se omiten**.

La configuración cubre:

- Chromium de escritorio;
- Chromium móvil con perfil Pixel 7;
- WebKit de escritorio.

La suite verifica ausencia de overflow horizontal en:

- login;
- venta rápida móvil;
- centro administrativo de Fase 3.

La suite no prueba:

- navegación completa con `Tab`, `Shift+Tab`, flechas y `Escape`;
- orden y restauración de foco;
- nombre, rol y estado de todos los componentes;
- contraste;
- zoom/reflow;
- lectores de pantalla;
- reduced motion;
- accesibilidad de tablas y gráficos;
- rendimiento de navegación o interacción.

Las 10 omisiones no son pruebas aprobadas. Varias son condicionadas por proyecto, por lo que la cobertura efectiva difiere entre Chromium móvil, Chromium escritorio y WebKit.

## 3. Fortalezas observables

1. **Estructura principal semántica.** El shell usa `aside`, `nav`, `header` y `main`, y cada pantalla principal expone un `h1`.
2. **Controles nativos.** La mayoría de acciones usan `button`, `input`, `select`, `textarea`, `details/summary` y enlaces reales.
3. **Etiquetas de formulario.** El componente `Field` envuelve los controles con `label`; los formularios de Fase 3 siguen el mismo patrón en la mayoría de campos.
4. **Estados anunciables.** Existen usos correctos de `role="alert"`, `role="status"` y `aria-live="polite"` en errores, confirmaciones y la respuesta de IA.
5. **Estados no dependientes solo del color.** Las insignias mantienen texto visible; tendencias usan dirección y porcentaje además del color.
6. **Responsive específico.** A 820 px las tablas operativas se sustituyen por tarjetas móviles y los formularios pasan a una columna.
7. **Objetivos táctiles básicos.** Los controles interactivos observados superan el mínimo WCAG 2.2 de 24 × 24 CSS px. Algunos controles móviles quedan por debajo del objetivo ergonómico recomendado de 44 × 44 px, pero no del mínimo AA.
8. **Reduced motion.** `styles.css` y `phase3.css` incluyen `prefers-reduced-motion: reduce` y neutralizan animaciones y transiciones.
9. **Datos de gráficos acompañados por texto.** Barras, dona y comparaciones muestran etiquetas y valores visibles, reduciendo la dependencia exclusiva del color.
10. **Carga diferida.** La aplicación evita concentrar todas las pantallas en un único chunk de página.

## 4. Hallazgos de accesibilidad

### A11Y-01 — Menú móvil sin aislamiento ni gestión de foco

**Severidad:** seria
**WCAG 2.2 relacionada:** 2.1.1 Teclado, 2.4.3 Orden del foco, 2.4.11 Foco no oculto (mínimo), 4.1.2 Nombre, función y valor

En `AppShell.tsx`, el `aside` móvil se desplaza fuera de pantalla cuando está cerrado, pero continúa presente y no usa `inert`, `aria-hidden` ni deshabilita sus enlaces. Al abrirlo:

- el foco no se mueve al menú o al botón de cierre;
- no existe contención de foco;
- `Escape` no cierra el panel;
- al cerrar no se restaura el foco al botón que lo abrió;
- el botón de apertura no expone `aria-expanded` ni `aria-controls`.

Impacto: una persona que usa teclado puede llegar a enlaces visualmente fuera de pantalla o abandonar el panel sin entender el cambio de contexto.

**Acción requerida:** implementar el menú como drawer accesible: estado expandido, relación control-panel, foco inicial, `Escape`, contención mientras sea modal, aislamiento del fondo y restauración de foco.

### A11Y-02 — Patrón de pestañas incompleto y, en Empresa, semánticamente incorrecto

**Severidad:** seria
**WCAG 2.2 relacionada:** 1.3.1 Información y relaciones, 2.1.1 Teclado, 2.4.3 Orden del foco, 4.1.2 Nombre, función y valor

`CompanyPage.tsx` asigna `role="tab"` a cuatro botones, pero:

- solo la primera pestaña queda marcada siempre con `aria-selected="true"`;
- las otras permanecen siempre en `false`;
- no existen `tabpanel`, `aria-controls` ni `aria-labelledby`;
- el clic solo enfoca un campo;
- no hay navegación con flechas ni `tabIndex` itinerante;
- el campo enfocado puede quedar debajo del encabezado sticky al desplazarse.

`Phase3Ui.tsx` presenta el mismo patrón incompleto: cambia contenido, pero no declara panel asociado, controlado ni navegación de teclado propia del patrón tabs.

En móvil, `styles.css` oculta todas las pestañas de Empresa salvo la que declara `aria-selected="true"`, por lo que el componente deja de representar de forma coherente sus destinos.

**Acción requerida:** elegir uno de dos patrones:

1. pestañas reales con el patrón WAI-ARIA completo; o
2. enlaces de salto a secciones, sin roles de pestaña, con destinos identificados y `scroll-margin-top`.

### A11Y-03 — Formulario rápido emergente sin semántica ni foco

**Severidad:** seria
**WCAG 2.2 relacionada:** 2.1.1 Teclado, 2.4.3 Orden del foco, 2.4.11 Foco no oculto, 4.1.2 Nombre, función y valor

`QuickCreate` abre un formulario superpuesto. El activador solo declara `aria-expanded`; no declara `aria-controls`. El panel:

- no recibe foco al abrir;
- no tiene nombre de región o diálogo;
- no se cierra con `Escape`;
- no restaura foco;
- en móvil se vuelve `position: fixed` sin aislar el contenido de fondo.

**Acción requerida:** si el panel bloquea la tarea, usar `dialog`/modal accesible. Si es un popover no modal, relacionarlo con el activador, enfocar el primer campo, soportar `Escape` y restaurar el foco.

### A11Y-04 — Errores y obligatoriedad no siempre se asocian al control

**Severidad:** seria
**WCAG 2.2 relacionada:** 3.3.1 Identificación de errores, 3.3.2 Etiquetas o instrucciones, 3.3.3 Sugerencia ante errores, 4.1.3 Mensajes de estado

El componente `Field` muestra el error con `role="alert"`, pero no genera un identificador ni conecta el mensaje mediante `aria-describedby`; tampoco aplica `aria-invalid`.

Además:

- la prop visual `required` solo añade un asterisco con `aria-hidden`;
- varios campos marcados visualmente como requeridos no incluyen el atributo HTML `required`;
- el buscador de Productos usa únicamente `placeholder`, sin etiqueta ni `aria-label`;
- errores globales de carga como `.page-error` no siempre tienen `role="alert"`.

Impacto: el error puede anunciarse al aparecer, pero no queda programáticamente asociado cuando la persona vuelve al campo.

**Acción requerida:** hacer que `Field` genere IDs estables para ayuda/error, propague `aria-invalid`, `aria-describedby` y obligatoriedad real; etiquetar los buscadores y añadir resumen de errores con enlaces para formularios largos.

### A11Y-05 — Tablas sin caption ni alcance explícito de encabezados

**Severidad:** moderada
**WCAG 2.2 relacionada:** 1.3.1 Información y relaciones, 2.4.6 Encabezados y etiquetas

Las tablas de `AuditPage`, `ResponsiveRecords` y `ResourcePanel` no incluyen `caption`, `aria-labelledby` ni `scope="col"` en encabezados.

En las tablas sencillas el navegador puede inferir la relación, pero el nombre y propósito no quedan ligados de forma robusta, especialmente cuando hay varias tablas o títulos dinámicos.

**Acción requerida:** asociar cada tabla con su título visible, usar `caption` visualmente oculto cuando corresponda y declarar `scope="col"`. Para tablas complejas, añadir encabezados de fila y relaciones explícitas.

### A11Y-06 — Gráficos sin alternativa equivalente completa

**Severidad:** seria
**WCAG 2.2 relacionada:** 1.1.1 Contenido no textual, 1.3.1 Información y relaciones, 1.4.1 Uso del color

Situación observada:

- `TrendChart` anuncia cantidad de periodos y último valor, pero no comunica todos los pares periodo-valor ni la variación completa.
- `DonutChart` anuncia solo la cantidad de categorías. La leyenda visual contiene porcentajes, pero el SVG y la lista no se relacionan programáticamente.
- `BarChart` conserva etiqueta y valor como texto, lo cual es una buena base, pero no tiene título/descripción de conjunto.
- `ProgressBar` no tiene semántica de progreso ni está marcado como decorativo; el valor equivalente aparece al lado en el dashboard, pero esa equivalencia no se expresa.
- `ComparisonBars` muestra texto legible, aunque no expone una descripción del gráfico como unidad.

**Acción requerida:** proporcionar título, resumen y tabla/lista de datos equivalente; relacionar el gráfico con esa descripción. Marcar elementos puramente decorativos con `aria-hidden="true"` o usar `role="img"` solo cuando el nombre accesible comunique el mismo significado que la visualización.

### A11Y-07 — Indicador de foco global con contraste insuficiente

**Severidad:** seria
**WCAG 2.2 relacionada:** 1.4.11 Contraste no textual, 2.4.7 Foco visible

El estilo global elimina `outline` y usa únicamente una sombra azul al 22 %. Sobre blanco, el color compuesto aproximado es `#c9dcf4`, con ratio **1.40:1**, inferior a 3:1.

Los inputs agregan un borde azul de contraste suficiente, pero enlaces, botones y `summary` dependen de la sombra global.

**Acción requerida:** mantener un `outline` sólido de alto contraste o un anillo de al menos 3:1 frente a colores adyacentes; comprobar también foco sobre fondos azul oscuro, avisos y superficies coloreadas.

### A11Y-08 — Falta mecanismo directo para saltar navegación repetida

**Severidad:** moderada
**WCAG 2.2 relacionada:** 2.4.1 Evitar bloques

El shell tiene landmarks correctos, pero no existe enlace “Saltar al contenido”. Para una persona que navega solo con teclado, cada cambio de ruta puede exigir recorrer navegación y topbar.

**Acción requerida:** agregar un enlace de salto visible al recibir foco y un destino estable en `main`.

### A11Y-09 — Cambios de ruta y conectividad no se anuncian de forma consistente

**Severidad:** moderada
**WCAG 2.2 relacionada:** 2.4.2 Titulado de páginas, 4.1.3 Mensajes de estado

El estado en línea/sin conexión cambia visualmente, pero el contenedor no usa `role="status"` ni una región viva. En móvil, el texto se oculta con CSS y queda solo el icono visible.

Las rutas renderizan nuevos `h1`, pero no se observa actualización del título del documento ni foco/anuncio al encabezado principal después de navegar.

**Acción requerida:** anunciar cambios de conectividad sin interrumpir, actualizar `document.title` por ruta y definir una estrategia de foco posterior a navegación.

## 5. Contraste

Ratios calculados a partir de tokens CSS:

| Uso                                    | Colores               |  Ratio | Resultado estático           |
| -------------------------------------- | --------------------- | -----: | ---------------------------- |
| Texto muted global sobre blanco        | `#64748b` / `#ffffff` | 4.76:1 | Pasa AA para texto normal.   |
| Texto muted Fase 3 sobre blanco        | `#607087` / `#ffffff` | 5.04:1 | Pasa AA para texto normal.   |
| Encabezado de navegación sobre sidebar | `#8fb4d5` / `#072f55` | 6.24:1 | Pasa AA.                     |
| Enlace azul sobre blanco               | `#0b63ce` / `#ffffff` | 5.69:1 | Pasa AA.                     |
| Botón primario, blanco sobre verde     | `#ffffff` / `#047857` | 5.48:1 | Pasa AA.                     |
| Aviso ámbar                            | `#a85d00` / `#fff7e6` | 4.66:1 | Pasa AA por margen reducido. |
| Anillo de foco compuesto sobre blanco  | `#c9dcf4` / `#ffffff` | 1.40:1 | No alcanza 3:1.              |

Esta muestra no valida hover, active, selected, disabled, placeholder, texto sobre gradientes ni composiciones reales con transparencia. Es necesario comprobar cada estado en navegador.

## 6. Navegación por teclado y lectores de pantalla

### Estado actual

- Controles nativos permiten una base razonable de teclado.
- `details/summary` ofrece interacción nativa para el menú de usuario.
- Botones de icono principales tienen `aria-label`.
- No se detectaron `div` o `span` usados como botones mediante `onClick`.

### Cobertura faltante

Debe verificarse manualmente:

1. orden completo de `Tab` y `Shift+Tab`;
2. menú móvil cerrado, abierto y cierre con `Escape`;
3. restauración de foco en drawer, formularios emergentes y formularios condicionales;
4. patrón tabs con flechas, Home y End si se conserva como tabs;
5. errores de formulario y resumen de errores;
6. lectura de tablas con navegación por encabezados;
7. lectura equivalente de gráficos;
8. anuncios de carga, guardado, error, conexión y navegación;
9. nombres de controles de archivo y estado del archivo elegido;
10. pruebas NVDA + Chromium y VoiceOver + WebKit como mínimo.

## 7. Responsive y reflow

### Evidencia favorable

- El CSS define cortes a 1100, 820, 620 y 480 px.
- Inputs móviles usan 16 px para evitar zoom automático en iOS.
- Tablas operativas tienen presentación móvil alternativa.
- Formularios y paneles complejos pasan a una columna.
- Acciones críticas usan barras inferiores con safe-area.
- Las pruebas E2E verifican ausencia de overflow horizontal en tres superficies.

### Riesgos pendientes

1. No hay cobertura registrada para 360 × 800, 390 × 844, 768 × 1024, 1366 × 768, 1440 × 900 y 1920 × 1080.
2. WebKit se ejecuta solo en escritorio; no hay prueba Safari/iOS móvil.
3. No se verificó zoom al 200 % ni reflow equivalente a 320 CSS px.
4. El drawer móvil y los formularios fixed pueden ocultar foco o contenido cuando aparece el teclado virtual.
5. La barra sticky/fixed puede tapar el objetivo enfocado si no se configura `scroll-margin`.
6. El carril de métricas usa scroll horizontal intencional; requiere indicador perceptible y prueba con teclado/táctil.
7. El E2E actual comprueba overflow a nivel documento, pero no truncamiento, solapamiento, contenido tapado ni foco fuera del viewport.

## 8. Hallazgos de rendimiento

### PERF-01 — El precache PWA descarga todas las rutas

**Severidad:** alta

`globPatterns` incluye todos los archivos JS y CSS generados. El service worker precachea 37 entradas por **1422.36 KiB**, incluidos chunks de pantallas que el usuario puede no abrir.

Consecuencias:

- la división por ruta reduce parseo inicial, pero no el costo total de instalación/actualización del service worker;
- cada release puede volver a transferir una parte significativa del paquete;
- redes móviles y dispositivos con almacenamiento limitado pagan por módulos no usados.

El archivo `icons/icon-1024.png` pesa **932,180 bytes**, aproximadamente **64 %** del precache registrado. Además, el `sw.js` generado lista `icons/icon-1024.png` dos veces porque se configura tanto como `includeAssets` como en el patrón global.

**Acción requerida:** generar iconos optimizados en tamaños de manifiesto adecuados, eliminar la entrada duplicada y limitar precache al shell esencial. Cargar chunks de rutas bajo demanda con estrategia runtime acorde a criticidad y sensibilidad.

### PERF-02 — No existen presupuestos de paquete exigibles

**Severidad:** alta

`chunkSizeWarningLimit: 500` solo genera un aviso por chunk sin comprimir. No se observa un gate por:

- tamaño gzip del entry;
- suma de recursos iniciales por ruta;
- CSS;
- precache;
- crecimiento respecto a la línea base.

**Acción requerida:** incorporar un presupuesto en `check:bundle` que falle ante regresiones materiales y registre tamaños crudos y gzip por ruta.

### PERF-03 — Las listas renderizan tabla y tarjetas móviles al mismo tiempo

**Severidad:** alta para volúmenes grandes

`ResponsiveRecords` y `ResourcePanel` construyen simultáneamente:

- una tabla de escritorio; y
- una lista completa de tarjetas móviles.

CSS oculta una de las dos representaciones, pero React igualmente crea ambas ramas y el DOM contiene el doble de registros. `ResourcePanel` no pagina ni virtualiza. Varias pantallas solicitan hasta 100 filas; el impacto aumenta con columnas, acciones y datos de Fase 3.

**Acción requerida:** renderizar una sola representación según una estrategia adaptable estable, paginar en servidor y virtualizar solo cuando el volumen y patrón de interacción lo justifiquen. Medir scripting, nodos DOM, memoria e INP con 100, 500 y 1000 registros sintéticos autorizados.

### PERF-04 — Búsqueda remota por cada pulsación

**Severidad:** moderada

Clientes/proveedores y productos incorporan `search` directamente en `queryKey`. Cada cambio de texto dispara una nueva consulta sin debounce ni longitud mínima.

Consecuencias posibles:

- solicitudes abortadas o concurrentes innecesarias;
- cambios rápidos de estado de carga;
- mayor trabajo de red y servidor;
- peor respuesta en conexiones lentas.

**Acción requerida:** usar debounce, cancelación mediante `AbortSignal`, longitud mínima cuando corresponda y mantener resultados previos durante la transición. Medir solicitudes por búsqueda e INP.

### PERF-05 — No hay evidencia de rendimiento de usuario

**Severidad:** bloqueante para afirmar rendimiento

Los tamaños de build no permiten inferir LCP, INP, CLS o velocidad en dispositivos reales. No existen resultados Lighthouse ni datos de campo.

También quedan sin medir:

- costo de React Query y autenticación antes del primer contenido útil;
- waterfalls API por pantalla;
- latencia de `NetworkFirst` con timeout de 3 segundos;
- actualización del service worker;
- render de gráficos;
- formularios y tablas en hardware móvil;
- desplazamiento y teclado virtual.

**Acción requerida:** medir antes de optimizar y conservar resultados trazables por commit y entorno.

### PERF-06 — Source maps de producción aumentan el artefacto publicado

**Severidad:** baja para carga, moderada para distribución

`sourcemap: true` genera mapas grandes, incluido un mapa de aproximadamente 1.5 MB para el entry principal. No están incluidos en el precache y normalmente no afectan la navegación, pero sí aumentan el paquete desplegado y pueden quedar accesibles públicamente.

**Acción requerida:** decidir explícitamente si los mapas se publican, se suben de forma privada a observabilidad o se excluyen. Esto debe coordinarse con seguridad; no atribuirle una mejora de Core Web Vitals sin medición.

## 9. Objetivos de rendimiento propuestos

Estos son **gates recomendados**, no resultados actuales:

| Indicador                       |                                                               Objetivo |
| ------------------------------- | ---------------------------------------------------------------------: |
| LCP p75 móvil                   |                                                                ≤ 2.5 s |
| INP p75 móvil                   |                                                               ≤ 200 ms |
| CLS p75                         |                                                                 ≤ 0.10 |
| JavaScript compartido principal |                                                          ≤ 100 kB gzip |
| Chunk async individual          |                              ≤ 50 kB gzip, salvo excepción documentada |
| CSS total inicial por ruta      |                                                  ≤ 40 kB sin comprimir |
| Precache del shell esencial     |                            ≤ 1 MiB y sin chunks de rutas no esenciales |
| Regresión permitida por PR      |               ≤ 5 % por recurso presupuestado o justificación aprobada |
| Búsqueda incremental            | una solicitud tras pausa de 250–400 ms; solicitudes previas canceladas |
| Tabla operativa                 | paginación/virtualización definida antes de superar 100 filas visibles |

Los umbrales de Core Web Vitals siguen la clasificación “buena”; deben medirse en p75 y separarse por móvil/escritorio.

## 10. Plan de corrección priorizado

### P0 — Antes de afirmar accesibilidad AA

1. Corregir drawer móvil y gestión de foco.
2. Reemplazar o completar los dos patrones de tabs.
3. Corregir foco del formulario rápido.
4. Asociar errores, ayuda y obligatoriedad con cada campo.
5. aumentar contraste del foco global.
6. crear alternativas completas para gráficos.

### P1 — Antes del cierre de QA

1. Añadir skip link y estrategia de foco/título por ruta.
2. nombrar y estructurar tablas.
3. anunciar conectividad y estados asincrónicos.
4. probar teclado y lectores de pantalla.
5. ejecutar matriz responsive, zoom y reflow.
6. integrar axe-core como apoyo, sin sustituir pruebas manuales.

### P1 — Rendimiento

1. Optimizar iconos PWA y limitar precache.
2. establecer presupuestos en `check:bundle`.
3. evitar doble render de tablas/tarjetas.
4. paginar y definir umbral de virtualización.
5. aplicar debounce/cancelación a búsquedas.
6. ejecutar Lighthouse y captura de Core Web Vitals.

## 11. Criterios de revalidación

La auditoría podrá cerrarse con resultado favorable solo si existe evidencia de:

- recorrido completo por teclado sin foco fuera de pantalla ni atrapado;
- restauración de foco en componentes superpuestos;
- tabs o navegación de secciones con semántica coherente;
- contraste de texto, controles y foco en todos los estados;
- validación de formularios con NVDA y VoiceOver;
- tablas y gráficos con información equivalente;
- 200 % de zoom y reflow sin pérdida;
- viewports mínimos acordados, incluidos móvil y tablet;
- axe-core sin defectos críticos/serios, acompañado de revisión manual;
- Lighthouse reproducible en entorno documentado;
- LCP, INP y CLS registrados, no inferidos;
- prueba de tablas grandes y búsqueda incremental;
- presupuestos de bundle y precache ejecutados en CI.

## 12. Dictamen

La interfaz tiene una base sólida: landmarks, controles nativos, etiquetas, responsive específico, rutas lazy y soporte de reduced motion. Sin embargo, los defectos de foco y semántica en navegación móvil, tabs, formularios emergentes, errores y gráficos impiden declarar una implementación WCAG 2.2 AA.

En rendimiento, el build está dividido por rutas y el entry principal pesa 91.44 kB gzip, pero el precache de 1422.36 KiB descarga todos los módulos y está dominado por un icono de 932 KB. Sin Lighthouse ni Core Web Vitals, no existe evidencia suficiente para afirmar rendimiento de usuario. El estado correcto es **implementado con riesgos conocidos y pendiente de validación/corrección**, no “accesible AA” ni “optimizado”.
