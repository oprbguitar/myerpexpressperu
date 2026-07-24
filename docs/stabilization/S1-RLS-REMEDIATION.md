# S1 — Separación de roles PostgreSQL y RLS efectiva

- **Fecha:** 2026-07-24
- **Hallazgo corregido:** C-1 (la aplicación conectaba como superusuario con BYPASSRLS; las políticas RLS eran inertes)
- **Estado:** `FIXED_VERIFIED` para la API. Worker documentado como interino (S7).

## El defecto

La API conectaba con el rol `erp`, que la imagen de PostgreSQL crea como
**superusuario**. Además `erp` era propietario de las 209 tablas. Un superusuario
—o el propietario— **omite toda política RLS**. Por eso las ~189 políticas
existentes no restringían nada en ejecución: el aislamiento dependía solo del
filtrado por `WHERE tenant_id=$1` en la capa de aplicación.

Corrección de una métrica previa: el informe de estado decía «16 políticas RLS».
Era un artefacto de `grep`; la base tiene **189 tablas con política** (las
migraciones posteriores las crean en un bucle).

## La arquitectura de roles

| Rol | SUPERUSER | BYPASSRLS | Propietario | Uso |
| --- | --- | --- | --- | --- |
| `erp` (migración) | sí | sí | sí | Migraciones y semilla, vía `DATABASE_MIGRATION_URL`. Nunca el runtime. |
| `erp_app` | **no** | **no** | **no** | API, vía `DATABASE_URL`. Solo DML de mínimo privilegio. |

Variables de entorno:

```text
DATABASE_URL            = erp_app     (API)
DATABASE_MIGRATION_URL  = erp         (migraciones, semilla)
```

`migrate.ts` y `seed.ts` usan `DATABASE_MIGRATION_URL`; la API usa `DATABASE_URL`.

## El obstáculo real: contexto de tenant por petición

73 llamadas `.query()` y 8 `.transaction()` de Fase 1/2 **no fijaban contexto de
tenant** — funcionaban porque el superusuario omitía RLS. Al pasar a `erp_app`
(no propietario), RLS se activa y toda consulta sin contexto devolvería 0 filas.

Solución implementada (sin envolver toda la petición en una sola transacción,
para preservar idempotencia y concurrencia):

1. `request-context.ts` — un `AsyncLocalStorage` con un cliente dedicado del pool
   por petición, con `app.tenant_id`/`app.company_id` fijados **a nivel de
   sesión** sobre ese cliente.
2. `tenant-context.interceptor.ts` — corre **después** de `AuthGuard`, toma el
   cliente, fija el contexto y envuelve la ejecución del handler. Al terminar,
   limpia el contexto y devuelve el cliente al pool.
3. `DatabaseService.query/transaction/scopedTransaction` — usan el cliente de la
   petición si existe; en otro caso el pool (login, salud), que solo toca tablas
   de sistema sin política.

Las peticiones no autenticadas (login) no tienen contexto y alcanzan solo tablas
sin política (`users`, `sessions`, `login_attempts`).

## Clasificación de tablas (§8.5)

| Categoría | Tablas | Tratamiento |
| --- | --- | --- |
| `TENANT/COMPANY_SCOPED` | 189 | RLS `ENABLE` + `FORCE`, política `tenant_id=app_tenant_id() and company_id=app_company_id()`. Contexto ausente → deniega. |
| `SYSTEM_PRIVILEGED` (identidad/auth) | 11 | `catalog_items`, `company_modules`, `company_settings`, `login_attempts`, `password_reset_tokens`, `roles`, `sessions`, `user_branches`, `user_companies`, `user_roles`, `users`. Se consultan **antes** de existir contexto (login), por lo que no llevan RLS por tenant. |
| `GLOBAL_REFERENCE` (sin `tenant_id`) | 9 | Catálogos globales (permisos, monedas, etc.). Sin RLS por diseño. |

Detalle en `TENANT-ISOLATION-MATRIX.md`.

Caso especial: `audit_events` tenía solo política de `SELECT`. Con `FORCE` RLS,
los `INSERT` de auditoría quedaban denegados (rompía el login). La migración 0013
añade una política de `INSERT` (`with check(true)`): la auditoría es de solo
anexado, escrita por el servidor y ya protegida contra UPDATE/DELETE por
triggers; la lectura sigue restringida por tenant.

## El worker — interino documentado

El worker es hoy un **escáner de sistema entre tenants**: recorre las cuentas,
stock y documentos de todos los tenants y genera notificaciones. Ese diseño es
incompatible con RLS por tenant sin el rediseño de **S7**. Hasta entonces usa un
rol privilegiado (`DATABASE_MIGRATION_URL`). No tiene superficie HTTP ni entrada
de usuario, por lo que el riesgo de escalado por inyección —el núcleo de C-1— no
aplica. Registrado como pendiente de S7 en `apps/worker/src/main.ts`.

## Guarda de arranque

`main.ts` consulta el rol de conexión al iniciar. Si es superusuario o tiene
BYPASSRLS: en producción **rechaza el arranque**; fuera de producción, advierte.

## Verificación ejecutada

Prueba de comportamiento como `erp_app` (no metadatos):

```text
erp_app super/bypass       : false / false
sin contexto  -> parties   : 0 filas          (deny por defecto)
contexto propio -> parties : 3 filas          (ve lo suyo)
contexto ajeno -> parties  : 0 filas          (aislamiento entre tenants)
insert fuera de contexto   : bloqueado 42501  (WITH CHECK deniega)
```

| Comprobación | Resultado |
| --- | --- |
| `erp_app` sin SUPERUSER/BYPASSRLS | ✅ |
| 189 tablas con RLS `ENABLE` + `FORCE` | ✅ |
| `tests/integration/rls-isolation.test.ts` (5, a través de erp_app) | ✅ cierra H-2 |
| Integración completa (22, incluidas las 5 nuevas) | ✅ |
| E2E como erp_app (login, dashboard, venta, concurrencia, PDF) | ✅ 18/6 |
| lint, typecheck, 86 unit, build | ✅ |
| Migraciones 0012/0013 revierten y reaplican | ✅ |

## Criterios de aceptación S1 (§8.7)

| Criterio | Estado |
| --- | --- |
| El rol de runtime no tiene BYPASSRLS | ✅ |
| El rol de runtime no es propietario de tablas | ✅ |
| RLS y FORCE RLS activos donde corresponde | ✅ (189) |
| Lecturas entre tenants devuelven cero | ✅ probado |
| Escrituras entre tenants fallan | ✅ probado (42501) |
| Las pruebas usan el rol de runtime real | ✅ (rls-isolation via erp_app) |
| CI ejecuta estas pruebas | ⏳ se conecta en S3 |
| Readiness detecta roles inseguros | ✅ guarda de arranque (readiness formal pendiente) |

## Riesgos residuales

- **El worker sigue con rol privilegiado** hasta S7. Interino documentado.
- **Las 11 tablas de identidad no tienen RLS por tenant** por necesidad del flujo
  de login. El acceso a `users` es global para el rol de app (se busca por email
  sin conocer el tenant). Inherente al diseño de autenticación.
- **Un cliente dedicado por petición** reduce el paralelismo al tamaño del pool
  (20). Suficiente para uso local; a vigilar bajo carga (medición en S-perf).
- La política de `audit_events` permite `INSERT` amplio al rol de app. Aceptable
  porque la auditoría es de solo anexado y la lectura sigue restringida.
