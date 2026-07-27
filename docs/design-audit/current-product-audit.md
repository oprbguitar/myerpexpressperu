# Auditoría del producto actual

**Proyecto inspeccionado:** ERP Express Perú
**Fecha de auditoría:** 2026-07-27
**Rama observada:** `codex/waste-operations-redesign`
**Alcance:** producto, rutas, flujos, roles, permisos, API, datos, componentes y estados existentes
**Método:** inspección estática exhaustiva del repositorio y resultados de línea base comunicados por el coordinador
**Estado de capturas:** incorporadas en `docs/design/` y en el registro local de auditoría

## 1. Resumen ejecutivo

El producto existente no es actualmente una aplicación para el registro,
segregación, almacenamiento, trazabilidad y destino final de residuos. Es un ERP
peruano modular de propósito general, con operación comercial, inventario,
finanzas, administración y varias capacidades de Fase 3.

No se encontraron módulos, entidades, migraciones, rutas, permisos ni contratos
específicos para:

- residuos;
- clasificación o segregación de residuos;
- contenedores de residuos;
- almacenamiento inicial o central de residuos;
- transferencias internas de residuos;
- manifiestos de residuos;
- operadores o infraestructuras de destino;
- valorización, reciclaje, tratamiento o disposición final;
- SIGERSOL;
- certificados de destino final.

Por lo tanto, el objetivo sectorial no puede resolverse de forma responsable
mediante un cambio visual, un renombrado del ERP o una colección de pantallas
estáticas. Requiere una decisión explícita de alcance y, si se aprueba, un nuevo
límite funcional integrado al monolito modular: dominio, contratos, permisos,
migraciones, RLS, servicios, API, worker, interfaz y pruebas.

La base existente ofrece capacidades reutilizables importantes: identidad,
autorización, ámbito tenant/empresa, documentos privados, auditoría,
notificaciones, sedes, áreas organizacionales, almacenes, personas, proveedores,
mapas opcionales y acciones correctivas SST. Esas capacidades deben integrarse,
no duplicarse ni sustituirse.

## 2. Alcance, evidencia y límites

### 2.1 Fuentes principales

- `README.md`
- `AGENTS.md`
- `apps/web/AGENTS.md`
- `apps/api/AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/SYSTEM-STATE-REPORT.md`
- `docs/stabilization/CURRENT-STABILIZATION-STATUS.md`
- `docs/PERMISSIONS.md`
- `docs/DOMAIN-MODEL.md`
- `docs/MODULE-SYSTEM.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/MOBILE-PWA.md`
- `docs/WORKFLOW-RULES.md`
- `docs/design/PHASE-3-DESIGN-SYSTEM.md`
- `apps/web/src/App.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/features/phase3/routes.tsx`
- controladores bajo `apps/api/src`
- migraciones `0001` a `0013`
- semillas bajo `packages/database/src`
- pruebas bajo `tests` y los paquetes del monorepo

### 2.2 Límites de esta entrega

- El coordinador ejecutó la línea base técnica y comunicó sus resultados.
- El coordinador añadirá las capturas de las pantallas principales. Este
  documento no inventa observaciones visuales de una ejecución no capturada.
- La línea base E2E terminó con 20 pruebas pasadas y 10 omisiones condicionales
  previstas en Chromium de escritorio/móvil y WebKit.
- Los hallazgos visuales se basan en estructura, estilos y componentes del
  código, no sustituyen la inspección posterior de las capturas.
- Esta auditoría no acredita cumplimiento de WCAG 2.2 AA ni cumplimiento legal.

## 3. Línea base técnica

Resultados comunicados por el coordinador:

| Comando                 | Resultado actual                              |
| ----------------------- | --------------------------------------------- |
| `pnpm lint`             | PASS                                          |
| `pnpm typecheck`        | PASS                                          |
| `pnpm test`             | PASS, 90 pruebas                              |
| `pnpm build`            | PASS                                          |
| `pnpm db:migrate`       | PASS                                          |
| `pnpm db:seed`          | PASS                                          |
| `pnpm test:integration` | PASS, 22/22                                   |
| `pnpm test:e2e`         | PASS, 20 pasadas y 10 omisiones condicionales |

Docker estaba inicialmente detenido y fue iniciado para completar las
verificaciones con infraestructura.

Al comenzar la inspección se observaron cambios ajenos en artefactos de
TypeScript:

- `apps/api/tsconfig.tsbuildinfo`
- `apps/worker/tsconfig.tsbuildinfo`
- `packages/database/tsconfig.tsbuildinfo`

Estos archivos no fueron modificados por el auditor de producto. Deben tratarse
como cambios generados por otros procesos de la línea base y no incluirse
automáticamente en un commit de diseño.

