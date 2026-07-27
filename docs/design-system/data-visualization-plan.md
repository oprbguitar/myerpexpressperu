# Plan de visualización de datos operativos

**Proyecto:** ERP Express Perú
**Fecha:** 2026-07-27
**Estado:** especificación de diseño; no implementa gráficos, consultas ni datos
**Alcance:** visualizaciones operativas del ERP actual y contrato futuro para gestión de residuos

## 1. Decisión principal

La aplicación auditada es un ERP general. Hoy contiene datos verificables de
ventas, compras, gastos, caja, cuentas, inventario, documentos comerciales,
documentos privados, notificaciones y auditoría. No contiene un dominio de
residuos ni fuentes para generación, segregación, contenedores, almacenamiento
ambiental, traslados, manifiestos, pesajes, operadores, destino final, SIGERSOL
o cierre documental ambiental.

Por ello este plan separa dos capas que no deben mezclarse:

1. **Visualizaciones habilitables con el ERP existente.** Solo usan respuestas
   y registros actuales, siempre dentro del tenant y empresa derivados de la
   sesión.
2. **Visualizaciones de residuos bloqueadas por datos.** Son contratos de
   producto para una fase sectorial posterior. No deben renderizarse, ni siquiera
   con ceros o ejemplos, hasta que existan dominio, permisos, migraciones, RLS,
   API, estados, unidades y pruebas end to end.

Un almacén comercial no representa por sí mismo un almacén de residuos; un
producto no representa un tipo de residuo; un movimiento de stock no representa
una transferencia ambiental; un documento privado no demuestra cierre de
destino. La reutilización solo es válida mediante relaciones y contratos
sectoriales explícitos.

## 2. Evidencia revisada

El plan se sustenta en:

- `docs/design-audit/current-product-audit.md`;
- `docs/design-audit/information-architecture.md`;
- `docs/design-system/tokens.md`;
- `docs/design-system/component-inventory.md`;
- `apps/api/src/dashboard.service.ts`;
- `apps/api/src/inventory.service.ts`;
- `apps/api/src/audit.controller.ts`;
- `apps/web/src/components/Charts.tsx`;
- `apps/web/src/features/dashboard/pages/DashboardPage.tsx`;
- los conceptos visuales `direction-a-cadena-custodia.png`,
  `direction-b-libro-mayor.png` y `direction-c-planta-flujo.png`.

Los conceptos se interpretan como contratos de composición, no como evidencia
de funcionalidad:

- **Cadena de custodia:** cola priorizada, rail de fases, registros vinculados
  e inspector sincronizado. Es la referencia principal para trazabilidad.
- **Libro mayor:** tabla densa, filtros visibles, detalle lateral e historial.
  Es la referencia principal para investigación y auditoría.
- **Planta y flujo:** flujo de trabajo, matriz de zonas e inspector. Es la
  referencia para almacenamiento cuando no exista geometría verificable.

Ningún valor, registro, alerta o estado mostrado en esas imágenes se considera
un dato real del sistema.

## 3. Contrato común para toda visualización

### 3.1 Encabezado y procedencia

Cada visualización debe exponer, sin depender de hover:

- título formulado como pregunta operativa o conclusión calculada;
- periodo activo, zona horaria `America/Lima` y unidad;
- filtros activos y ruta para restablecerlos;
- fuente funcional y fecha/hora de última actualización;
- condición `actual`, `desactualizada`, `parcial` o `sin conexión`;
- alcance de empresa, sede o instalación permitido por la sesión;
- enlace a los registros que explican el agregado.

No se mostrará una conclusión textual generada si la consulta no devuelve la
base necesaria para comprobarla.

### 3.2 Estado compartible e interacción vinculada

- Periodo, sede o instalación, categoría, estado, responsable y severidad deben
  residir en parámetros de URL cuando sean filtros disponibles.
- La selección usa el ID estable de la entidad, no su etiqueta visible.
- Seleccionar una marca filtra la tabla o cola vinculada y abre el inspector sin
  perder el contexto.
- Hover solo anticipa; clic, toque, `Enter` o `Espacio` confirman selección.
- `Escape` cierra el inspector y devuelve el foco al elemento que lo abrió.
- Atrás/adelante restaura filtros, selección y vista.
- La exportación, cuando exista, usa los filtros activos e incluye fuente,
  periodo, unidad, zona horaria y fecha de generación.
- Ninguna acción de negocio se ejecuta desde una marca sin una vista de registro
  y autorización del caso de uso.

### 3.3 Accesibilidad

