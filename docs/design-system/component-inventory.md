# Inventario y contrato de componentes

## Alcance de la auditoría

Auditoría estática de la interfaz React existente, sin cambios de código. Se
revisaron:

- `apps/web/src/components/{Ui,AppShell,Charts,Icons,ErrorBoundary}.tsx`;
- `apps/web/src/features/shared/OperationalUi.tsx`;
- `apps/web/src/features/phase3/components/Phase3Ui.tsx`;
- las páginas consumidoras, `styles.css`, `phase3.css` y dependencias de
  `apps/web/package.json`.

El frontend auditado es React 19 + Vite 7, sin librería de primitives, sin
Storybook y sin framework de utilidades CSS. Usa controles HTML nativos,
`lucide-react`, React Hook Form, Zod, TanStack Query y gráficos SVG propios.
No se encontró un módulo frontend de residuos, segregación o destino final. Por
ello, este documento reserva contratos de dominio pero no inventa componentes,
datos ni estados regulatorios.

## Resumen ejecutivo

### Conservar

- `Button`, `Field`, `TextInput`, `LoadingState`, `EmptyState` y `PageHeader`;
- `StatusBadge`, `ErrorNotice`, `FormActions` y funciones de formato;
- patrón de `ResponsiveRecords`: tabla en escritorio y lista orientada a tarea
  en móvil;
- `AppShell`, filtrado de navegación por permiso/módulo y estado de conexión;
- `ErrorBoundary`;
- `lucide-react` como fuente única de iconos;
- gráficos SVG sin dependencia cuando la pregunta y accesibilidad estén
  suficientemente cubiertas.

### Consolidar antes de migrar pantallas

- `PageHeader` + `Phase3Header`;
- `.section-tabs` + `Tabs/.p3-tabs`;
- `ResponsiveRecords` + `ResourcePanel`;
- `.dashboard-panel`, `.p3-panel` y contenedores de formulario;
- `.notice`, `.warning`, `.form-alert`, `.p3-error`, `.p3-success`,
  `.p3-warning` y avisos legales;
- inputs `.input` y controles duplicados en `phase3.css`;
- botones directos y `FormActions` sobre el primitive `Button`;
- tokens `p3-*` sobre tokens semánticos globales.

### Retirar o corregir

- `Toolbar` está exportado pero no tiene consumidores: retirarlo o convertirlo
  en el `ActionBar` común cuando exista un caso real;
- `ErrorBoundary` usa `className="button secondary"` en vez del contrato
  `button-secondary`; debe consumir `Button`;
- estados no reconocidos en `StatusBadge` caen a una apariencia neutral sin
  exponer tipo semántico;
- `Tabs` implementa roles básicos, pero no navegación con flechas, relación
  `tab`/`tabpanel`, `id`, `aria-controls` ni gestión de foco;
- `ResourcePanel` descubre columnas desde el payload. Es útil para superficies
  administrativas controladas, pero no es un patrón aceptable para información
  sensible ni tablas operativas de dominio.

## Evidencia de uso

Conteo estático aproximado de instancias JSX:

| Componente | Usos | Decisión |
|---|---:|---|
| `Button` | 70 | conservar y ampliar |
| `Field` | 94 | conservar y endurecer accesibilidad |
| `TextInput` | 58 | conservar; formar familia de controles |
| `PageHeader` | 24 | conservar como base consolidada |
| `LoadingState` | 25 | conservar con variantes |
| `EmptyState` | 4 directos | conservar; añadir acción opcional |
| `StatusBadge` | 33 | reemplazar internamente por `StatusIndicator` tipado |
| `ErrorNotice` | 25 | integrar en `FeedbackMessage` |
| `ResponsiveRecords` | 15 | conservar y evolucionar |
| `FormActions` | 13 | conservar sobre `Button` |
| `Phase3Header` | 8 | migrar a `PageHeader` |
| `ResourcePanel` | 9 | dividir panel/estado/tabla |
| `Tabs` de Fase 3 | 5 | consolidar con tabs generales |
| `QuickCreate` | 1 | conservar como patrón local, no como primitive |
| cada gráfico SVG | 1 | evaluar por pregunta antes de generalizar |
| `Toolbar` | 0 | retirar o convertir con un consumidor real |

