# Arquitectura de información y experiencia de usuario

**Producto inspeccionado:** ERP Express Perú
**Fecha de corte:** 2026-07-27
**Alcance:** navegación, jerarquía, journeys, revelado progresivo, responsive y estados de interfaz
**Estado del documento:** propuesta inicial con delta de implementación al final; la evidencia de navegador se registra por separado

## 1. Decisión ejecutiva

La arquitectura de información debe preservar primero el ERP que existe y funciona hoy. El
repositorio contiene un ERP modular comercial con capacidades administrativas y de Fase 3;
no contiene un dominio de gestión de residuos.

La búsqueda en aplicación web, API, paquetes de dominio, contratos, migraciones y módulos no
encontró entidades, permisos, endpoints ni rutas funcionales para:

- generación o clasificación de residuos;
- segregación;
- almacenes o contenedores de residuos;
- transferencias internas de residuos;
- despachos, manifiestos o pesajes de residuos;
- operadores de residuos y destino final;
- valorización, reciclaje o disposición;
- SIGERSOL;
- excepciones ambientales o cierre documental de la cadena.

Por esta razón, los workspaces de residuos descritos en el encargo son un **target de producto
bloqueado**, no una reorganización de funcionalidad ya implementada. No deben mostrarse en
navegación, capturas o entregables como si existieran hasta que cuenten con dominio, datos,
API, permisos y pruebas end to end.

La recomendación es trabajar en dos capas claramente separadas:

1. **IA preservada:** reorganiza y simplifica únicamente las capacidades reales del ERP.
2. **Target de residuos:** se conserva como arquitectura futura condicionada a una fase de
   producto y backend anterior a su implementación visual.

> Actualización de implementación: esta condición se atendió con un vertical
> slice real de dominio, migraciones, RLS, permisos, API, interfaz y pruebas. El
> resto de workspaces de residuos sigue siendo arquitectura futura y no debe
> mostrarse como implementado.

## 2. Evidencia y límites

### 2.1 Fuentes revisadas

- Enrutamiento y protección de rutas en `apps/web/src/App.tsx`.
- Shell y navegación en `apps/web/src/components/AppShell.tsx`.
- Manifiesto lazy de Fase 3 en `apps/web/src/features/phase3/routes.tsx`.
- Superficies operativas y componentes compartidos de `apps/web/src/features`.
- Registro de módulos en `packages/domain/src/index.ts`.
- Roles y permisos sembrados en `packages/database/src/seed.ts`.
- Controladores de API, en especial operaciones y gobierno de Fase 3.
- Estilos responsive en `apps/web/src/styles.css` y
  `apps/web/src/features/phase3/phase3.css`.
- Documentación de arquitectura, permisos, PWA, sistema visual y estado del sistema.

### 2.2 Límites

Este documento no sustituye la auditoría visual y funcional en navegador. Las capturas
existentes del repositorio se usaron como referencias de diseño documentadas, no como evidencia
de una sesión de auditoría actual. Antes de implementar cambios se debe contrastar cada journey
con el producto ejecutándose y con una sesión real por rol.

## 3. Producto real que debe preservarse

### 3.1 Capacidades de acceso y contexto

- Inicio de sesión y recuperación de contraseña.
- Cambio forzado de contraseña.
- Sesión con tenant, empresa, sedes y permisos derivados del backend.
- Navegación filtrada por permiso y, parcialmente, por módulo habilitado.
- Indicador de conexión.
- Shell PWA y borradores locales permitidos en flujos específicos.

### 3.2 Capacidades operativas

- Resumen operativo y notificaciones.
- Clientes, proveedores, productos, servicios y precios.
- Cotizaciones, pedidos, ventas y comprobantes.
- Compras y gastos.
- Cuentas por cobrar, cuentas por pagar, pagos, cobros y caja.
- Almacenes, inventario, movimientos, transferencias y ajustes.
- Flujo SUNAT básico no productivo.
- Importación con previsualización y exportación CSV.

### 3.3 Capacidades de Fase 3

- Centro de administración y configuración.
- CRM: prospectos y oportunidades.
- Proyectos y endpoints de tareas, tiempo y gastos por proyecto.
- Recursos humanos: personas.
- SST: inspecciones y hallazgos.
- Activos y órdenes de mantenimiento.
- OCR con revisión humana.
- Asistente IA controlado.
- Geocodificación manual o mediante proveedor.
- Documentos legales, aceptaciones, consentimiento, privacidad y retención.
- Administración de proveedores.