- Toda visualización dispone de un resumen textual y una tabla o lista
  equivalente con los valores esenciales.
- Los valores relevantes permanecen visibles sin tooltip. El tooltip es detalle
  complementario y también aparece con foco y toque.
- Color nunca es el único canal: se añade texto, icono, patrón, forma o posición.
- El orden de teclado coincide con el orden visual; las marcas no generan cientos
  de paradas si una tabla o lista permite recorrer los mismos datos mejor.
- El foco seleccionado tiene contraste visible y no se comunica solo mediante
  opacidad.
- Las variaciones incluyen valor inicial, valor final, diferencia, periodo y
  unidad en el nombre accesible.
- Movimiento y transición no son necesarios para comprender el cambio; con
  `prefers-reduced-motion` la actualización es inmediata.
- En móvil, hover se sustituye por toque/foco, el área objetivo es de al menos
  44 × 44 CSS px y el inspector se presenta en pantalla completa o bottom sheet.

### 3.4 Estados de datos

| Estado             | Tratamiento                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cargando           | Reservar geometría estable; anunciar una vez “Cargando datos”; no dibujar valores provisionales                                                        |
| Vacío válido       | La consulta real terminó con cero filas; explicar el alcance consultado y ofrecer quitar filtros o registrar, si el permiso lo permite                 |
| Fuente inexistente | No renderizar el visual ni su cifra; mostrar la capacidad como bloqueada solo en documentación o configuración, nunca como un panel operativo con cero |
| Parcial            | Conservar los datos válidos, identificar fuentes o periodos faltantes y evitar totales que pretendan ser completos                                     |
| Desactualizado     | Conservar el último resultado confirmado, mostrar hora y ofrecer actualizar                                                                            |
| Sin conexión       | Conservar solo el último resultado identificado como tal; deshabilitar acciones que requieran servidor                                                 |
| Error              | Mostrar el fallo en contexto, conservar filtros y selección, permitir reintento; no convertirlo en “sin datos”                                         |
| Sin permiso        | No consultar ni revelar conteos, categorías o existencia de registros; mostrar acceso restringido según el shell                                       |
| Datos inválidos    | No graficar valores no finitos, unidades incompatibles o relaciones rotas; listar incidencias de calidad para revisión                                 |

### 3.5 Regla de no mostrar

Hay tres resultados distintos:

1. **Cero confirmado:** puede mostrarse como estado vacío, con periodo y alcance.
2. **Dato ausente o no aplicable:** se muestra `No disponible` en un registro
   donde el campo sea necesario, nunca se convierte a cero.
3. **Fuente o contrato inexistente:** se omite la visualización completa. No se
   muestra eje, leyenda, tarjeta, porcentaje, progreso, capacidad, cumplimiento
   ni estado ambiental.

Los componentes actuales convierten valores no numéricos a cero. Ese
comportamiento no es admisible para las visualizaciones de residuos: el
adaptador debe validar el contrato antes de renderizar.

## 4. Preguntas respondibles con datos existentes del ERP

Estas vistas pertenecen al ERP actual. No deben rotularse como ambientales ni
usarse para inferir generación o manejo de residuos.