Los conteos no equivalen a cobertura ni calidad; sirven para priorizar una
migración que preserve las superficies más usadas.

## Componentes fundacionales

### `Button`

**Anatomía:** elemento `button` → icono inicial opcional → etiqueta → indicador
de carga opcional → icono final opcional.

**Variantes:** `primary`, `secondary`, `danger`, `ghost`, `link`.
`primary` se limita a una acción dominante por región. `danger` exige texto
explícito y, cuando la operación lo requiera, confirmación/reauth en el flujo.

**Tamaños/densidad:** `comfortable` 42–44 px; `compact` 36–40 px solo en
escritorio; `field` 48–52 px.

**Estados:** default, hover, focus-visible, active, disabled, loading. `selected`
solo si actúa como toggle y expone `aria-pressed`. Success/warning se expresan
como feedback adyacente, no cambiando silenciosamente el botón.

**Accesibilidad:** `type="button"` por defecto salvo submit explícito; nombre
accesible obligatorio para icon-only; loading usa `disabled` o `aria-disabled`
según si debe conservar foco y anuncia el resultado en región de estado.

### `IconButton`

**Base actual:** botones de menú/cierre del shell.

**Anatomía:** botón → icono Lucide → etiqueta accesible → badge opcional.

**Variantes:** neutral, inverse, danger; tamaños 40, 44 y 48 px. Nunca usa solo
un `title`.

### Familia de controles

Incluye `TextInput`, `Select`, `Textarea`, `Checkbox`, `FileInput`,
`SearchInput` y, cuando exista necesidad real, `Combobox`.

**Anatomía:** `Field` → etiqueta visible → indicador requerido → control →
ayuda → error/estado.

**Variantes:** comfortable/compact; con prefijo/sufijo; readonly; búsqueda.

**Estados:** default, hover, focus-visible, disabled, readonly, loading
cuando la fuente es remota, invalid, success y warning. Los últimos tres
incluyen mensaje persistente y `aria-describedby`.

**Deuda actual:** `Field` envuelve el control con `label`, lo que funciona para
inputs simples, pero no modela grupos, ayuda + error, `fieldset/legend` ni IDs
explícitos. La evolución debe generar o aceptar `id`, componer descripciones y
no anidar labels.

### `FeedbackMessage`

Consolida avisos actuales.

**Anatomía:** icono no exclusivo → título opcional → mensaje → detalle/acción.

**Variantes:** info, success, warning, danger, pending, legal, demo.

**Semántica:** `role="alert"` solo para error urgente nuevo; `role="status"` para
confirmación no urgente; aviso legal persistente usa contenido normal. Un estado
no confirmado no se etiqueta como éxito.

### `StatusIndicator`

Evolución tipada de `StatusBadge`.

**Anatomía:** marcador/icono → etiqueta en español → detalle opcional.

**Variantes semánticas:** neutral, info, pending, success, warning, danger,
blocked, disabled. El mapeo de un estado de API a una variante reside en el
módulo, no en comparación global de strings.

**Densidad:** inline y table. Evitar pills para todo; en tablas densas puede ser
texto + marcador.

**Dominio residuos:** los estados `hazardous`, `recoverable` y `compliance`
requieren contratos backend y catálogo verificado antes de incorporarse.

### `LoadingState`, `EmptyState` y `ErrorState`

Forman la familia `AsyncState`.

**Anatomía:** indicador/icono → título → explicación → acción opcional.

**Variantes:** page, panel, inline, table/list.

**Reglas:** la carga conserva contexto; no usar un spinner de `45vh` dentro de
paneles pequeños. El vacío distingue “sin datos”, “sin resultados de filtro” y
“sin permiso”. Error ofrece reintento solo si la acción es segura. Ningún estado
inventa métricas ni registros.

