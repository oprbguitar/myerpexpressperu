# Tokens del sistema de diseño

## Alcance y fuente de verdad

Este documento define el contrato semántico que debe guiar la modernización de
`apps/web`. No cambia todavía CSS ni comportamiento. La base auditada está en:

- `apps/web/src/styles.css`;
- `apps/web/src/features/phase3/phase3.css`;
- `docs/design/PHASE-3-DESIGN-SYSTEM.md`.

La implementación actual usa una paleta técnica (`navy`, `slate`, `emerald`,
`amber`) y una segunda paleta local `p3-*`. La evolución debe conservar los
valores útiles, pero las pantallas y componentes consumirán nombres semánticos.
Los valores de residuos, peligrosidad o cumplimiento no se deducen de la paleta
actual: deben llegar de catálogos y reglas de negocio verificados.

## Principios

1. Un token expresa propósito, no un color concreto.
2. El color de un contenedor o categoría de residuo no es color general de la
   interfaz.
3. Cada estado combina texto, icono o forma y color; el color nunca es la única
   señal.
4. Los contrastes se validan en cada par foreground/background y en todos los
   estados interactivos.
5. La densidad cambia espacio y altura, no tamaño mínimo táctil ni legibilidad.
6. Las cifras, fechas, unidades y estados provienen del sistema; los tokens no
   crean categorías, obligaciones ni resultados.

## Color

### Primitivos existentes que se conservan como base

| Token primitivo | Valor actual | Uso permitido |
|---|---:|---|
| `color.navy.950` | `#052744` | fondos de navegación de máxima profundidad |
| `color.navy.900` | `#072f55` | navegación principal |
| `color.navy.800` | `#0b426f` | selección y elementos de marca |
| `color.blue.600` | `#0b63ce` | enlace, foco y selección informativa |
| `color.emerald.700` | `#047857` | acción primaria actual |
| `color.emerald.600` | `#059669` | acento y feedback positivo |
| `color.emerald.50` | `#ecfdf5` | fondo positivo |
| `color.amber.700` | `#a85d00` | texto de advertencia |
| `color.amber.100` | `#fff7e6` | fondo de advertencia |
| `color.slate.950` | `#0b1f36` | texto principal |
| `color.slate.700` | `#334155` | texto secundario fuerte |
| `color.slate.500` | `#64748b` | texto atenuado sobre blanco |
| `color.slate.300` | `#cbd5e1` | borde fuerte/control |
| `color.slate.200` | `#e2e8f0` | borde y separador |
| `color.slate.100` | `#f1f5f9` | superficie secundaria |
| `color.white` | `#ffffff` | fondo y superficie |
| `color.red.700` | `#b42318` | error y peligro |

Antes de codificar, contraste y diferenciación de estados deben verificarse con
las combinaciones finales. Los valores `p3-*` no se mantienen como una tercera
paleta: se mapean a estos primitivos o se retiran al migrar cada componente.

### Tokens semánticos de interfaz

| Token | Valor inicial | Contrato |
|---|---:|---|
| `color.background.canvas` | `color.white` | fondo de trabajo |
| `color.background.subtle` | `color.slate.100` | zona secundaria, nunca como estado por sí sola |
| `color.surface.default` | `color.white` | panel, formulario, tabla |
| `color.surface.elevated` | `color.white` | popover, menú, drawer; requiere borde o sombra |
| `color.surface.selected` | azul muy claro por validar | selección persistente |
| `color.text.primary` | `color.slate.950` | contenido principal |
| `color.text.secondary` | `color.slate.700` | apoyo y metadatos relevantes |
| `color.text.muted` | `color.slate.500` | ayuda no crítica |
| `color.text.inverse` | `color.white` | texto sobre navegación/acción oscura |
| `color.text.link` | `color.blue.600` | enlaces y navegación contextual |
| `color.border.subtle` | `color.slate.200` | divisores y agrupación |
| `color.border.control` | `color.slate.300` | controles de entrada |
| `color.border.strong` | tono slate por validar | separación de alta relevancia |
| `color.focus.ring` | `color.blue.600` | anillo visible, no solo sombra difusa |
| `color.action.primary.bg` | `color.emerald.700` | acción principal de la vista |
| `color.action.primary.fg` | `color.white` | texto/icono de acción principal |
| `color.action.secondary.bg` | `color.white` | acción secundaria |
| `color.action.secondary.fg` | `color.slate.950` | texto/icono secundario |
| `color.action.secondary.border` | `color.slate.300` | límite de acción secundaria |
| `color.action.danger.bg` | `color.red.700` | acción destructiva confirmada |
| `color.action.danger.fg` | `color.white` | contenido de acción destructiva |
| `color.disabled.bg` | `color.slate.100` | control no disponible |
| `color.disabled.fg` | `color.slate.500` | contenido no disponible |
| `color.disabled.border` | `color.slate.200` | límite no disponible |
| `color.navigation.bg` | `color.navy.900` | navegación persistente |
| `color.navigation.item.fg` | valor actual `#dceafb` | opción no seleccionada |
| `color.navigation.item.selected` | valor actual `#15528b` | opción seleccionada |