### 3.4 Gobierno y administración

- Organización y sedes.
- Usuarios, roles y permisos.
- Módulos habilitados.
- Archivos privados.
- Auditoría.
- Perfiles y configuración de demostración en el modelo, con disponibilidad condicionada.

## 4. Problemas actuales de arquitectura de información

### 4.1 Navegación extensa y duplicada

El shell genera grupos base y luego recorre nuevamente secciones de Fase 3. Esto puede repetir
“Operación” y “Administración”, separar capacidades relacionadas y producir una navegación
vertical demasiado larga para perfiles con permisos amplios.

### 4.2 Contexto con apariencia interactiva, pero sin comportamiento

Empresa y sede aparecen como botones con chevrón, pero sus valores están codificados y no
existe selector funcional. El nombre y avatar “Administrador” también son estáticos. Esta
presentación transmite una capacidad de cambio de ámbito que la interfaz no ofrece.

Mientras no exista cambio de contexto completo y autorizado:

- mostrar empresa y sede como contexto de solo lectura;
- usar los datos reales de sesión;
- no usar chevrón ni apariencia de selector;
- no ocultar por completo este contexto en móvil.

### 4.3 Pestañas que exceden los contratos reales

Varias superficies publican secciones que no tienen endpoint:

- CRM: “Pipeline” y “Actividad”.
- Recursos humanos: contratos, asistencia, licencias, capacitación y certificaciones.
- SST: riesgos, acciones correctivas e incidentes.
- Mapas: agregados por ubicación.
- Demostración: perfiles, escenarios y paquete.

En proyectos, varias pestañas consultan `GET /projects?include=...`, aunque las rutas reales de
tareas, tiempo y gastos exigen un proyecto seleccionado y usan `/:id/...`.

Estas pestañas deben ocultarse hasta contar con contrato real o corregirse para usar los
endpoints existentes. Una pestaña no puede funcionar como promesa de producto.

### 4.4 Navegación móvil incompleta

Por debajo de `820 px`, `.section-tabs` oculta todas las opciones salvo la activa. No queda un
control alternativo para cambiar de sección. Las pestañas de Fase 3 sí conservan desplazamiento,
pero los dos patrones divergen.

### 4.5 Estado offline engañoso

La inspección SST informa que se enviará cuando vuelva la conexión. El código conserva un
borrador, pero no implementa una cola automática de sincronización. La copia debe indicar:

> Sin conexión. El borrador permanece en este dispositivo. Revísalo y envíalo cuando recuperes
> conexión.

### 4.6 Journey SST representado como proceso inexistente

El formulario muestra “Paso 3 de 7” y siete nodos sin navegación ni pasos implementados. Debe
presentarse como un formulario único con secciones, o implementar los siete pasos con estado,
validación y recuperación reales.

### 4.7 Estados administrativos con apariencia de acción

Los cuatro bloques del centro de administración presentan frases como “Consultar estado” y
“Verificar conexión”, pero no son enlaces ni datos calculados. Deben ser:

- indicadores respaldados por datos y con acceso a detalle; o
- texto introductorio sin apariencia de control ni de estado verificado.

## 5. Arquitectura de información preservada

Se deben conservar las rutas actuales para no romper marcadores, enlaces, pruebas y dependencias.
La mejora cambia agrupación y descubrimiento, no los identificadores públicos.

### 5.1 Navegación primaria propuesta

| Grupo                     | Destinos reales                                                              | Rutas preservadas                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inicio                    | Resumen, notificaciones                                                      | `/`, `/notificaciones`                                                                                                                           |
| Comercial                 | Clientes, CRM, productos, precios, cotizaciones, pedidos, ventas             | `/clientes`, `/crm`, `/productos`, `/precios`, `/cotizaciones`, `/pedidos-venta`, `/ventas`                                                      |
| Abastecimiento y finanzas | Proveedores, compras, gastos, cuentas, pagos, caja, inventario, SUNAT, datos | `/proveedores`, `/compras`, `/gastos`, `/cuentas-por-cobrar`, `/cuentas-por-pagar`, `/pagos`, `/caja`, `/inventario`, `/sunat`, `/importaciones` |
| Operación                 | Proyectos, activos y mantenimiento, mapas                                    | `/proyectos`, `/activos`, `/mapas`                                                                                                               |
| Personas y seguridad      | Recursos humanos, SST                                                        | `/recursos-humanos`, `/sst`                                                                                                                      |
| Automatización            | OCR, asistente IA                                                            | `/ocr`, `/asistente`                                                                                                                             |
| Gobierno y evidencia      | Archivos, auditoría, legal y privacidad                                      | `/documentos`, `/auditoria`, `/legal-privacidad`                                                                                                 |
| Configuración             | Organización, sedes, usuarios, roles, módulos, administración y demostración | `/organizacion`, `/sedes`, `/usuarios`, `/roles`, `/modulos`, `/administracion`, `/demostracion`                                                 |