## Navegación y estructura

### `AppShell`

**Se conserva:** sidebar persistente en escritorio, drawer en móvil, topbar,
contexto de empresa/sede, estado de conexión y usuario.

**Anatomía objetivo:** skip link → navegación primaria → scrim/drawer móvil →
workspace → topbar → contexto → centro de excepciones/notificaciones → menú de
usuario → `main`.

**Variantes:** expanded/collapsed en escritorio; drawer móvil; online/offline;
navigation-loading; permiso/módulo filtrado.

**Estados y riesgos:** restaurar foco al cerrar drawer; bloquear scroll bajo el
drawer; `Escape` cierra; el selector de contexto actual parece interactivo pero
no tiene comportamiento visible en el componente auditado y no debe presentarse
como selector funcional hasta conectarlo.

### `PageHeader`

Consolida `PageHeader` y `Phase3Header`.

**Anatomía:** contexto/breadcrumb opcional → `h1` → descripción opcional →
metadatos/estado opcional → área de acción.

**Variantes:** standard, operational, detail, mobile-field. No crea un hero.

### `Tabs`

**Anatomía:** tablist → tabs → panel asociado.

**Variantes:** underline, segmented solo para conjuntos cortos; scrollable en
móvil.

**Estados:** default, hover, focus-visible, selected, disabled.

**Teclado:** flechas según orientación, Home/End, activación manual o automática
documentada; IDs y `aria-controls` emparejados. Ocultar todas las pestañas menos
la activa en móvil, como hace `.section-tabs`, elimina descubribilidad y debe
reemplazarse por tabs desplazables o selector explícito.

### `Breadcrumbs`

Solo para jerarquías reales de tres o más niveles. Usa `nav` con etiqueta,
lista ordenada y `aria-current="page"`. No sustituye el contexto de módulo.

### `CommandPalette` y búsqueda global

No existen. Se documentan como candidatos, no como componentes aprobados. Solo
se implementan cuando haya rutas de búsqueda reales, permisos y contratos API.

## Contenedores y composición operativa

### `Panel`

Consolida `.dashboard-panel`, `.p3-panel`, paneles de carga y formularios.

**Anatomía:** header → título/metadatos/acción → cuerpo → footer opcional.

**Variantes:** plain, bordered, elevated-popover, inspector, form. Densidad
comfortable/compact. No se convierte cada bloque en tarjeta.

### `ActionBar`

Evolución de `operational-toolbar`; `Toolbar` sin uso no se conserva como API.

**Anatomía:** búsqueda/filtros → resumen de resultados → acciones principales y
de lote.

**Responsive:** en móvil, búsqueda completa y filtros en superficie táctil;
acciones secundarias en menú solo si siguen siendo descubribles.

### `QuickCreate`

Patrón compuesto, no primitive.

**Base útil:** formulario contextual, idempotencia y feedback real.

**Condiciones para conservar:** foco inicial, `Escape`, focus trap si se comporta
como diálogo, cierre y restauración de foco, prevención de pérdida de cambios,
etiquetas/errores y comportamiento de pantalla completa en móvil. No usarlo para
flujos largos ni operaciones de alta consecuencia.

### `Drawer` / inspector contextual

No existe todavía. Candidato para detalle de registro sin perder la cola o
línea de proceso. Requiere foco gestionado, cierre por `Escape`, encabezado,
acción principal y URL/estado recuperable cuando el detalle sea navegable.

### `Dialog`

No hay primitive auditado. Debe reservarse para confirmación o decisión corta;
los formularios largos permanecen en página, panel o drawer.

## Datos y registros

### `ResponsiveRecords`

**Se conserva como patrón central.**

**Anatomía escritorio:** caption accesible → action/filter context → table →
thead → tbody → fila → celdas → acciones.

**Anatomía móvil:** lista de registros → artículo/enlace → identidad primaria →
estado → datos decisivos → acción.

