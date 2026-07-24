---
document_type: independent_technical_verification
project: ERP Express Perú
date: 2026-07-23
reviewers: Agente A (arquitectura), Agente D (QA), revisor principal (base de datos, seguridad, fiabilidad)
method: verificación independiente por ejecución; el informe previo se trató como hipótesis
human_reviewed: false
---

# Revisión técnica independiente — Resumen ejecutivo

## Veredicto global

```text
PHASE_4_NOT_READY
```

No por falta de funcionalidad, sino porque **tres garantías arquitectónicas que el
sistema declara son falsas en ejecución**, y las tres fueron confirmadas
empíricamente en esta revisión, no deducidas.

`SYSTEM-STATE-REPORT.md` se trató como hipótesis. Su descripción del inventario
resultó correcta. Su evaluación de la **salud** del sistema no: declaraba «cero
defectos en Fases 1–3» y una línea base «verde». Ambas afirmaciones eran ciertas
solo bajo las condiciones exactas en que se ejecutó la suite, y ocultaban los
defectos de abajo.

---

## Hallazgos críticos confirmados por ejecución

### C-1 — La aplicación se conecta a PostgreSQL como SUPERUSUARIO con BYPASSRLS

Las 16 políticas RLS del sistema **están inertes en tiempo de ejecución**.

Evidencia ejecutada:

```sql
select rolname, rolsuper, rolbypassrls from pg_roles where rolname='erp';
--  erp | t | t
select tableowner, count(*) from pg_tables where schemaname='public' group by tableowner;
--  erp | 209
select relforcerowsecurity, count(*) ... group by relforcerowsecurity;
--  f | 209
```

Prueba de comportamiento: con `app.tenant_id` fijado a un tenant inexistente,
`select count(*) from parties` devolvió **3 filas** en lugar de 0. Repetido tras
`alter table parties force row level security`: **también 3 filas**, porque
`rolbypassrls` anula incluso `FORCE`.

Ninguna migración crea un rol restringido. `docker-compose.yml` define
`POSTGRES_USER: erp`, que la imagen convierte en superusuario, y `DATABASE_URL`
usa ese mismo rol.

**Atenuante verificado:** el aislamiento **sí** funciona hoy, pero en la capa de
aplicación. `apps/api/src/database.service.ts:24` fija `app.tenant_id` y
`app.company_id` por petición, y los servicios filtran explícitamente por
`tenant_id`/`company_id` en sus `WHERE` (verificado en `parties.service.ts:43,79,153,161`).

**Por qué sigue siendo crítico:** la segunda línea de defensa documentada no
existe. Un `WHERE` olvidado, un módulo nuevo que no siga la convención o una
inyección SQL exponen datos entre tenants sin ningún respaldo de base de datos.
La Fase 4 añadiría ~200 tablas y 19 módulos sobre esa premisa.

### C-2 — Desactivar un módulo no protege la mayoría de la API, y el sistema afirma lo contrario

Prueba ejecutada contra la API real:

| Acción | Resultado |
| --- | --- |
| `POST /modules/dashboard/disable` | 201 — estado pasa a `disabled` |
| `POST /modules/cash/disable` | 201 — estado pasa a `disabled` |
| `GET /dashboard` con módulo deshabilitado | **200** |
| `GET /cash-accounts` con módulo deshabilitado | **200** |
| `GET /cash-sessions` con módulo deshabilitado | **200** |

Y `GET /modules/sales/disable-impact` promete literalmente al operador:

> «La API y los jobs protegidos rechazan nuevas operaciones.»

Eso es falso para los ~80 endpoints de Fase 1/2. El decorador `@RequireModule`
existe y está correctamente implementado (`auth.guard.ts:20-21,74-87`, registrado
como `APP_GUARD` en `app.module.ts:70`), pero **solo se aplica en
`apps/api/src/phase3/**`**. Los 19 controladores de Fase 1/2 no lo usan ni una vez.

Un administrador que desactive un módulo por motivo de cumplimiento o licencia
creerá que revocó el acceso. No lo hizo.

### C-3 — `trustProxy: true` incondicional: IP falsificable y limitador de tasa evadible — **CORREGIDO**

`apps/api/src/main.ts:18` establecía `trustProxy: true` sin lista de proxies.

Prueba ejecutada (conexión directa a localhost, **sin proxy alguno**):