| Pregunta operativa                                            | Visual apropiado                                                                                                                 | Fuente real requerida                                                                                                                         | Interacción                                                                                                                | Accesibilidad                                                                               | Estados                                                            | Regla de no mostrar                                                                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Cómo evolucionan las ventas en los últimos seis meses?       | Línea temporal simple con puntos y tabla; comparación textual del mes actual contra el anterior                                  | `GET /dashboard`: `salesTrend`, `metrics.salesThisMonth`, `salesPreviousMonth`, `salesComparisonPercent`; origen `sales`, excluye `CANCELLED` | Seleccionar mes abre `/ventas` con periodo; alternar tabla; actualización manual                                           | Cada punto anuncia mes, soles y variación; valores visibles; tabla equivalente              | Cargando, vacío confirmado, desactualizado, error                  | No trazar línea si todos los periodos carecen de ventas; mostrar vacío real. No calcular porcentaje si la base anterior es cero                   |
| ¿Qué ítems concentran las ventas del mes?                     | Ranking de barras horizontales, máximo inicial de cinco, con nombre y soles directos                                             | `GET /dashboard`: `topItems`; `sale_lines` unidas a `sales` no canceladas                                                                     | Seleccionar barra abre ventas filtradas por `itemId`; ordenar por monto o cantidad solo si ambas medidas están disponibles | Lista ordenada equivalente; posición, nombre, valor y unidad en cada fila                   | Cargando, vacío, parcial si faltan nombres, error                  | Omitir ranking si no hay filas reales; no crear categoría “Otros” sin consulta que calcule el resto                                               |
| ¿Qué productos están por debajo del stock mínimo y dónde?     | Tabla priorizada con barra en celda como apoyo, no como único indicador                                                          | `GET /dashboard`: `lowStock`, o `GET /inventory`; `stock_balances`, `items.minimum_stock`, `warehouses`                                       | Filtrar almacén; seleccionar fila abre inventario del ítem; ordenar por déficit absoluto                                   | Encabezados asociados; texto “cantidad / mínimo”; tono más icono y etiqueta                 | Cargando, vacío “sin productos bajo mínimo”, error, desactualizado | No mostrar progreso si `minimumStock` es nulo, inválido o no positivo; conservar la fila como “mínimo no configurado” solo si la API lo distingue |
| ¿Cuál es la posición operativa de cobros y pagos?             | Comparación de montos en filas o barras divergentes; no dona porque caja, por cobrar y por pagar no son partes de un mismo total | `GET /dashboard`: saldos de `accounts_receivable`, `accounts_payable` y `cash_movements`                                                      | Cada fila abre CxC, CxP o caja; periodo y vencimiento actúan como filtros cuando la API los soporte                        | Montos completos en texto; la dirección deuda/activo se expresa con etiqueta, no solo color | Cargando, vacío por fuente, parcial, error                         | No combinar fuentes faltantes en una “posición neta”; no presentar porcentajes de composición                                                     |
| ¿Qué obligaciones financieras requieren atención?             | Cola/tablero tabular: vencidas por cobrar y próximas por pagar                                                                   | `GET /dashboard`: `receivablesOverdue`, `payablesUpcoming`; para drill-down se requieren listados reales de CxC/CxP                           | Abrir registros filtrados; ordenar por fecha y monto                                                                       | Conteo y monto con texto; tabla de detalle accesible                                        | Cargando, vacío, parcial si solo existe agregado, error            | Si no existe endpoint que reproduzca el conjunto del agregado, mostrar solo enlace general y documentar la limitación; no simular filas           |
| ¿Hay sesiones de caja abiertas?                               | Indicador textual con lista de sesiones; no gráfico                                                                              | `metrics.openCashSessions`; para detalle, endpoint de sesiones de caja                                                                        | Abrir `/caja`; actualizar                                                                                                  | Mensaje completo “N sesiones abiertas”; estado no depende de color                          | Cargando, vacío confirmado, error                                  | No afirmar quién o desde cuándo sin campos reales de sesión                                                                                       |
| ¿Qué documentos comerciales están pendientes o rechazados?    | Matriz compacta de estado y cola de documentos                                                                                   | `GET /dashboard`: `pendingDocuments`, `rejectedDocuments`; detalle desde `/sunat/documents`                                                   | Seleccionar estado abre documentos filtrados; conservar advertencia de flujo manual/demo cuando aplique                    | Estado con texto e icono; descripción del alcance de cada agrupación                        | Cargando, vacío, demo, parcial, error                              | No llamar “presentación regulatoria ambiental”; no afirmar conexión productiva SUNAT                                                              |
| ¿Qué operaciones comerciales ocurrieron recientemente?        | Flujo de actividad tabular combinado por fecha                                                                                   | `recentSales` y `recentExpenses` de `GET /dashboard`                                                                                          | Seleccionar operación abre su ruta de origen; filtros por tipo y estado                                                    | Lista semántica con tipo, fecha, parte/descripcion, monto y estado                          | Cargando, vacío, parcial, error                                    | No presentar el límite de cinco por fuente como historial completo; rotular “recientes”                                                           |
| ¿Qué movimientos de inventario ocurrieron por almacén o ítem? | Libro mayor tabular; pareja enlazada para transferencias                                                                         | `GET /inventory/movements`: movimiento, tipo, fecha, fuente, motivo, estado, almacén y cantidad de líneas                                     | Filtros por almacén e ítem; expansión requiere endpoint de detalle; enlazar entrada/salida por IDs relacionados            | Tabla navegable; tipo y dirección en texto; fechas completas                                | Cargando, vacío, parcial si no hay detalle de líneas, error        | No dibujar un flujo de cantidades con solo `lineCount`; no interpretar transferencia de stock como traslado de residuos                           |
| ¿Qué acciones quedaron registradas para auditoría?            | Libro mayor de auditoría con inspector                                                                                           | `GET /audit`: acción, tipo e ID de entidad, actor, request ID y fecha                                                                         | Filtro por acción, paginación, enlace a entidad solo si la ruta y permiso existen                                          | Tabla con caption, encabezados y fecha legible; valores técnicos copiables                  | Cargando, vacío, error, sin permiso                                | No mostrar valores anteriores/nuevos si el endpoint no los entrega; no convertir ausencia en “sin cambios”                                        |
| ¿Qué evidencia privada existe en el ERP?                      | Tabla documental con filtros; no gráfico                                                                                         | `GET /documents` y metadatos autorizados actuales                                                                                             | Abrir/descargar según permiso; filtrar por tipo existente                                                                  | Nombre, tipo, tamaño, fecha y acción accesible; vista previa con alternativa                | Cargando, vacío, error, sin permiso                                | No inferir vigencia, duplicidad, vínculo ambiental o suficiencia probatoria sin metadatos sectoriales                                             |