### 5.2 Reglas de visibilidad

1. Ocultar un destino solo después de cargar módulos y permisos.
2. Ocultar el grupo completo cuando no contenga destinos visibles.
3. No usar la visibilidad como autorización; la API continúa siendo la autoridad.
4. No publicar una sección cuyo endpoint no exista.
5. Si una URL conocida queda bloqueada por módulo, mostrar el estado “Módulo no disponible”.
6. Si la API responde por falta de permiso, mostrar un estado 403 específico.
7. Mantener notificaciones y perfil como utilidades globales, no como módulos operativos.
8. Mantener empresa y sede visibles como contexto de alcance en escritorio y móvil.

### 5.3 Jerarquía de pantalla

Cada pantalla operativa debe seguir este orden:

1. Contexto: empresa, sede y periodo cuando apliquen.
2. Título y propósito.
3. Estado operativo o bloqueo relevante.
4. Acción primaria permitida.
5. Filtros y búsqueda.
6. Lista, tabla o proceso principal.
7. Detalle contextual.
8. Evidencia, historial o ayuda procedimental.

No todas las pantallas requieren métricas, tarjetas, tabs o gráficos. La estructura debe
responder a la tarea real.

### 5.4 Revelado progresivo

- Mostrar en la lista solo los campos necesarios para identificar estado y siguiente acción.
- Abrir detalle lateral únicamente cuando exista un registro y acciones relacionadas.
- Reservar página completa para formularios largos, revisión OCR y operaciones sensibles.
- Mostrar legal, historial y auditoría después del estado operativo, sin ocultarlos.
- No ocultar filtros imprescindibles en móvil; reubicarlos en una hoja o pantalla accesible.
- Las acciones irreversibles deben permanecer separadas de las acciones frecuentes.

## 6. Roles y personalización

### 6.1 Roles reales

| Rol sembrado                     | Alcance real resumido                                          | Inicio recomendado                              |
| -------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| Administrador de empresa         | Todos los permisos de empresa                                  | Resumen con accesos a configuración y gobierno  |
| Superadministrador de plataforma | Sin permisos empresariales sembrados                           | Superficie separada; no asumir acceso operativo |
| Supervisor                       | Casi todos los permisos salvo controles críticos seleccionados | Resumen y colas operativas                      |
| Operador                         | Operación comercial básica; sin permisos Fase 3 sembrados      | Tareas comerciales pendientes                   |
| Solo lectura                     | Permisos terminados en `.read`                                 | Consulta y búsqueda                             |
| Auditor                          | Organización, usuarios, roles, módulos, archivos y auditoría   | Auditoría y evidencia                           |

### 6.2 Roles solicitados para residuos

SOMA, supervisor ambiental, almacén, servicios generales, área generadora y gestión consolidada
no existen en el modelo actual. No deben representarse como alias visuales de roles existentes.
Su incorporación requiere:

- matriz de responsabilidades;
- permisos estables;
- segregación de funciones;
- asignación por empresa, sede y área;
- reglas de aprobación;
- pruebas de autorización por endpoint.

## 7. Journeys reales preservados

### 7.1 Acceso y cambio obligatorio de contraseña

1. Iniciar sesión.
2. Validar credenciales.
3. Forzar cambio de contraseña cuando corresponda.
4. Regresar al contexto autorizado.
5. Mostrar destinos por permisos y módulos.

**Salud actual:** funcional en estructura; la redirección posterior debe llevar al destino
original o al inicio autorizado, no asumir siempre organización.

### 7.2 Venta