```text
X-Forwarded-For: 203.0.113.99        → registrado 203.0.113.99/32
X-Forwarded-For: 8.8.8.8             → registrado 8.8.8.8/32
X-Forwarded-For: 2001:db8::dead:beef → registrado 2001:db8::dead:beef/128
X-Forwarded-For: ::ffff:192.0.2.7    → registrado ::ffff:192.0.2.7/128
X-Forwarded-For: 1.1.1.1, 2.2.2.2…   → registrado 1.1.1.1/32 (el más a la izquierda)
```

Evasión del limitador de tasa, 150 peticiones cada una:

| Escenario | Resultado |
| --- | --- |
| IP falsificada fija | 120 × 200, **30 × 429** (el límite actúa) |
| IP falsificada rotada | **150 × 200, 0 × 429** (límite anulado por completo) |

Esa IP alimenta: el limitador (`http.ts:55`), el registro de intentos de acceso
(`auth.service.ts:40,47`), la auditoría (`operations.ts:88`) y **la evidencia de
aceptación legal** (`governance.service.ts:115,127`).

**Corrección aplicada y verificada.** Se introdujo `TRUSTED_PROXIES` (vacío por
defecto = ignorar cabeceras de reenvío). Tras la corrección:

```text
X-Forwarded-For: 203.0.113.77 → registrado 127.0.0.1/32  (dirección real)
rate limit con IP rotada      → 117 × 200, 33 × 429       (límite restaurado)
```

Clasificación §10: pasó de `UNSAFE` a **`REQUIRES_CONFIGURATION`** — seguro por
defecto; para desplegar tras un proxy inverso hay que declararlo explícitamente.

### C-4 — La suite de integración se autodesactiva en silencio

Ejecutado sin `DATABASE_URL`:

```text
Test Files  4 skipped (4)
      Tests 17 skipped (17)
EXIT_CODE=0
```

Las cuatro suites usan `describe.skipIf(!Boolean(process.env.DATABASE_URL))`.
En cualquier entorno sin esa variable, `pnpm test:integration` reporta éxito
habiendo verificado **cero** aislamiento, RLS o append-only. `phase3:verify` y
`phase4:verify` invocan ese comando. **No existe CI** (`.github/` no existe), así
que nada lo detectaría.

`tests/e2e/global-setup.ts:14-23` sí falla ruidosamente cuando falta
configuración. Las dos capas tienen semánticas opuestas.

---

## Hallazgos altos

| ID | Hallazgo | Evidencia |
| --- | --- | --- |
| H-1 | **La capa de dominio de Fase 3 es código muerto.** Las 27 funciones exportadas de `packages/domain/src/phase3/*` (869 líneas) no son referenciadas por nada salvo sus propias pruebas. El runtime de Fase 3 es CRUD genérico sobre tablas (`phase3-operations.service.ts:19-66`). Sus 25 pruebas verdes no prueban nada del comportamiento del sistema. | Verificación nombre por nombre en `apps/`, `tests/`, `packages/` |
| H-2 | **RLS se afirma pero nunca se ejerce.** 14 de 17 pruebas de integración solo consultan `information_schema`/`pg_catalog`. Ninguna fija un GUC de tenant y comprueba que una lectura cruzada devuelva 0 filas. Una prueba que dice «existe una política» no demuestra aislamiento. | `phase1.test.ts:35-48`, `phase2.test.ts:55-64`, `phase3-database.test.ts:63-72` |
| H-3 | **Toda la superficie de API fuera de Fase 3 carece de pruebas.** `auth.guard.ts`, `auth.service.ts`, `users.service.ts`, `storage.service.ts`, `csv.ts`, `sales.service.ts`, `finance.service.ts`, `inventory.service.ts` — 73 archivos, 4 con pruebas, todos bajo `phase3/`. | Inventario de archivos |
| H-4 | **El worker ignora la activación de módulos.** `apps/worker/src/main.ts:15-19` consulta los módulos habilitados y usa el resultado **solo para una línea de log** (`main.ts:118`). Genera notificaciones de SST, mantenimiento, proyectos y OCR para empresas con esos módulos desactivados. | Lectura de `main.ts` |
| H-5 | **`expectRejected` da falsa confianza.** `phase3-security-hardening.test.ts:56-70` captura *cualquier* excepción sin inspeccionarla. Un error de columna cuenta como «rechazo correcto». Afecta a las 11 aserciones negativas más fuertes del repositorio. | Lectura del helper |
| H-6 | **Sin herramienta de cobertura.** No hay proveedor instalado, ni umbral, ni `test:coverage`, ni archivo de configuración de vitest. La cobertura no es baja: es inmedible. | `package.json`, ausencia de `vitest.config.ts` |
| H-7 | **Sin CI.** No existe `.github/`. Los scripts de verificación son manuales y opcionales. | Estructura del repositorio |
| H-8 | **`--passWithNoTests` en 6 de 7 workspaces.** Borrar o renombrar un archivo de pruebas no rompe nada. `packages/contracts` y `apps/worker` no tienen pruebas y pasan. | `package.json` de cada workspace |