**Variantes:** simple, selectable, expandable, actionable; comfortable/compact.
Pinned columns, sorting, bulk selection o virtualización se añaden solo si el
flujo y volumen real los requieren.

**Estados:** loading, empty, filtered-empty, error, partial, stale y permission
denied.

**Deuda actual:** falta `caption`, asociación explícita de headers para tablas
complejas, ordenamiento, paginación y estado de selección. La transformación
móvil existente es correcta en intención: no comprime una tabla.

### `ResourcePanel`

Se divide en `Panel` + `AsyncState` + `ResponsiveRecords`. El descubrimiento
automático de campos se restringe a herramientas administrativas controladas.
Para dominio operativo, columnas, etiquetas, formato, sensibilidad y acciones
son declarativos.

### Visualizaciones existentes

| Componente | Estado | Decisión |
|---|---|---|
| `TrendChart` | SVG responsive, `aria-label` resumido | conservar provisionalmente; añadir descripción/tabular y estado vacío |
| `BarChart` | barras HTML con lista | conservar; exponer valor y unidad en nombre accesible |
| `DonutChart` | SVG + leyenda | usar solo para composición justificada; no generalizar |
| `ProgressBar` | puramente visual | añadir semántica `progressbar` o texto equivalente |
| `ComparisonBars` | visual | añadir tabla/texto equivalente y unidad |

La API de color libre de `DonutChart` no debe usarse para categorías de residuos
sin el catálogo semántico. Ningún gráfico se presenta como interactivo hasta
tener filtro/drill-down real.

## Formularios y flujos

### `FormActions`

**Conservar**, implementado con `Button`.

**Anatomía:** acción cancelar/volver → acción secundaria opcional → submit.

**Responsive:** sticky dentro del flujo móvil, respetando safe area; no tapa
errores ni último campo.

**Estados:** pristine, dirty, validating, submitting, success, failed. El texto
“Procesando…” mantiene contexto específico cuando sea posible.

### `Stepper`

Existe como CSS específico SST, sin primitive.

**Anatomía:** lista ordenada → paso con etiqueta visible → estado
completed/current/pending/blocked.

**Reglas:** no codificar progreso con `nth-child`; recibir el estado real. En
móvil no ocultar nombres si son necesarios para orientarse. Permitir volver sin
perder borrador cuando el flujo lo soporte.

### `FileUpload`

Hay tres patrones: organización, documentos/comprobantes y OCR.

**Consolidar:** etiqueta/dropzone, formatos, límite, privacidad, archivo
seleccionado, progreso, error, retiro y reintento.

**Estados:** idle, drag-over, selected, uploading, processing, success, rejected
por tipo/tamaño, failed. Cámara/capture se conserva solo donde ya está soportada
y probada; no se incorpora escaneo QR, geolocalización ni firma.

## Matriz de anatomía y estados obligatorios

| Familia | Selected | Loading | Invalid | Success/warning | Compact |
|---|---|---|---|---|---|
| Button | solo toggle | sí | no | feedback adyacente | sí |
| Input/Select/Textarea | no | remoto | sí | sí, con texto | sí escritorio |
| Checkbox/Radio/Switch | sí | no | sí | feedback de grupo | sí escritorio |
| Tabs | sí | no | no | no | sí |
| StatusIndicator | implícito | pending | no | núcleo del componente | sí |
| Panel | no | sí | no | aviso interno | sí |
| ResponsiveRecords | fila opcional | sí | no | fila/aviso | sí |
| QuickCreate | no | sí | sí | sí | no móvil |
| Drawer/Dialog | no | sí | sí en formulario | sí | no |

Hover, focus-visible, active y disabled se implementan para todo control que los
admita. La matriz solo muestra estados adicionales.

## Storybook y dependencias

### Decisión

**Storybook: diferir instalación, aprobar piloto durante la fase de
implementación del sistema de diseño.** El stack React/Vite es compatible en
arquitectura, pero hoy no hay components tests ni tokens semánticos
implementados. Instalarlo antes de consolidar APIs documentaría duplicados.