## 4. Arquitectura real

El producto es un monolito modular:

- `apps/web`: React 19, React Router 7, Vite 7 y PWA;
- `apps/api`: NestJS sobre Fastify;
- `apps/worker`: trabajos en segundo plano;
- `packages/domain`: invariantes y estados sin dependencias de framework;
- `packages/contracts`: contratos y puertos;
- `packages/database`: PostgreSQL, migraciones y semillas;
- `packages/security`: controles transversales;
- `modules/*`: límites y guías de módulo, no un segundo runtime.

La interfaz consume `/api/v1` mediante cookies de sesión. El tenant, la empresa,
las sedes y los permisos provienen de la sesión. La API y PostgreSQL son la
autoridad de seguridad; la visibilidad en la UI solo es una ayuda de experiencia.

### 4.1 Dimensiones verificables

| Dimensión                                   | Inventario actual |
| ------------------------------------------- | ----------------: |
| Rutas web explícitas, sin fallback          |                39 |
| Rutas web base, sin fallback                |                28 |
| Rutas web de Fase 3                         |                11 |
| Controladores NestJS encontrados            |                29 |
| Métodos HTTP declarados                     |               147 |
| Pares de migración                          |                13 |
| Declaraciones `CREATE TABLE` en migraciones |               208 |
| Tablas reportadas en la base viva           |               209 |
| Módulos registrados                         |                47 |
| Módulos no implementados                    |                 4 |
| Roles predeterminados                       |                 6 |

La diferencia entre las 208 declaraciones de tablas y las 209 tablas reportadas
en ejecución debe atribuirse a tablas de infraestructura o seguimiento del
runner, no a un dominio de residuos.

## 5. Inventario de rutas y pantallas

### 5.1 Acceso y sesión

| Ruta               | Pantalla                  | Protección | Función                               |
| ------------------ | ------------------------- | ---------- | ------------------------------------- |
| `/login`           | Inicio de sesión          | Pública    | Autenticación por correo y contraseña |
| `/recuperar-clave` | Solicitud de recuperación | Pública    | Solicitud no reveladora de existencia |
| `/cambiar-clave`   | Cambio de contraseña      | Sesión     | Cambio obligatorio o voluntario       |

### 5.2 Operación comercial y financiera

| Ruta                  | Pantalla              | Permiso de navegación | Función principal                               |
| --------------------- | --------------------- | --------------------- | ----------------------------------------------- |
| `/`                   | Resumen operativo     | `dashboard.read`      | Ventas, caja, CxC/CxP, stock y SUNAT            |
| `/notificaciones`     | Notificaciones        | `dashboard.read`      | Consulta de avisos                              |
| `/clientes`           | Clientes              | `parties.read`        | Consulta, búsqueda y alta                       |
| `/proveedores`        | Proveedores           | `parties.read`        | Consulta, búsqueda y alta                       |
| `/productos`          | Productos y servicios | `products.read`       | Consulta y alta                                 |
| `/precios`            | Listas de precios     | `pricing.read`        | Consulta y alta                                 |
| `/cotizaciones`       | Cotizaciones          | `quotations.read`     | Alta y transición comercial                     |
| `/pedidos-venta`      | Pedidos de venta      | `sales-orders.read`   | Consulta y confirmación                         |
| `/ventas`             | Ventas                | `sales.read`          | Venta rápida, confirmación, PDF y emisión       |
| `/compras`            | Compras               | `purchases.read`      | Alta, confirmación y PDF                        |
| `/gastos`             | Gastos                | `expenses.read`       | Alta y registro                                 |
| `/cuentas-por-cobrar` | Cuentas por cobrar    | `receivables.read`    | Consulta, cobro y PDF                           |
| `/cuentas-por-pagar`  | Cuentas por pagar     | `payables.read`       | Consulta, pago y PDF                            |
| `/pagos`              | Pagos y cobros        | `payments.read`       | Consulta y reversión                            |
| `/caja`               | Caja                  | `cash.read`           | Apertura, cierre y PDF                          |
| `/inventario`         | Inventario            | `inventory.read`      | Saldos, movimientos, transferencias y ajustes   |
| `/sunat`              | SUNAT básico          | `sunat.read`          | Flujo manual o simulación rotulada              |
| `/importaciones`      | Intercambio de datos  | `imports.read`        | Plantilla, preview, ejecución y exportación CSV |

### 5.3 Administración transversal