1. Consultar o crear cliente.
2. Consultar productos y precios.
3. Crear cotización.
4. Aceptar y convertir.
5. Confirmar pedido o venta.
6. Emitir documento cuando corresponda.
7. Consultar cuenta por cobrar y evidencia.

**Preservar:** estados, idempotencia, permisos, confirmaciones y enlaces a PDF/SUNAT.

### 7.3 Compra e inventario

1. Consultar o crear proveedor.
2. Registrar compra.
3. Confirmar compra.
4. Reflejar inventario y cuenta por pagar.
5. Consultar movimientos o realizar transferencia/ajuste autorizado.
6. Revisar evidencia y auditoría.

**Preservar:** prevención de duplicados, selección de almacén, confirmación y reglas contables.

### 7.4 Inspección SST

1. Iniciar una inspección.
2. Capturar sede, área, fecha y responsable.
3. Registrar hallazgo y severidad.
4. Guardar borrador local si es necesario.
5. Enviar inspección y hallazgo.
6. Confirmar resultado de API.

**Límite actual:** responsable de acción, fecha límite y archivo de evidencia no completan un
workflow posterior. Riesgos, acciones correctivas e incidentes no deben figurar como colas
funcionales hasta existir sus contratos.

### 7.5 OCR con revisión humana

1. Seleccionar PDF, JPEG o PNG permitido.
2. Validar tipo y tamaño.
3. Crear documento autorizado.
4. Ejecutar OCR.
5. Comparar campos y confianza con el original.
6. Corregir valores.
7. Confirmar revisión como borrador, nunca como registro financiero final silencioso.

### 7.6 Gobierno legal y privacidad

1. Seleccionar la colección adecuada.
2. Consultar versión, estado e historial.
3. Diferenciar documentos legales, aceptaciones, consentimientos, solicitudes, retención y
   bloqueos.
4. Mostrar acciones solo con permiso.
5. Conservar advertencia de que la aplicación no declara cumplimiento automático.

## 8. Target de residuos bloqueado

La siguiente estructura responde al objetivo del encargo, pero su estado es **NO IMPLEMENTABLE
COMO UI FUNCIONAL** con los contratos actuales.

| Workspace solicitado               | Estado                    | Dependencias mínimas                                                 |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| Inicio operativo ambiental         | Bloqueado                 | agregados reales, periodo, sede, estados y alertas                   |
| Generación y segregación           | Bloqueado                 | catálogo de residuos, reglas de clasificación, registro y evidencias |
| Almacenamiento                     | Bloqueado                 | zonas, contenedores, capacidad, compatibilidad, inspecciones         |
| Trazabilidad                       | Bloqueado                 | eventos y relaciones de toda la cadena                               |
| Cumplimiento y legal               | Bloqueado                 | matriz legal ambiental versionada y validada                         |
| Centro documental                  | Parcialmente reutilizable | tipologías ambientales, relaciones y vigencias aún faltantes         |
| Excepciones y acciones correctivas | Bloqueado                 | modelo de excepción, severidad, SLA, asignación y cierre             |

### 8.1 Requisitos para desbloquear el target

1. Registrar el módulo o módulos en `moduleRegistry`.
2. Definir invariantes y estados en `packages/domain`.
3. Definir contratos en `packages/contracts`.
4. Crear migraciones con tenant, empresa, sede/área, RLS, índices y versionado.
5. Implementar casos de uso y autorización backend.
6. Crear permisos y roles operativos.
7. Definir fuentes legales ambientales oficiales y fecha de consulta.
8. Implementar documentos y evidencias vinculados.
9. Sembrar datos sintéticos deterministas.
10. Probar el flujo vertical completo end to end.

Solo después deben aparecer destinos ambientales en el shell.

### 8.2 Journey ambiental futuro condicionado

El proceso futuro no debe dividirse en pantallas desconectadas. Cuando el dominio exista, debe
conservar un identificador único a través de:

1. generación;
2. segregación;
3. almacenamiento inicial;
4. transferencia interna;
5. almacenamiento central;
6. despacho;
7. tratamiento, valorización, reciclaje o disposición;
8. cierre documental.

Cada fase necesita estado, cantidad, unidad, responsable, fecha, evidencia pendiente,
incidencias y base procedimental. La interacción visual no debe diseñarse antes de resolver
las reglas de transición y las relaciones de datos.

## 9. Responsive

### 9.1 Principios