El piloto debe cubrir `Button`, controles/`Field`, `FeedbackMessage`,
`StatusIndicator`, `Tabs`, `AsyncState`, `Panel` y `ResponsiveRecords` con
densidades, estados, teclado y viewports. Si el piloto complica el build de
producción o la política de licencias, se conserva documentación MDX/HTML
aislada y pruebas Vitest/Playwright como equivalente.

### Evaluación de herramientas

No se propone instalar dependencias en este entregable. Versiones, advisories y
licencias deben verificarse con el lockfile, registro oficial y escaneo del
proyecto en el momento de una instalación.

| Herramienta | Necesidad | Compatibilidad/impacto | Alternativa presente | Decisión |
|---|---|---|---|---|
| Storybook con adapter React/Vite | catálogo aislado, estados y QA visual | solo desarrollo; añade configuración y varias dependencias; no debe entrar al bundle productivo | páginas reales + Playwright | piloto diferido |
| addon de accesibilidad de Storybook | chequeos automáticos por historia | desarrollo; no sustituye teclado/lector manual | Playwright + auditoría manual | incluir si se aprueba piloto |
| interacción/test runner de Storybook | estados y teclado en historias | aumenta tiempo de CI | Vitest/Playwright existentes | evaluar tras piloto |
| Base UI u otra primitive accesible | tabs, dialog, popover, combobox, focus | dependencia de runtime y migración progresiva | HTML nativo + componentes actuales | evaluar solo para primitives complejos |
| shadcn/ui | acelera composición, pero genera código y puede duplicar estilos | alto impacto de adopción para un CSS existente | componentes actuales | rechazar adopción masiva; posible adopción selectiva con evidencia |
| Tailwind CSS 4 | utilidades/tokens | migración amplia, dos sistemas CSS durante transición | CSS actual | rechazar en esta modernización |
| Motion for React | transiciones complejas | runtime adicional | CSS y `prefers-reduced-motion` actuales | rechazar hasta caso probado |
| TanStack Table | tablas avanzadas | útil solo con sorting/columnas/selección reales | `ResponsiveRecords` | diferir hasta volumen y funciones confirmados |
| TanStack Virtual | listas grandes | requiere medición de volumen y QA de foco | render actual | diferir |
| axe-core en pruebas | detección automática de fallos comunes | solo pruebas; bajo impacto productivo | inspección manual | proponer en fase QA |

Para cada paquete que finalmente se apruebe se registrará: nombre oficial,
versión fijada, necesidad, alternativa, tamaño antes/después, licencia,
advisories, mantenimiento, cambios de lockfile y rollback. No se afirma aquí un
estado de seguridad vigente porque no se realizó instalación ni auditoría
remota de paquetes.

## Orden de implementación recomendado

1. Crear aliases de tokens semánticos sin cambiar apariencia.
2. Ampliar `Button`, `Field`, controles y `FeedbackMessage`.
3. Consolidar headers, tabs, paneles y estados asíncronos.
4. Migrar `ResponsiveRecords`/`ResourcePanel`.
5. Endurecer `AppShell`, foco y navegación móvil.
6. Implementar el piloto Storybook y decidir continuidad.
7. Crear primitives complejos solo cuando una pantalla aprobada los necesite.
8. Crear componentes de residuos únicamente después de tener contratos, datos,
   permisos y estados de negocio verificados.

## Criterios de aceptación para un componente

- API tipada sin `any`;
- anatomía y variantes documentadas;
- todos los estados aplicables visibles y probados;
- nombre, rol, valor y estado accesibles;
- teclado y restauración de foco cuando corresponda;
- contraste y reflow verificados;
- comfortable y compact documentados cuando apliquen;
- móvil no es una tabla comprimida;
- no expone secretos ni confía en IDs de tenant/empresa del navegador;
- usa datos y permisos reales;
- historia/prueba aislada si Storybook se aprueba;
- prueba de integración en el flujo real;
- sin dependencia nueva salvo decisión registrada.