| Ruta            | Pantalla                 | Permiso de navegación | Función actual            |
| --------------- | ------------------------ | --------------------- | ------------------------- |
| `/organizacion` | Organización             | `organization.read`   | Configuración empresarial |
| `/sedes`        | Sedes y establecimientos | `branches.read`       | Consulta                  |
| `/usuarios`     | Usuarios                 | `users.read`          | Consulta                  |
| `/roles`        | Roles y permisos         | `roles.read`          | Consulta                  |
| `/modulos`      | Activación de módulos    | `modules.read`        | Consulta y habilitación   |
| `/documentos`   | Archivos privados        | `documents.read`      | Carga, listado y descarga |
| `/auditoria`    | Registro de auditoría    | `audit.read`          | Consulta de eventos       |

### 5.4 Fase 3

| Ruta                | Módulo                    | Permiso               | Superficie actual                              |
| ------------------- | ------------------------- | --------------------- | ---------------------------------------------- |
| `/administracion`   | `admin-control-plane`     | `admin.settings.read` | Centro administrativo tabulado                 |
| `/crm`              | `crm`                     | `crm.read`            | Prospectos, oportunidades y tabs incompletos   |
| `/proyectos`        | `projects`                | `projects.read`       | Proyectos y tabs de ejecución                  |
| `/recursos-humanos` | `human-resources`         | `hr.read`             | Lector genérico, varios endpoints ausentes     |
| `/sst`              | `occupational-safety`     | `sst.read`            | Inspección móvil y tabs incompletos            |
| `/activos`          | `assets`                  | `assets.read`         | Activos y órdenes de mantenimiento             |
| `/ocr`              | `ocr`                     | `ocr.read`            | Carga, extracción y revisión humana            |
| `/asistente`        | `artificial-intelligence` | `ai.use`              | Consulta gobernada                             |
| `/mapas`            | `maps`                    | `maps.read`           | Geocodificación y coordenadas manuales         |
| `/legal-privacidad` | `legal-compliance`        | `legal.read`          | Legal, consentimientos, privacidad y retención |
| `/demostracion`     | `demo-management`         | `demo.read`           | Lectores demo y reinicio remoto deshabilitado  |

El fallback de rutas redirige a `/`. No existe una pantalla 404 específica.

## 6. Inventario de roles y perfiles

### 6.1 Roles predeterminados

| Código                 | Nombre                           | Alcance resumido                                                  |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `company-admin`        | Administrador de empresa         | Todos los permisos definidos                                      |
| `platform-super-admin` | Superadministrador de plataforma | Sin permisos asignados por esta semilla                           |
| `supervisor`           | Supervisor                       | Todos salvo administración sensible seleccionada                  |
| `operator`             | Operador                         | Lectura y operación comercial básica                              |
| `read-only`            | Usuario de solo lectura          | Permisos cuyo código termina en `.read`                           |
| `auditor`              | Auditor                          | Organización, identidad, módulos, ajustes, documentos y auditoría |

### 6.2 Personas funcionales del demo portable

- administrador;
- gerente;
- ventas;
- caja;
- proyecto;
- recursos humanos;
- SST;
- auditoría.

Estas personas del demo no equivalen a los perfiles solicitados para la gestión
de residuos. En particular, no existen roles verificados para SOMA, almacén de
residuos, área generadora, supervisor ambiental, operador de residuos o
responsable SIGERSOL.

### 6.3 Modelo de autorización

- La sesión entrega `userId`, `tenantId`, `companyId`, `branchIds`, permisos y
  el indicador de cambio obligatorio de contraseña.
- La navegación filtra enlaces por permiso.
- El backend aplica permisos por endpoint.
- Los módulos pueden habilitarse o deshabilitarse por empresa.
- PostgreSQL agrega RLS por tenant y empresa.

## 7. Inventario de flujos

### 7.1 Flujos primarios existentes

#### Autenticación

1. Ingreso de credenciales.
2. Creación de sesión opaca en cookie HTTP-only.
3. Consulta de `/me`.
4. Redirección a cambio de contraseña si corresponde.
5. Acceso al resumen.

#### Venta

1. Selección o alta de cliente.
2. Selección de ítem y almacén cuando corresponde.
3. Creación de cotización o venta.
4. Cálculo de precios, impuestos y totales en el servidor.
5. Transición de cotización a enviada y aceptada.
6. Conversión a pedido.
7. Confirmación idempotente de pedido o venta.
8. Creación de cuenta por cobrar y efectos de stock según el caso.
9. Emisión de documento interno o tratamiento manual SUNAT.
10. Registro de cobro.
11. Generación de PDF.

#### Compra y gasto

1. Selección de proveedor.
2. Creación de compra o gasto.
3. Conservación de borrador local en flujos compatibles.
4. Confirmación o registro idempotente.
5. Efecto en inventario y/o cuenta por pagar.
6. Registro del pago.
7. Generación de PDF en compras.