## 5. Fuentes nuevas necesarias para residuos

Los nombres siguientes describen **contratos lógicos**, no tablas aprobadas. Base
de Datos y Seguridad deben definir nombres físicos, claves, RLS e índices; Legal
debe validar clasificaciones, obligaciones y fuentes oficiales.

| Contrato lógico nuevo          | Datos mínimos                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo de residuos           | ID estable, denominación aprobada, clasificación revisada, unidad permitida, peligrosidad y recuperabilidad como campos explícitos, vigencia y fuente |
| Registro de generación         | ID, sede, área generadora, residuo, cantidad, unidad, fecha/hora, responsable, estado, evidencia y versión                                            |
| Evaluación de segregación      | registro, contenedor previsto y usado, resultado, contaminación, observación, evidencia, evaluador y fecha                                            |
| Instalación, zona y contenedor | instalación, zona, contenedor, capacidad y unidad, compatibilidades, estado, condición, fechas e inspección                                           |
| Evento de ciclo de vida        | registro/lote, fase, estado, cantidad y unidad, fecha, responsable, incidencia, evidencia y base procedimental                                        |
| Transferencia interna          | origen, destino, salida, recepción, cantidades, unidades, responsables, estado y diferencias                                                          |
| Despacho y recepción externa   | lote, transportista, vehículo si procede, operador, infraestructura, cantidad despachada/recibida, pesajes, fechas y estado                           |
| Destino final                  | método explícito, infraestructura, autorización validada, fecha, cantidad y unidad, certificado y cierre                                              |
| Documento ambiental vinculado  | tipo, versión, registro relacionado, emisor, vigencia, hash, estado de revisión, permisos e historial                                                 |
| Excepción y acción correctiva  | tipo, severidad, origen, evidencia, responsable, fecha límite, acción inmediata, correctiva, estado y verificación de cierre                          |
| Obligación y control           | clase de requisito, norma, artículo, condición de aplicación, obligación, control interno, responsable, fuente oficial y fecha de consulta            |
| Presentación regulatoria       | tipo de presentación, periodo, alcance, estado explícito, fecha límite validada, responsable, acuse y documentos relacionados                         |

Toda cantidad agregada requiere una unidad compatible. No deben sumarse masa,
volumen, unidades o contenedores sin conversión aprobada y trazable. Las
conversiones por densidad requieren fuente, versión y rango de vigencia; si no
existen, se muestran series separadas.

## 6. Preguntas futuras de gestión de residuos

Todas las filas de esta sección tienen estado **bloqueado por fuente nueva**.
Hasta que el contrato indicado exista y esté verificado, aplica la regla de
omitir el visual completo.

### 6.1 Resumen operativo