---

## Hallazgos medios y bajos

| ID | Hallazgo |
| --- | --- |
| M-1 | Errores de validación devuelven **500 en lugar de 400**. Un `ZodError` lanzado dentro de un handler no es mapeado por `ApiExceptionFilter`. Confirmado con `POST /auth/change-password` y `POST /modules/:code/disable`. |
| M-2 | Seis ciclos de importación barril↔hoja dentro de `packages/domain` (`index.ts` ↔ `phase2.ts`, `index.ts` ↔ `phase3/*`). Benignos hoy bajo ESM, frágiles ante cualquier inicialización de nivel superior. |
| M-3 | No existe capa de repositorio. `grep -rl "Repository"` devuelve cero archivos. `AGENTS.md` exige «límites de repositorio separados» para datos médicos, secretos y auditoría; esa separación no existe estructuralmente. |
| M-4 | `apps/web` no declara ninguna dependencia `@erp/*`. Las formas de petición/respuesta se redeclaran a mano; la deriva de contrato entre API y UI es indetectable en compilación. |
| M-5 | La prueba e2e «de concurrencia» no prueba concurrencia: dos `fetch` desde un mismo contexto con la misma clave de idempotencia verifican deduplicación, no una carrera de base de datos. Con `workers: 1, fullyParallel: false`, ninguna prueba genera paralelismo real. |
| M-6 | WebKit está configurado pero ejecuta solo 3 de 7 pruebas e2e, y nunca en viewport móvil, en un producto que es una PWA móvil primero. |
| M-7 | `phase3-operations` permite crear inspecciones y órdenes de trabajo directamente en estados no iniciales (`status` es campo escribible por cliente). |
| B-1 | `phase3-operations.service.ts:8` desactiva `no-unsafe-assignment` y `no-unsafe-return` para todo el archivo, contra la regla de TS estricto de `AGENTS.md`. |
| B-2 | `AppShell.tsx:120-121` codifica en duro «Comercial Andina S.A.C.» y «Sede principal» en el selector de empresa. |
| B-3 | `shell.spec.ts:53-58` escribe capturas en `docs/design/` durante la ejecución de pruebas, mutando el repositorio. |
| B-4 | `RequireModule` acepta `string` libre; nada lo vincula a `moduleRegistry`. Un error tipográfico falla en silencio (aunque fail-closed). |

---

## Fortalezas confirmadas

Estas también se verificaron, no se asumieron:

1. **La dirección de dependencias es genuinamente limpia.** `packages/domain` y
   `packages/contracts` no importan NestJS, React ni `pg`. Cero dependencias de
   runtime declaradas. Es la regla mejor ejecutada del repositorio.
2. **Los controladores son delgados y consistentes.** Validación zod en el borde,
   delegación al servicio. No se halló lógica de negocio en ningún controlador
   inspeccionado.
3. **No hay reglas de negocio en React.** Búsqueda de aritmética de IGV, `toFixed`,
   subtotales: cero coincidencias en `apps/web/src`.
4. **El ámbito tenant/empresa se deriva de la sesión**, nunca de entrada del
   cliente (`auth.guard.ts:56-61`).
5. **La capa de dominio puro de Fase 1/2 está bien probada** y correctamente
   cableada: `sales.service.ts` importa `PeruvianTaxCalculator`, `confirmSale`,
   `transitionQuotation`. 41 pruebas con aserciones reales sobre IGV, redondeo,
   transiciones y topes de aplicación de pagos.
6. **`packages/security` contiene aserciones negativas reales**: datos restringidos
   bloqueados pese a proveedor aprobado, denegación de lista de herramientas,
   rechazo de travesía de rutas, autoaprobación impedida.
7. **La guarda de reinicio demo está defendida en tres capas independientes** con
   pruebas de manipulación reales.
8. **SQL parametrizado** en todas las rutas inspeccionadas.
9. **Auditoría escrita en la misma transacción** que la mutación.
10. **Sin ciclos de importación entre paquetes ni entre módulos.**
11. **Licenciamiento y procedencia**: 220/220 archivos con SPDX, 769 dependencias
    sin licencias desconocidas ni prohibidas, SBOM de 709 componentes. Verificado
    por ejecución.

---

## Línea base reproducida

Ejecutada al inicio de esta revisión, antes de modificar código.