#### Inventario

1. Consulta de saldos y movimientos.
2. Transferencia entre almacenes o ajuste.
3. Validación transaccional en API.
4. Actualización de saldos.

#### Caja

1. Apertura de sesión.
2. Consulta de movimientos.
3. Conteo y borrador local.
4. Cierre idempotente.
5. Generación de PDF de cierre.

### 7.2 Flujos secundarios existentes

- importación CSV con plantilla, preview y ejecución;
- exportación CSV;
- carga y descarga de documentos privados;
- activación de módulos;
- auditoría;
- notificaciones;
- alta rápida de prospectos y proyectos;
- inspección SST;
- carga y revisión OCR;
- consulta IA gobernada;
- geocodificación opcional;
- legal, aceptación, consentimiento y solicitudes de privacidad;
- mantenimiento del demo mediante herramientas locales protegidas.

### 7.3 Flujos solicitados que no existen

No existe una cadena verificable:

```text
Generación
→ Clasificación
→ Segregación
→ Almacenamiento inicial
→ Transferencia interna
→ Almacenamiento central
→ Despacho
→ Tratamiento, valorización, reciclaje o disposición
→ Cierre documental
```

Tampoco existen estados, responsables, evidencia, cantidades, unidades,
incidentes o bases legales asociados a esas fases.

## 8. Inventario de API

La API contiene 147 métodos HTTP. El inventario se agrupa por capacidad para
evitar presentar una lista extensa sin contexto.

| Grupo              | Prefijos o recursos                                 | Operaciones existentes                                                        |
| ------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Salud              | `/health`, `/health/readiness`                      | Readiness y salud                                                             |
| Sesión             | `/auth`, `/me`                                      | Login, logout, recuperación, cambio de clave, sesiones                        |
| Organización       | `/companies/current`, `/branches`                   | Consulta y edición de empresa, consulta de sedes                              |
| Usuarios y roles   | `/users`, `/roles`                                  | Listado, alta, desactivación y alta de rol                                    |
| Módulos            | `/modules`                                          | Listado, habilitación, impacto y deshabilitación                              |
| Auditoría          | `/audit`                                            | Consulta paginada                                                             |
| Documentos         | `/documents`                                        | Listado, carga y descarga autorizada                                          |
| Partes             | `/parties`, `/customers`, `/suppliers`              | Consulta, alta, edición, roles, crédito y desactivación                       |
| Catálogo           | `/items`, `/item-categories`, `/units`              | CRUD parcial de ítems y catálogos                                             |
| Precios            | `/price-lists`                                      | Listado, alta y resolución                                                    |
| Ventas             | `/quotations`, `/sales-orders`, `/sales`            | Creación, estados, conversión, confirmación y cancelación                     |
| Compras            | `/purchases`, `/expenses`                           | Creación, confirmación, registro y cancelación                                |
| Finanzas           | `/receivables`, `/payables`, `/payments`, `/cash-*` | Consulta, pago, reversión, apertura y cierre                                  |
| Inventario         | `/warehouses`, `/inventory`                         | Saldos, movimientos, transferencias y ajustes                                 |
| SUNAT básico       | `/sunat`                                            | Configuración, documentos, historia, adjuntos, estado y mock                  |
| Dashboard          | `/dashboard`                                        | Resumen agregado                                                              |
| Intercambio        | `/imports`, `/exports`                              | Plantilla, preview, ejecución y exportación                                   |
| Notificaciones     | `/notifications`                                    | Listado y marcado como leído                                                  |
| PDF                | `/pdf/:type/:id`                                    | Generación y almacenamiento autorizado                                        |
| Administración F3  | `/admin`                                            | Ajustes, features, perfiles e historial                                       |
| Proveedores        | `/admin/providers`                                  | Listado, test, activación, desactivación y exportación segura                 |
| CRM                | `/crm`                                              | Prospectos y oportunidades                                                    |
| Proyectos          | `/projects`                                         | Proyectos, tareas, horas y gastos por proyecto                                |
| Personas y SST     | `/hr`, `/sst`                                       | Empleados, inspecciones y hallazgos                                           |
| Activos            | `/assets`, `/maintenance`                           | Activos y órdenes de trabajo                                                  |
| Legal y privacidad | `/legal`, `/privacy`                                | Documentos, versiones, aceptaciones, consentimientos, solicitudes y retención |
| OCR                | `/ocr`                                              | Jobs, extracción y confirmación                                               |
| IA                 | `/ai`                                               | Consulta, documentos, feedback, uso e incidentes                              |
| Mapas              | `/maps/geocode`                                     | Geocodificación opcional                                                      |