- No reducir una tabla de escritorio hasta hacerla ilegible.
- No ocultar contexto, filtros o siguiente acción.
- Mantener el mismo significado y autorización entre viewports.
- Usar listas móviles orientadas a tarea cuando ya exista un render móvil real.
- Reservar scroll horizontal para conjuntos de datos donde comparar columnas sea esencial.
- Mantener objetivos táctiles de al menos `44 × 44 px`.

### 9.2 Comportamiento por viewport

| Viewport de prueba | Comportamiento                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `1920 × 1080`      | Sidebar persistente; contenido con ancho legible; tablas densas; detalle contextual si existe        |
| `1440 × 900`       | Sidebar persistente; una acción primaria; filtros y contenido sin segunda navegación redundante      |
| `1366 × 768`       | Sidebar compacta y desplazable; encabezados más cortos; evitar barras verticales dentro de la página |
| `768 × 1024`       | Drawer; contexto empresa/sede dentro del drawer; tablas transformadas; tabs desplazables y visibles  |
| `390 × 844`        | Lista orientada a tarea; filtros en hoja/pantalla; acción principal al alcance del pulgar            |
| `360 × 800`        | Una columna; copia compacta; sin pérdida de estado, filtros ni trazabilidad                          |

### 9.3 Correcciones prioritarias

- Reemplazar el ocultamiento de tabs inactivas por tabs desplazables o selector accesible.
- Mostrar empresa y sede en el drawer móvil.
- Evitar más de una barra fija inferior.
- Dar margen inferior equivalente a la barra fija y safe area.
- Convertir `QuickCreate` móvil en flujo de pantalla completa o diálogo accesible con:
  - título;
  - cierre;
  - foco inicial;
  - contención de foco;
  - restauración del foco;
  - prevención de pérdida de cambios.
- Mantener filtros, búsqueda y recuento en la transformación tabla-lista.
- No usar carruseles de métricas como única forma de conocer prioridades.

## 10. Estados de interfaz requeridos

Todos los estados deben conservar contexto, datos ingresados y una siguiente acción clara.

### 10.1 Cargando

- Indicar qué recurso se consulta.
- Mantener shell, contexto y título cuando sea posible.
- Evitar un spinner global para actualizaciones parciales.
- Anunciar el estado con `role="status"` sin repetir mensajes.
- No simular contenido final ni mostrar cifras antiguas como actuales.

### 10.2 Vacío

Debe distinguir:

- aún no existen registros;
- los filtros no devuelven resultados;
- el módulo no está configurado;
- el usuario no tiene alcance sobre registros;
- el recurso no está implementado.

La acción de creación solo aparece si el usuario tiene permiso y existe endpoint.

### 10.3 Éxito

- Confirmar la operación realizada.
- Mostrar identificador o estado resultante cuando sea útil.
- Ofrecer el siguiente paso real.
- Mantener el mensaje el tiempo suficiente y anunciarlo.
- No usar el mismo estilo para éxito y simple información.

### 10.4 Advertencia

- Explicar la condición y su impacto.
- Permitir continuar solo cuando la regla de negocio lo permita.
- No usar color como único indicador.
- Conservar advertencias de demo, OCR, IA, SUNAT y cumplimiento legal.

### 10.5 Error

- Usar mensaje formal y accionable.
- Diferenciar validación, red, servidor y conflicto de concurrencia.
- Preservar campos y filtros.
- Ofrecer reintento solo si es seguro.
- En errores de render, mantener acceso a navegación y recuperación.

### 10.6 Bloqueado

Aplicar a workflows detenidos por:

- dependencia de módulo;
- aprobación pendiente;
- evidencia ausente;
- estado incompatible;
- proveedor no configurado;
- operación sensible que requiere reautenticación;
- conflicto de versión.

Debe mostrar causa, requisito para continuar y responsable cuando exista. No reemplazarlo por
un botón deshabilitado sin explicación.

### 10.7 Sin conexión

- Mostrar el estado global.
- Permitir shell y borradores explícitamente soportados.
- Bloquear ventas confirmadas, documentos, pagos, movimientos de stock, caja, SUNAT,
  importaciones, OCR e IA sin servidor.
- No prometer envío automático.
- Indicar ubicación y fecha del último borrador.
- Pedir revisión manual antes de enviar al recuperar conexión.

### 10.8 Permiso denegado