| Pregunta operativa                                 | Visual apropiado                                                                                       | Fuente real requerida                                                                                                        | Interacción                                                                                                            | Accesibilidad                                                                                    | Estados                                                                 | Regla de no mostrar                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Qué requiere atención ahora?                      | Cola priorizada, no rejilla de KPI; agrupa excepciones, vencimientos y bloqueos por acción posible     | Excepciones, acciones correctivas, documentos, presentaciones y eventos bloqueados; severidad y fechas definidas por dominio | Filtros por instalación, responsable, severidad y tipo; seleccionar abre inspector y registro; acción solo con permiso | Orden explicado; cada fila anuncia tipo, severidad, plazo, responsable y acción; icono más texto | Cargando, vacío confirmado, parcial, desactualizado, error, sin permiso | No construir la cola a partir de palabras en auditoría/notificaciones ni inventar prioridad; si ninguna fuente sectorial existe, omitirla |
| ¿Qué residuo se generó y dónde?                    | Heatmap tabular área × periodo cuando haya suficiente cardinalidad; tabla como vista primaria en móvil | Registros de generación, áreas organizacionales vinculadas, catálogo, cantidad y unidad                                      | Filtrar periodo, sede, área y residuo; celda filtra registros; alternar cantidad y conteo                              | Tabla equivalente; cada celda anuncia área, periodo, valor y unidad; escala con etiquetas        | Cargando, vacío, parcial, error                                         | No mostrar heatmap con IDs sin nombres, unidades mezcladas o menos de dos dimensiones útiles; usar tabla                                  |
| ¿Qué espera transferencia interna?                 | Cola tabular por antigüedad con rail de estado                                                         | Eventos de fase y transferencias con estado pendiente, origen, destino, fecha, responsable y cantidad                        | Ordenar por antigüedad; seleccionar abre lote y fase; acción “programar/recibir” según permiso                         | Estado, antigüedad y plazo en texto; no depender del color                                       | Cargando, vacío, desactualizado, error                                  | No inferir espera por permanecer en un almacén comercial; requiere estado sectorial explícito                                             |
| ¿Qué está almacenado actualmente?                  | Matriz de zonas y tabla de contenedores; capacidad en celda solo cuando exista denominador válido      | Zonas, contenedores, ocupación por unidad compatible, compatibilidad, condición, ingreso e inspección                        | Seleccionar zona sincroniza matriz, registros e inspector; filtros por instalación, condición y categoría              | Tabla equivalente; ocupación anuncia usado, capacidad y unidad; patrón/icono para compatibilidad | Cargando, vacío, parcial, desactualizado, error                         | Sin zonas sectoriales, omitir. Sin layout físico, no mostrar mapa. Sin capacidad válida, mostrar “capacidad no configurada”, no 0 %       |
| ¿Qué registros carecen de evidencia de destino?    | Cola de faltantes con columnas por documento esperado y fase                                           | Reglas explícitas de evidencia requerida más vínculos a manifiesto, pesaje, certificado y cierre                             | Filtrar por tipo faltante, antigüedad, operador y destino; abrir registro y centro documental                          | Cada faltante se expresa en texto; encabezados de columna explican requisito y fuente            | Cargando, vacío, parcial si reglas no cubren todos los tipos, error     | No deducir faltantes comparando solo archivos; sin matriz de requisitos aplicables, no calcular                                           |
| ¿Qué residuo peligroso requiere acción?            | Cola de riesgo priorizada; gráfico solo como resumen secundario por acción                             | Clasificación de peligrosidad validada, cantidades, condiciones, incidentes, plazos y responsables                           | Filtrar instalación/tipo/acción; selección abre evidencia y base aplicable                                             | Texto “peligroso” y motivo de atención; severidad no solo roja                                   | Cargando, vacío, parcial, error                                         | No clasificar por nombre, color de contenedor o categoría visual; sin campo validado, omitir                                              |
| ¿Qué documentación está próxima a vencer?          | Timeline/lista por fecha de expiración con bandas de plazo configuradas                                | Documentos ambientales, vigencia, tipo, emisor, relación y reglas de alerta aprobadas                                        | Periodo de aviso configurable solo si existe política; abrir documento y entidad                                       | Fecha exacta y días restantes en texto; orden cronológico                                        | Cargando, vacío, parcial, error                                         | Documentos sin fecha de vigencia permanecen “vigencia no registrada”; no se consideran vigentes ni vencidos                               |
| ¿Qué acciones correctivas están vencidas?          | Cola tabular por días de atraso y severidad                                                            | Acciones correctivas ambientales, fecha límite, estado, responsable y verificación                                           | Filtrar responsable/origen; abrir excepción; reasignar o cerrar solo mediante caso de uso                              | Días de atraso, fecha y estado en texto; anuncio de actualización                                | Cargando, vacío, desactualizado, error                                  | No reutilizar acciones SST como ambientales sin relación sectorial explícita                                                              |
| ¿Qué presentaciones regulatorias están pendientes? | Calendario/lista de obligaciones aplicables; no gráfico                                                | Contrato de presentación, aplicabilidad, periodo, fecha límite validada, estado y acuse                                      | Filtrar tipo/periodo/responsable; abrir obligación, evidencia y envío                                                  | Fecha, condición de aplicabilidad y estado textual                                               | Cargando, vacío, parcial, error, sin permiso                            | No inventar obligación, plazo o estado SIGERSOL. Sin fuente oficial revisada y aplicabilidad, omitir                                      |

### 6.2 Ciclo de vida y trazabilidad