No existe prefijo o controlador de residuos.

## 9. Inventario de entidades

### 9.1 Núcleo y seguridad

- tenants;
- empresas, sedes, establecimientos, áreas y centros de costo;
- usuarios, perfiles, sesiones y recuperación de contraseña;
- roles, permisos y asignaciones;
- módulos por empresa;
- auditoría;
- ajustes;
- documentos y metadatos.

### 9.2 Operación comercial

- partes, roles, direcciones y contactos;
- perfiles de cliente y proveedor;
- productos, categorías, unidades, impuestos y códigos de barra;
- listas de precios;
- almacenes, movimientos, líneas, saldos y reservas;
- cotizaciones, pedidos, ventas y líneas;
- documentos comerciales, series, eventos y envíos;
- compras, gastos y documentos de proveedor;
- cuentas por cobrar y por pagar;
- pagos, aplicaciones, caja y movimientos;
- importaciones, exportaciones, idempotencia, outbox y notificaciones.

### 9.3 Fase 3

- perfiles de negocio, feature flags, versiones y aprobaciones;
- leads, oportunidades, pipelines y actividades;
- proyectos, tareas, hitos, entregables, presupuestos, costos, tiempo, gastos,
  riesgos, incidencias y cambios;
- trabajadores, contratos, puestos, asignaciones, asistencia, documentos,
  licencias, vacaciones, capacitación y certificaciones;
- peligros, riesgos, evaluaciones, controles, inspecciones, hallazgos, acciones
  correctivas, incidentes, accidentes y SST;
- activos, asignaciones, historial, mantenimiento y lecturas;
- OCR, campos extraídos y correcciones;
- proveedores, políticas, plantillas, interacciones, tools, feedback y uso de IA;
- ubicaciones, intentos de geocodificación y agregados;
- reglas, ejecuciones y simulaciones de workflow;
- documentos legales, requisitos, fuentes y aceptaciones;
- clasificaciones de datos, consentimientos, solicitudes de privacidad,
  retención y legal holds;
- configuraciones de proveedor, salud y uso;
- perfiles, escenarios, snapshots y reinicios demo;
- métricas, eventos de seguridad y checkpoints de auditoría.

### 9.4 Reutilización posible para un futuro módulo de residuos

Podrían reutilizarse, mediante contratos explícitos:

- empresas, sedes, áreas y centros de costo como origen organizacional;
- almacenes como infraestructura genérica, si el dominio demuestra
  compatibilidad;
- partes/proveedores para transportistas y operadores, con roles sectoriales
  adicionales;
- documentos para manifiestos, pesajes y certificados;
- mapas para ubicaciones confirmadas;
- notificaciones y outbox;
- auditoría e historial;
- acciones correctivas SST como patrón de estado, no como sustituto del dominio
  ambiental.

No debe reutilizarse una tabla únicamente por semejanza de nombre. Por ejemplo,
un almacén comercial no es automáticamente un almacén central de residuos.

## 10. Inventario de componentes y patrones UI

### 10.1 Shell y navegación

- `AppShell`: sidebar persistente en escritorio y drawer en móvil;
- navegación agrupada;
- topbar;
- indicador online/offline;
- selector visual de empresa y sede;
- menú de usuario;
- filtrado por permiso y módulo.

### 10.2 Componentes compartidos

- `PageHeader`;
- `Field`;
- `TextInput`;
- `Button`;
- `LoadingState`;
- `EmptyState`;
- `ErrorBoundary`;
- `ResponsiveRecords`;
- `StatusBadge`;
- `ErrorNotice`;
- `Toolbar`;
- `FormActions`.

### 10.3 Componentes gráficos

- `TrendChart`;
- `BarChart`;
- `DonutChart`;
- `ProgressBar`;
- `ComparisonBars`.

Son componentes SVG/CSS sin librería externa y consumen datos del servidor.

### 10.4 Componentes de Fase 3

- `Phase3Header`;
- `ResourcePanel`;
- `Tabs`;
- `QuickCreate`;
- `usePhase3Resource`;
- borradores IndexedDB con validación de campos sensibles.

`ResourcePanel` no es un inspector de dominio. Busca la primera colección en una
respuesta, toma hasta cinco claves y representa objetos como “Detalle
protegido”. Su reutilización indiscriminada reduce claridad y puede ocultar
información necesaria en una decisión operativa.

### 10.5 Sistema visual existente

El sistema actual usa:

- azul marino para navegación;
- azul para enlaces y foco;
- esmeralda para acción primaria y éxito;
- ámbar para advertencia;
- rojo para error o riesgo;
- radios de 6 a 10 píxeles;
- bordes finos y sombra mínima;
- tipografía de sistema;
- tablas en escritorio y listas en móvil;
- `prefers-reduced-motion`;
- foco visible.