| Comando | Salida | Duración | Resultado |
| --- | --- | --- | --- |
| `pnpm lint` | 0 | 28 s | PASS |
| `pnpm typecheck` | 0 | 8 s | PASS, 7 proyectos |
| `pnpm test` | 0 | 11 s | PASS, 86 pruebas |
| `pnpm test:integration` | **1** | 3 s | **FALLA: 10 fallidas, 7 omitidas** — base caída |
| `pnpm test:compliance` | 0 | 3 s | PASS, 15 pruebas |
| `pnpm test:e2e` | **1** | 15 s | **FALLA** — base caída |
| `pnpm build` | 0 | 25 s | PASS |
| `pnpm audit --prod` | 0 | 1 s | PASS, sin vulnerabilidades |

La causa fue que Docker Desktop no estaba en ejecución. Tras levantarlo:
integración 17/17, e2e 18 pasadas y **6 omitidas**, `phase4:verify` salida 0.

**Las 6 omitidas nunca deben contarse como pasadas.** Son omisiones por proyecto
dentro del cuerpo de las especificaciones: el flujo móvil se omite en escritorio
y WebKit; PDF y concurrencia se ejecutan solo en `desktop-chromium`.

Este episodio es en sí un hallazgo: la línea base «verde» del informe previo
dependía de que un servicio externo estuviera arriba, y la suite de integración
no distingue «verificado» de «no ejecutado».

---

## Correcciones aplicadas en esta revisión

Solo se corrigió lo exigido para eliminar un riesgo de seguridad confirmado.

| ID | Corrección | Verificación |
| --- | --- | --- |
| SEC-2 | `trustProxy` configurable vía `TRUSTED_PROXIES`, vacío por defecto. `apps/api/src/main.ts`, `config.ts`, `.env`, `.env.example` | XFF falsificado ahora ignorado; limitador restaurado (33 × 429) |

No se añadió ningún módulo sectorial, endpoint, dashboard ni abstracción
especulativa, conforme a §2.2.

---

## Nota de integridad sobre esta revisión

Durante las pruebas se mutó el entorno local: se cambió la contraseña del
administrador sembrado, se desactivaron temporalmente los módulos `dashboard`,
`cash` y `crm`, y se creó un tenant B de prueba.

Esa mutación **rompió la suite e2e** (`global-setup.ts` autentica con
`SEED_ADMIN_PASSWORD`), lo que produjo una ejecución de 9 pasadas con fallos.
Se restauró el entorno con `pnpm db:reset` y la suite volvió a **18 pasadas,
6 omitidas**, idéntica a la línea base. Se documenta porque una lectura del
historial de comandos sin este contexto podría interpretar aquella ejecución
como un defecto del producto. No lo era.

---

## Documentos de esta revisión

Producidos:

- `EXECUTIVE-TECHNICAL-REVIEW.md` (este documento)
- `BASELINE-REPRODUCTION.md`
- `TRUSTED-PROXY-AND-IP-REVIEW.md`
- `TENANT-ISOLATION-RESULTS.md`
- `PHASE-4-READINESS-DECISION.md`
- `HUMAN-DECISIONS-REQUIRED.md`
- `agent-reports/AGENT-A-ARCHITECTURE.md`
- `agent-reports/AGENT-D-QA.md`

**No producidos** (§22 los pedía; se declara la ausencia en lugar de simularlos):
`DATABASE-INVENTORY.json/md` completo por columna, `TENANT-ISOLATION-MATRIX.md`
tabla por tabla, `MIGRATION-AUDIT.md`, `MODULE-MATURITY-REPORT.md`,
`TEST-ADEQUACY-REPORT.md` formal, `REQUIREMENT-TEST-MATRIX.md`,
`API-UI-COVERAGE-MATRIX.md`, `STAGING-READINESS.md`, `BACKUP-RESTORE-TEST.md`,
`PERFORMANCE-BASELINE.md`, `SLOW-QUERY-REPORT.md`, `PRODUCT-MATURITY-REPORT.md`,
`DEPENDENCY-GRAPH.md`, `MODULE-LOCATION-DECISION.md`,
`ARCHITECTURE-VERIFICATION.md` formal, y los planes de `docs/plans/`.

Razón: los hallazgos C-1 a C-4 son bloqueantes de la Fase 4 por sí solos. Los
ejercicios de §14 (staging remoto), §15 (restauración de respaldo) y §16
(carga con 50 000 transacciones) requieren infraestructura, credenciales y
autorización que no se tienen, además de varias horas de generación de datos.
Documentar esos ejercicios sin ejecutarlos sería exactamente lo que §2.1
prohíbe.