| Pregunta operativa                                          | Visual apropiado                                                                                                            | Fuente real requerida                                                                                                                    | Interacción                                                                                          | Accesibilidad                                                                                   | Estados                                    | Regla de no mostrar                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| ¿En qué fase está cada registro y qué impide avanzar?       | Rail lineal de nueve fases por registro, acompañado de cola; no diagrama global decorativo                                  | Eventos de ciclo de vida con transición, estado, responsable, fecha, cantidad, evidencia, incidencia y base                              | Seleccionar fase filtra registros y abre inspector; fases no son botones si no hay acción autorizada | Lista ordenada equivalente; fase actual, completadas, pendientes y bloqueo en texto             | Cargando, vacío, parcial, error            | No marcar fases completadas por ausencia de incidencias; cada transición requiere evento confirmado                                  |
| ¿Cuál es la cadena completa de un lote o registro?          | Timeline vertical o rail de custodia con documentos enlazados                                                               | Generación, segregación, almacenamientos, transferencias, despacho, recepción, destino, cierre y auditoría relacionados por IDs estables | Expandir evento; abrir entidad/evidencia; copiar enlace al estado seleccionado                       | Orden cronológico semántico; cada evento anuncia actor, fecha, estado, cantidad y unidad        | Cargando, parcial, relaciones rotas, error | Si faltan segmentos, mostrarlos como “sin evento registrado”, no completar la línea; no afirmar trazabilidad completa                |
| ¿Cómo fluyen los residuos desde el origen hasta el destino? | Sankey solo para flujo agregado con relaciones verdaderas; fallback obligatorio: tabla origen → destino y barras por origen | Registros enlazados de área generadora, categoría, destino, cantidad convertida a una unidad común y periodo                             | Seleccionar nodo/enlace filtra registros; control para cambiar nivel; inspector de calidad del dato  | Tabla equivalente; navegación por lista de orígenes y destinos; enlaces anuncian valor y unidad | Cargando, vacío, parcial, error            | No usar Sankey con destinos desconocidos como si fueran cierres, unidades mezcladas, relaciones inferidas o pocos flujos; usar tabla |
| ¿Existe diferencia entre cantidad despachada y recibida?    | Comparación por registro con barra divergente y tabla de diferencias                                                        | Despacho y recepción vinculados, pesajes, unidad común, tolerancia aprobada y estado de conciliación                                     | Filtrar fuera de tolerancia; abrir pesajes y evidencias; registrar revisión mediante caso de uso     | Valores despachado, recibido, diferencia y tolerancia en texto                                  | Cargando, vacío, parcial, error            | Sin ambos pesajes o sin tolerancia validada, mostrar “no conciliable”; no clasificar como excepción automáticamente                  |
| ¿Qué registros están documentalmente cerrados?              | Matriz de completitud por tipo de evidencia; no puntuación única por defecto                                                | Reglas aplicables versionadas y documentos vinculados/revisados                                                                          | Seleccionar celda abre documento o faltante; filtrar por etapa y tipo                                | Símbolo más texto `presente`, `faltante`, `no aplica`, `no evaluado`; tabla accesible           | Cargando, vacío, parcial, error            | No calcular “100 % cumplimiento” a partir de conteos. Sin reglas de aplicabilidad, omitir la matriz                                  |

### 6.3 Generación, segregación y composición

| Pregunta operativa                                 | Visual apropiado                                                                                       | Fuente real requerida                                                                   | Interacción                                                                 | Accesibilidad                                                                     | Estados                         | Regla de no mostrar                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Cómo cambia la generación por periodo?            | Línea por una categoría o pequeños múltiplos; tabla para unidades diferentes                           | Generación con fecha, categoría, cantidad y unidad compatible                           | Filtro por sede/área/categoría; rango; selección de punto abre registros    | Valores y tendencia en texto; tabla equivalente; series con trazo además de color | Cargando, vacío, parcial, error | No unir huecos no observados ni convertir ausencia en cero; no sumar unidades incompatibles                                                                    |
| ¿Cuál es la composición de residuos generados?     | Barras apiladas al 100 % para proporción y barras absolutas para cantidad; no dona decorativa          | Generación por categoría en unidad común y catálogo vigente                             | Alternar proporción/cantidad; seleccionar segmento filtra registros         | Etiqueta directa o leyenda próxima; orden estable; tabla con valor y porcentaje   | Cargando, vacío, parcial, error | No mostrar porcentajes si el total es incompleto o cero; categorías sin clasificación quedan explícitas como “no clasificado” solo si existen registros reales |
| ¿Dónde se repiten errores de segregación?          | Matriz área × resultado o categoría; cola de casos debajo                                              | Evaluaciones de segregación, área, resultado validado, contaminación, fecha y evidencia | Celda filtra casos; comparar periodos solo con misma regla; abrir evidencia | Texto/patrón para conforme, no conforme, no evaluado y no aplica                  | Cargando, vacío, parcial, error | No interpretar falta de evaluación como conformidad; sin denominador evaluado no mostrar porcentaje                                                            |
| ¿Qué categorías aparecen mezcladas o contaminadas? | Ranking de combinaciones solo si existe codificación estructurada; de lo contrario tabla de incidentes | Evaluaciones con categorías observadas múltiples y evidencia                            | Seleccionar combinación abre incidentes; filtro por área/periodo            | Etiquetas completas y conteos; no depender de enlaces de red                      | Cargando, vacío, parcial, error | No extraer categorías de observaciones libres sin revisión; no usar grafo por atractivo visual                                                                 |