La base es sobria y consistente. No justifica replicar el actual dashboard de
tarjetas para el dominio ambiental.

## 11. Fricciones y defectos de experiencia

### 11.1 Riesgos críticos

#### P-01 — Desalineación de producto y alcance

El prompt sectorial presupone un sistema de residuos que no existe. Un rediseño
que lo presente como implementado violaría la trazabilidad del producto y
crearía controles, métricas y cumplimiento ficticios.

**Decisión requerida:** definir si se crea un nuevo módulo sectorial o si se
audita solamente el ERP actual.

#### P-02 — Contexto hard-coded en el shell

`AppShell` muestra de forma fija:

- “Comercial Andina S.A.C.”;
- “Sede principal”;
- “Administrador”;
- iniciales “AD”.

Los selectores de empresa y sede no ejecutan ninguna acción. Esto puede
contradecir la sesión real y comunica una capacidad de cambio de contexto
inexistente.

#### P-03 — Promesa offline no implementada en SST

La pantalla SST afirma que la inspección se enviará al recuperar conexión, pero
no existe cola ni sincronización. El submit intenta llamar a la API de inmediato.

La promesa debe eliminarse o implementarse y probarse de extremo a extremo.

#### P-04 — Captura SST incompleta

La UI solicita sede, responsable, fecha límite y evidencia. El submit solo envía
tipo, fecha, estado y, opcionalmente, descripción y severidad del hallazgo. El
archivo no se carga; solo se conserva su nombre. Tampoco se crea la acción
correctiva prometida.

El indicador “Paso 3 de 7” es fijo y no corresponde a siete pasos navegables.

#### P-05 — Endpoints de UI inexistentes

Se identificaron llamadas sin controlador correspondiente:

- `/crm/pipelines`;
- `/crm/activities`;
- `/hr/contracts`;
- `/hr/attendance`;
- `/hr/leaves`;
- `/hr/trainings`;
- `/hr/certifications`;
- `/sst/risks`;
- `/sst/corrective-actions`;
- `/sst/incidents`;
- `/maps/aggregates`;
- `/demo/profiles`;
- `/demo/scenarios`;
- `/demo/build`.

El reinicio demo no debe transformarse en endpoint remoto; esa ausencia es una
decisión de seguridad.

### 11.2 Riesgos altos

#### P-06 — Guardas UX incompletas

Ocultar enlaces no protege una ruta. Una URL directa puede montar la pantalla y
terminar en error de API. No existe estado de permiso denegado. Las rutas de Fase
3 declaran módulo, pero no se envuelven en `ModuleRoute`.

#### P-07 — Acciones visibles sin permiso de acción

Las páginas se descubren con permisos de lectura, pero pueden mostrar acciones
de alta, confirmación, reversión o edición sin comprobar el permiso específico.
El usuario descubre la restricción después de operar y recibir un 403.

#### P-08 — Operaciones de API sin superficie

Entre otras:

- marcar una notificación como leída;
- deshabilitar un módulo y revisar su impacto;
- crear o desactivar usuarios;
- crear roles;
- editar o desactivar partes e ítems;
- actualizar crédito;
- cancelar ventas, compras y gastos;
- adjuntar evidencias o cambiar estado SUNAT;
- publicar o revocar contenido legal;
- operar consentimientos y solicitudes de privacidad;
- probar y activar proveedores.

Estas capacidades deben clasificarse como “backend existente sin flujo
frontend”, no como funcionalidad completa.

#### P-09 — Tabs de proyectos ambiguos

Varios tabs consultan `/projects?include=...`; el controlador no declara una
semántica equivalente a las subrutas por proyecto. Existe riesgo de mostrar la
misma colección de proyectos bajo rótulos diferentes.

#### P-10 — Estados de consulta inconsistentes

Fase 3 distingue loading, error y empty. Varias páginas base convierten errores
en arreglos vacíos o no ofrecen reintento. No existe un modelo uniforme para:

- permiso denegado;
- módulo deshabilitado;
- conflicto de versión;
- estado bloqueado;
- pérdida de conexión;
- recuperación de borrador;
- éxito persistente;
- error parcial;
- sin resultados por filtros.

### 11.3 Riesgos medios

#### P-11 — Navegación extensa y duplicada

El sidebar agrupa primero las rutas base y luego Fase 3, repitiendo
“Operación” y “Administración”. El usuario debe recorrer una lista larga sin
búsqueda global, comando rápido, favoritos ni vistas recientes.

#### P-12 — Sin rutas de detalle