- Mostrar una superficie 403 dentro del shell.
- Indicar que el acceso depende del rol y del ámbito actual.
- No revelar existencia o contenido de registros protegidos.
- Ofrecer regreso a un destino permitido.
- No confundirlo con “sin registros” ni con “módulo deshabilitado”.

### 10.9 Módulo no disponible

- Conservar el estado actual de ruta bloqueada.
- Explicar que la empresa tiene el módulo deshabilitado.
- No mostrar controles de activación si no existe `modules.manage`.
- Permitir regresar a inicio.

### 10.10 Pendiente y borrador

- Diferenciar “cambios sin guardar”, “guardado local” y “guardado en servidor”.
- Mostrar fecha del último guardado.
- Evitar “autosave” si el sistema solo ofrece guardado manual.
- Avisar antes de abandonar cambios.

### 10.11 Datos desactualizados

- Mostrar última actualización.
- Indicar si se conserva una vista anterior por error.
- Ofrecer actualizar sin borrar filtros o selección.
- No mezclar datos de periodos o sedes.

### 10.12 Conflicto o duplicado

- Identificar el registro relacionado sin exponer datos no autorizados.
- Permitir revisar, corregir o cancelar.
- No crear un segundo registro por reintento.
- Mantener idempotencia en acciones mutantes.

### 10.13 Estado restringido o sensible

- Sustituir contenido protegido por explicación de acceso, no por valores parcialmente
  visibles.
- Nunca mostrar secretos, prompts completos, datos médicos o diagnóstico.
- Mantener auditoría de la consulta cuando corresponda.

## 11. Accesibilidad vinculada a la IA

- Un solo `h1` por pantalla y jerarquía de encabezados coherente.
- `aside`, `nav`, `main`, `header` y regiones con nombres útiles.
- Destino activo comunicado más allá del color.
- Drawer móvil con gestión y restauración de foco.
- Tabs con teclado, panel asociado y estado seleccionado.
- Tablas con encabezados; listas móviles con nombres de campo explícitos.
- Mensajes de carga, error y éxito anunciados sin mover el foco innecesariamente.
- Foco visible en todos los controles, incluidos summary, enlaces y carga de archivo.
- Estado de conexión no comunicado solo mediante color o icono.
- Reflujo a `200 %` sin pérdida de acciones ni contexto.
- Respeto de `prefers-reduced-motion`.

Este documento no declara conformidad WCAG 2.2 AA; se requiere inspección manual de teclado,
lector de pantalla, contraste, zoom y foco.

## 12. Secuencia de implementación recomendada

1. Corregir pestañas que no tienen contratos reales.
2. Corregir copia offline y el falso stepper SST.
3. Unificar el manifiesto de navegación y eliminar grupos duplicados.
4. Sustituir contexto estático por datos reales de sesión.
5. Implementar estados 403, bloqueado y datos desactualizados.
6. Corregir navegación de tabs en móvil.
7. Verificar journeys reales por rol y viewport.
8. Mantener fuera del shell los workspaces ambientales hasta que se complete su dominio.

## 13. Criterios de aceptación de esta IA

- Ninguna ruta existente cambia de URL sin compatibilidad.
- La navegación solo presenta módulos y acciones reales.
- No existen pestañas que apunten a endpoints ausentes.
- Empresa, sede y periodo tienen una fuente de verdad explícita.
- Cada rol comienza en una superficie autorizada.
- Los estados requeridos están diferenciados semántica y visualmente.
- El móvil conserva contexto, filtros, siguiente acción y trazabilidad.
- No se promete sincronización, autosave, salud o cumplimiento no implementados.
- La gestión de residuos permanece marcada como bloqueada hasta contar con dominio, datos,
  permisos, API y pruebas.
- La validación final se realiza en los seis viewports requeridos y con teclado.

## 14. Riesgos residuales

1. La visión del encargo y el producto real no están alineados.
2. La amplitud de permisos del administrador puede seguir produciendo una navegación larga.
3. La existencia de componentes genéricos de Fase 3 puede ocultar discrepancias de contrato.
4. Los nombres estáticos de contexto pueden inducir a operar en un ámbito incorrecto.
5. Los borradores locales pueden interpretarse como sincronización si la copia no es precisa.
6. Sin sesiones reales por rol no se puede confirmar el orden final de navegación.
7. Sin dominio ambiental no es posible validar la cadena de residuos ni sus obligaciones.