### 6.4 Almacenamiento, excepciones y cumplimiento

| Pregunta operativa                                         | Visual apropiado                                                           | Fuente real requerida                                                                       | Interacción                                                                                 | Accesibilidad                                                                           | Estados                                         | Regla de no mostrar                                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Qué zonas están próximas a su capacidad?                  | Matriz de zonas con barra en celda y cola por umbral; no gauge             | Ocupación actual, capacidad, unidad común, vigencia de medición y umbral operativo aprobado | Filtro instalación; seleccionar zona abre contenedores y movimientos; ordenar por ocupación | Texto usado/capacidad/porcentaje; advertencia con icono y etiqueta                      | Cargando, vacío, parcial, desactualizado, error | Sin capacidad o medición actual, no calcular porcentaje ni alerta; no usar almacenes comerciales como zonas                                          |
| ¿Hay incompatibilidades de almacenamiento?                 | Matriz de compatibilidad explicable y cola de conflictos reales            | Reglas versionadas de compatibilidad más contenidos y ubicación actuales                    | Celda explica regla y fuente; conflicto abre contenedores y acción                          | Símbolos, texto y descripción de la regla; tabla alternativa                            | Cargando, vacío, parcial, error                 | No inventar compatibilidades ni usar colores de contenedor como regla; sin revisión Legal/SOMA, omitir                                               |
| ¿Cómo se distribuyen las excepciones por severidad y tipo? | Barras apiladas o matriz tipo × severidad; siempre junto a cola accionable | Excepciones estructuradas con tipo, severidad, estado, fecha y origen                       | Segmento filtra cola; seleccionar caso abre inspector; periodo en URL                       | Conteos directos; severidad con texto, patrón/icono y color                             | Cargando, vacío, parcial, error                 | No deducir severidad desde texto libre; sin taxonomía versionada, mostrar solo lista sin agregado                                                    |
| ¿Qué evidencia demuestra cada control u obligación?        | Matriz legal/control/evidencia con inspector de fuente oficial             | Obligaciones, aplicabilidad, controles, evidencias y fuente oficial con fecha de consulta   | Buscar norma/artículo; filtrar clase; abrir fuente y evidencia; historial de versión        | Tabla con encabezados; enlaces descriptivos; clase del requisito en texto               | Cargando, vacío, parcial, error, sin permiso    | No mostrar estado “cumple” por mera existencia de archivo; requiere criterio y evaluación explícitos                                                 |
| ¿Dónde se ubican instalaciones, operadores o destinos?     | Mapa solo como localizador secundario; lista es la vista base              | Coordenadas confirmadas, procedencia, precisión y fecha; entidad sectorial autorizada       | Seleccionar marcador sincroniza lista e inspector; alternativa “ver en lista”               | Lista equivalente; nombre, dirección y precisión textual; controles de zoom con teclado | Cargando, vacío, parcial, error                 | Sin coordenadas válidas no geocodificar implícitamente ni colocar en centroide; no mostrar mapa. Una ubicación manual del ERP no prueba autorización |

## 7. Composición por workspace

### 7.1 Resumen operativo

Orden de lectura:

1. cola `Requiere atención`;
2. alcance, periodo y estado de actualización;
3. generación por área y periodo, si existe;
4. almacenamiento y capacidad, si existe;
5. registros con evidencia pendiente;
6. lista vinculada de registros.

No se usa una parrilla de tarjetas de igual peso. Cada cifra tiene enlace a la
cola o conjunto de registros que la explica.

### 7.2 Ciclo de vida

En escritorio se usa el patrón de Cadena de custodia:

- rail de fases en el centro;
- cola o tabla vinculada debajo;
- inspector a la derecha;
- filtros y fuente visibles en la barra superior.

En móvil se presenta primero la fase actual y la siguiente acción; la lista
completa de fases se abre como timeline vertical. La selección se conserva al
abrir y cerrar el inspector.

### 7.3 Almacenamiento

La vista inicial es la matriz de zonas del concepto Planta y flujo. Un plano
solo se habilita si existe geometría de instalación mantenida, coordenadas de
zona, versión del layout y correspondencia probada con los registros. Una
fotografía o dibujo decorativo no es un mapa operativo.

### 7.4 Trazabilidad, evidencia y auditoría

Se usa el patrón Libro mayor:

- tabla principal con densidad cómoda o compacta;
- columnas configurables sin ocultar identidad, estado y última actividad;
- inspector con trazabilidad, evidencias e historial;
- filtros y exportación que preservan el alcance;
- selección y filtros restaurables por URL.

## 8. Escala, color y anotación

- Azul de foco/selección se reserva para interacción actual.
- Neutros muestran contexto.
- Advertencia, peligro, pendiente y cumplimiento usan tokens semánticos
  distintos de los colores de categoría de residuo.
- Los colores de categoría solo se aplican después de recibir un `category-id`
  del dominio; nunca se asignan por posición de arreglo.
- La severidad mantiene orden y significado estables en todas las vistas.
- `No evaluado`, `no aplica`, `sin datos` y `cumple` son estados distintos.
- Los ejes empiezan en cero para barras. Una línea puede usar dominio acotado
  solo si lo declara y no exagera la variación.
- Toda agregación muestra unidad, periodo y alcance.
- Las anotaciones explican cambios verificables o incidencias de calidad; no
  generan narrativas causales.
- No se usan 3D, gauges, partículas, animación decorativa ni degradados como
  codificación.

## 9. Rendimiento y degradación

- La tabla o lista se carga antes que una visualización secundaria.
- Los gráficos estándar deben poder resolverse con SVG/HTML y los componentes
  existentes una vez corregidos sus contratos accesibles y de vacío.
- Sankey, mapa o heatmap se cargan por ruta y solo cuando la fuente los
  justifique; no forman parte del bundle inicial del ERP.
- Para tablas grandes, la paginación del servidor es el contrato base. La
  virtualización no sustituye paginación, filtros ni conteos reales.
- Los filtros no deben provocar una cascada de consultas por cada marca; se
  cancela la solicitud anterior y se conserva el último resultado confirmado.
- En baja conectividad se priorizan cola, tabla, resumen textual y última
  actualización; se omiten capas cartográficas no esenciales.

## 10. Verificación antes de implementar

Cada visualización debe aprobar:

1. contrato de datos tipado y validación en runtime;
2. consulta parametrizada con ámbito de sesión y permiso de API;
3. definición de unidad, periodo, zona horaria, denominador y exclusiones;
4. reproducción del agregado mediante registros enlazados;
5. pruebas de cero confirmado, nulo, parcial, error, sin permiso, desactualizado
   y sin conexión;
6. teclado completo, foco restaurado y lector de pantalla;
7. contraste, escala de grises y deficiencias de percepción del color;
8. vista equivalente en tabla/lista;
9. móvil `360 × 800` y `390 × 844`, tablet `768 × 1024` y escritorios definidos
   en el encargo;
10. persistencia de URL, atrás/adelante, exportación y filtros;
11. comparación de totales contra la consulta fuente;
12. revisión de Seguridad para acceso, Legal para obligaciones y clasificaciones,
    y Base de Datos para contratos sectoriales.

## 11. Secuencia recomendada

1. Corregir el contrato accesible y los estados vacíos de las visualizaciones
   existentes del ERP.
2. Sustituir la dona financiera por comparación no composicional.
3. Vincular agregados actuales a sus listados reales sin cambiar reglas de
   negocio.
4. Aprobar el dominio de residuos y sus fuentes antes de crear nuevas rutas
   visuales.
5. Implementar primero un corte vertical real:
   generación → segregación → almacenamiento → despacho → evidencia → cierre.
6. Añadir cola, rail, timeline y matriz sobre ese corte.
7. Incorporar agregados, Sankey o mapa solo después de demostrar volumen,
   calidad, unidad compatible y necesidad operativa.

La entrega de este plan no habilita ninguna visualización ambiental. Su función
es impedir que una interfaz convincente presente como reales datos, reglas o
estados que el producto todavía no posee.