La mayoría de operaciones se resuelve con formulario inline sobre la lista. No
hay inspectores o rutas de detalle para reconstruir historial, evidencia,
relaciones y acciones de un registro.

#### P-13 — Capacidad limitada de listas

Las pantallas suelen pedir hasta 100 filas. Faltan:

- paginación visible;
- filtros por varias dimensiones;
- vistas guardadas;
- columnas configurables;
- filas expandibles;
- selección y acciones masivas;
- virtualización para volúmenes grandes;
- exportación que muestre el alcance activo.

#### P-14 — Foco y semántica de tabs

- Los formularios que aparecen no reciben foco de forma explícita ni lo
  restauran al cerrarse.
- Los tabs de Fase 3 no implementan `aria-controls`, `tabpanel` ni navegación
  por flechas.
- `CompanyPage` usa `role="tab"` para botones que solo enfocan campos; sus
  estados `aria-selected` permanecen fijos.

#### P-15 — Tablas y gráficos accesibles de forma parcial

- Las tablas carecen de `caption` y `scope`.
- La dona solo anuncia el número de categorías, no sus valores.
- Las barras de progreso no exponen semántica de progreso.
- No existe alternativa tabular explícita para todos los gráficos.
- Algunos estados se apoyan en color, flechas o ubicación visual.

Se necesita validación manual con teclado, zoom, reflow y lector de pantalla.

#### P-16 — Dashboard genérico para el nuevo propósito

El resumen actual usa un rail de cuatro métricas y una rejilla de paneles con
gráficos. Funciona como resumen comercial, pero no debe convertirse en la
plantilla automática de residuos. El futuro espacio ambiental requiere colas,
línea de ciclo, excepciones, evidencia y trazabilidad accionable.

## 12. Información necesaria en puntos de decisión

### 12.1 En el producto actual

| Decisión            | Información que debe permanecer visible                                 |
| ------------------- | ----------------------------------------------------------------------- |
| Confirmar venta     | Cliente, ítems, cantidades, almacén, precios, impuestos, total y estado |
| Confirmar compra    | Proveedor, líneas, almacén, total y efectos de stock/CxP                |
| Registrar pago      | Parte, saldo, importe, moneda, fecha, medio y aplicación                |
| Cerrar caja         | Saldo esperado, conteo, diferencia, motivo y sesión                     |
| Ajustar inventario  | Ítem, almacén, cantidad, motivo y efecto                                |
| Cambiar módulo      | Dependencias, impacto, datos históricos y autorización                  |
| Revisar OCR         | Original, campos, confianza, correcciones y confirmación humana         |
| Publicar legal      | Versión, fuente, aprobación, vigencia e historial                       |
| Ejecutar demo reset | Entorno, tenant reservado, fingerprint, permisos y preservación         |

### 12.2 Para un futuro flujo de residuos

Antes de diseñar las pantallas se debe definir, con fuentes y propietarios:

- catálogo y clasificación de residuos;
- unidades y reglas de conversión;
- origen organizacional y sede;
- responsable por etapa;
- compatibilidad de almacenamiento;
- contenedor, capacidad y etiquetado;
- estados y transiciones;
- transferencia y cadena de custodia;
- transportista, operador e infraestructura de destino;
- manifiesto, pesaje y certificado;
- evidencia obligatoria;
- excepciones y acciones correctivas;
- reglas de cierre;
- obligaciones legales y condicionalidad;
- retención y acceso documental;
- permisos y segregación de funciones.

## 13. Funciones que no deben alterarse

### 13.1 Seguridad y ámbito

- tenant y empresa derivados de sesión;
- cookie HTTP-only y sesiones revocables;
- autorización backend por permiso;
- RLS y `FORCE RLS`;
- rol PostgreSQL de runtime sin `BYPASSRLS`;
- consultas SQL parametrizadas;
- secretos solo en servidor;
- redacción de logs y eventos;
- límites separados para datos médicos y secretos de proveedor.

### 13.2 Integridad de negocio

- máquinas de estado;
- idempotencia de operaciones sensibles;
- cálculo servidor de precios, impuestos y totales;
- aplicación transaccional de stock, cuentas y caja;
- concurrencia optimista mediante `version`;
- historial append-only;
- auditoría;
- preservación histórica al deshabilitar un módulo.

### 13.3 Gobierno y límites honestos

- SUNAT permanece manual o mock y claramente rotulado;
- no afirmar conexión productiva SUNAT;
- OCR solo crea un borrador revisable;
- OCR no crea registros definitivos sin confirmación humana;
- IA solo usa herramientas registradas y no ejecuta acciones consecuenciales;
- mapas y proveedores externos son opcionales;
- los módulos opcionales no bloquean el arranque;
- legal y privacidad no declaran cumplimiento automático;
- fuentes legales no se cambian sin verificación oficial;
- datos médicos no entran en vistas ordinarias ni IA genérica.