### Tokens semánticos de feedback

Cada familia tiene `foreground`, `background`, `border` e `icon`. La etiqueta
visible y la semántica ARIA son obligatorias.

| Familia | Base actual | Significado |
|---|---|---|
| `feedback.success.*` | emerald | operación completada o condición favorable confirmada |
| `feedback.warning.*` | amber | requiere atención, pero no bloquea por definición |
| `feedback.danger.*` | red | error, riesgo alto o acción destructiva |
| `feedback.info.*` | blue | orientación o cambio informativo |
| `feedback.pending.*` | slate/blue | proceso o revisión todavía sin resultado |
| `feedback.neutral.*` | slate | condición sin valoración |

`success` no equivale a cumplimiento legal. `warning` no equivale a residuo
peligroso. Esos significados solo se asignan mediante reglas de negocio.

### Tokens de dominio reservados

Se define el espacio de nombres, no sus colores:

- `domain.waste-category.{category-id}.{foreground|background|border|marker}`;
- `domain.waste-hazardous.{foreground|background|border|icon}`;
- `domain.waste-recoverable.{foreground|background|border|icon}`;
- `domain.compliance.{compliant|partial|noncompliant|not-applicable|not-evaluated}.*`.

Reglas de activación:

1. `category-id` debe existir en el catálogo autoritativo.
2. La asociación con colores de contenedor requiere fuente oficial o regla
   interna aprobada y versionada.
3. `hazardous`, `recoverable` y `compliance` requieren estado real del backend;
   no se infieren del texto ni de una selección visual.
4. Cada marcador incorpora texto o icono distinguible.
5. `not-evaluated` y `not-applicable` son visualmente distintos de `compliant`.

## Tipografía

La familia actual se conserva: `Inter` cuando esté disponible y la pila de
sistema como fallback. No se incorpora una fuente remota hasta resolver
privacidad, carga y licencia.

| Token | Escritorio | Móvil | Uso |
|---|---|---|---|
| `type.page-title` | 32/38, 650 | 26/32, 650 | un `h1` por vista |
| `type.section-title` | 20/28, 650 | 18/26, 650 | sección principal |
| `type.panel-title` | 16/24, 650 | 16/24, 650 | panel/inspector |
| `type.body` | 14/22, 400 | 14/22, 400 | contenido estándar |
| `type.control` | 14/20, 600 | 16/22, 600 en inputs; 14/20 en botones | controles |
| `type.table-header` | 11/16, 650, tracking `0.04em` | no aplica a lista móvil | encabezado de columna |
| `type.table-body` | 13/20, 400 | 14/21, 400 | celdas y registros |
| `type.label` | 13/18, 620 | 14/20, 620 | etiqueta de campo |
| `type.help` | 12/18, 400 | 13/19, 400 | ayuda y metadatos |
| `type.legal-citation` | 12/19, 400 | 13/20, 400 | norma, fuente y fecha de consulta |
| `type.status` | 12/16, 600 | 12/16, 600 | estado textual |
| `type.numeric-metric` | 28/34, 700, tabular | 24/30, 700, tabular | cifra operativa vinculada a acción |
| `type.chart-annotation` | 12/17, 500 | 12/17, 500 | eje, leyenda y anotación |

Los pesos `580`, `620`, `650`, `720` usados actualmente pueden sintetizarse con
la pila del sistema. En implementación se normalizan a pesos disponibles o se
valida la fuente cargada; no se depende de síntesis para jerarquía crítica.

## Espaciado, tamaño y composición

Escala base de 4 px:

| Token | Valor | Uso típico |
|---|---:|---|
| `space.0` | 0 | reinicio |
| `space.1` | 4 px | separación mínima |
| `space.2` | 8 px | icono-texto, controles compactos |
| `space.3` | 12 px | grupo corto |
| `space.4` | 16 px | padding estándar |
| `space.5` | 20 px | panel compacto |
| `space.6` | 24 px | sección |
| `space.8` | 32 px | separación de bloques |
| `space.10` | 40 px | margen de contenido escritorio |
| `space.12` | 48 px | separación mayor |
| `space.16` | 64 px | cierre de página |

Tokens de composición:

- `layout.sidebar.width = 232px` mientras se conserve el shell actual;
- `layout.topbar.height = 64px` escritorio y `62px` móvil;
- `layout.content.max = 1240px`;
- `layout.content.inline = 40px` escritorio, `20px` móvil;
- `layout.touch-target.min = 44px`; se prefieren 48–52 px en flujos de campo;
- `layout.table.row.comfortable = 48–52px`;
- `layout.table.row.compact = 36–40px`, solo con puntero/teclado y nunca como
  objetivo táctil principal.

## Radio, borde y elevación

| Token | Valor inicial | Uso |
|---|---:|---|
| `radius.control` | 6 px | inputs, botones |
| `radius.surface` | 8 px | paneles y tablas |
| `radius.round` | 999 px | avatar/progreso; no para toda etiqueta |
| `border.width.default` | 1 px | controles y superficies |
| `border.width.emphasis` | 2 px | selección/foco |
| `elevation.popover` | `0 16px 36px rgb(8 32 68 / 15%)` | menú/popover |
| `elevation.panel` | `0 1px 2px rgb(15 23 42 / 3%)` | solo si el borde no basta |

No se aumenta el radio para “modernizar”; la especialización proviene de la
jerarquía, las relaciones operativas y la densidad, no de tarjetas redondeadas.

## Densidad

`comfortable` es el valor predeterminado. `compact` se aplica a tablas, colas y
matrices de escritorio cuando el usuario lo elige o el flujo lo justifica.

| Propiedad | Comfortable | Compact |
|---|---:|---:|
| altura de control | 42–44 px | 36–40 px |
| padding de celda | 13×15 px | 8×12 px |
| separación de formulario | 16–20 px | 12–16 px |
| padding de panel | 20–24 px | 16–20 px |
| tamaño de cuerpo | 14 px | 13 px |

En móvil se fuerza `comfortable`; los campos mantienen 16 px para evitar zoom
automático y las acciones de campo 48 px o más.

## Movimiento

| Token | Valor | Uso |
|---|---:|---|
| `motion.duration.instant` | 80 ms | feedback de presión |
| `motion.duration.fast` | 160 ms | hover, foco, selección |
| `motion.duration.standard` | 240 ms | drawer, panel contextual |
| `motion.duration.slow` | 400 ms máximo | cambio complejo que muestra continuidad |
| `motion.easing.standard` | `cubic-bezier(.2, 0, 0, 1)` | transiciones |
| `motion.easing.exit` | `cubic-bezier(.4, 0, 1, 1)` | salidas |

Reglas:

- no se anima una carga para ocultar demora;
- la entrada se limita a opacidad y desplazamiento de 4–8 px;
- el foco no se anima;
- barras y visualizaciones actualizan sin distorsionar la lectura;
- con `prefers-reduced-motion: reduce`, duración efectiva `0–1 ms`, sin
  desplazamiento ni transiciones de layout, manteniendo feedback inmediato.

## Contrato de estados interactivos

Todo componente interactivo documenta y prueba:

- `default`;
- `hover` cuando existe puntero;
- `focus-visible` con anillo de 2 px y separación perceptible;
- `active`;
- `selected` mediante `aria-selected`, `aria-current` o estado equivalente;
- `disabled`, sin depender solo de opacidad;
- `loading`, conservando etiqueta y ancho cuando sea posible;
- `invalid`, asociado a ayuda/error mediante `aria-describedby`;
- `success`;
- `warning`.

No todos los estados aplican a todos los componentes. Cuando no aplica, la
historia o prueba del componente lo declara explícitamente.

## Convención de implementación futura

La primera implementación debe declarar tokens CSS en `:root` con nombres
semánticos y aliases a los primitivos existentes. Los componentes consumen
únicamente tokens semánticos. Los alias permiten una migración pantalla por
pantalla sin cambiar la identidad actual ni crear un segundo tema.

No se habilita modo oscuro en esta fase: no existe actualmente y añadirlo
duplicaría validación de contraste, estados, tablas, documentos y gráficos.