### 13.4 Demo portable

- reinicio sin endpoint remoto;
- múltiples guardas independientes;
- imposibilidad de ejecutar en producción;
- roles separados de administración, runtime y reset;
- conservación de evidencia legal, consentimiento y privacidad;
- preservación de `privacy_request_actions`;
- fallo cerrado si la limpieza de almacenamiento falla.

### 13.5 PWA y borradores

- borradores acotados por usuario y empresa;
- prohibición de tokens, contraseñas, secretos y detalle médico;
- no almacenar evidencia binaria sensible como borrador;
- no confirmar ventas, mover stock, registrar pagos, cerrar caja, cambiar SUNAT
  ni ejecutar importaciones sin servidor;
- API como fuente de verdad.

## 14. Riesgo de alcance

| Riesgo                                              | Probabilidad | Impacto | Tratamiento                                         |
| --------------------------------------------------- | ------------ | ------- | --------------------------------------------------- |
| Convertir el ERP en un mock ambiental               | Alta         | Crítico | Detener implementación hasta definir dominio        |
| Inventar obligaciones o clasificaciones             | Alta         | Crítico | Exigir fuentes oficiales y revisión Legal           |
| Reutilizar inventario como residuos sin invariantes | Alta         | Alto    | Crear contratos y modelo sectorial explícito        |
| Añadir UI antes de API y datos                      | Alta         | Alto    | Vertical slice real con migraciones y pruebas       |
| Romper operación comercial existente                | Media        | Alto    | Mantener rutas y regresión E2E                      |
| Exponer documento o dato restringido                | Media        | Crítico | Reutilizar almacenamiento y autorización existentes |
| Habilitar demo reset remoto                         | Baja         | Crítico | Preservar ausencia del endpoint                     |
| Afirmar offline sin sincronización                  | Alta         | Alto    | Retirar promesa o implementar cola segura           |
| Basar UX en endpoints ausentes                      | Alta         | Alto    | Reconciliar contrato frontend/API                   |
| Incorporar `tsbuildinfo` ajenos                     | Media        | Bajo    | Excluir artefactos generados del commit             |

## 15. Riesgos técnicos vigentes del sistema

El reporte canónico mantiene el veredicto `PHASE_4_NOT_READY` y registra:

- dominio de Fase 3 no cableado completamente al runtime;
- cobertura baja de API;
- errores de validación que pueden responder 500 en lugar de 400;
- runner de migraciones sin checksums;
- worker sin reintentos, backoff ni dead-letter queue;
- puertas de seguridad y fiabilidad pendientes;
- revisión humana de licencias, procedencia y decisiones legales pendiente.

El rediseño no debe ocultar ni reinterpretar estos riesgos como resueltos.

## 16. Recomendación de secuencia

1. Cerrar la línea base E2E y añadir capturas actuales.
2. Acordar si el objetivo es rediseñar el ERP existente o crear un módulo
   sectorial de residuos dentro del ERP.
3. Si se aprueba el módulo, producir primero:
   - glosario y catálogo legal verificado;
   - modelo de dominio;
   - matriz de estados;
   - matriz rol-permiso;
   - contratos API;
   - entidades y RLS;
   - vertical slice Generation-to-Closure.
4. Reconciliar todos los endpoints ya declarados por Fase 3.
5. Definir arquitectura de información basada en roles reales, no en perfiles
   supuestos.
6. Diseñar tres direcciones visuales sobre flujos verificables.
7. Implementar tokens y componentes compartidos.
8. Migrar una cadena completa con datos reales.
9. Probar permisos, estados, teclado, móvil, auditoría y evidencia.
10. Escalar al resto de módulos solo después de la verificación vertical.

## 17. Conclusión

ERP Express Perú posee una base técnica valiosa y controles que deben
preservarse. Sin embargo, el producto sectorial descrito en el encargo todavía
no existe en este repositorio. La decisión de producto más importante no es
visual: es evitar que un rediseño simule un dominio ambiental sin estados,
datos, permisos, evidencia ni obligaciones verificadas.

La siguiente etapa de UX debe partir de esta distinción:

- **preservar** el ERP y sus capacidades verificadas;
- **corregir** fricciones y contratos incompletos;
- **diseñar** únicamente sobre funciones existentes o sobre un nuevo dominio
  previamente definido y aprobado;
- **no presentar** ninguna superficie como operativa hasta que funcione de
  extremo a extremo.
