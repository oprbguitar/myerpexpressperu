# Matriz de aislamiento de tenant

- **Fecha:** 2026-07-24
- **Base:** 209 tablas
- **Rol de aplicación:** `erp_app` (sin SUPERUSER ni BYPASSRLS, no propietario)

Clasificación de cada tabla y cómo se protege bajo el rol restringido.

## Resumen

| Categoría | Tablas | Protección |
| --- | --- | --- |
| `TENANT/COMPANY_SCOPED` | 189 | RLS `ENABLE` + `FORCE`, política por `tenant_id`+`company_id` |
| `SYSTEM_PRIVILEGED` (auth/identidad) | 11 | Sin RLS por tenant (se usan antes del contexto); filtrado en aplicación |
| `GLOBAL_REFERENCE` | 9 | Sin `tenant_id`; catálogos globales |

## TENANT/COMPANY_SCOPED (189)

Todas con `alter table ... enable row level security` + `force row level
security` y política:

```sql
using      (tenant_id = app_tenant_id() and company_id = app_company_id())
with check (tenant_id = app_tenant_id() and company_id = app_company_id())
```

Sin contexto (`app.tenant_id` vacío), `app_tenant_id()` es `NULL`, la condición
es falsa y **la tabla deniega todo acceso**. Verificado por comportamiento en
`tests/integration/rls-isolation.test.ts`.

Excepciones de política dentro de esta categoría:

| Tabla | Particularidad |
| --- | --- |
| `companies` | Política solo por `tenant_id` (no tiene `company_id`). |
| `audit_events` | `SELECT` restringido por tenant; `INSERT` permitido (solo-anexado, protegido por triggers). Migración 0013. |
| `occupational_exam_medical_details` | Además exige `app_has_medical_access()`. |
| `provider_configurations` | Además exige `app_has_provider_secret_access()`. |

(El listado completo de las 189 son las tablas de negocio: partes, productos,
ventas, compras, finanzas, CRM, proyectos, RR. HH., SST, activos, legal,
privacidad, IA, OCR, demo, inventario, etc.)

## SYSTEM_PRIVILEGED — auth/identidad (11)

```text
catalog_items  company_modules  company_settings  login_attempts
password_reset_tokens  roles  sessions  user_branches  user_companies
user_roles  users
```

**Por qué no llevan RLS por tenant:** se consultan durante el login y la
resolución de sesión, **antes** de que exista contexto de tenant (no se conoce el
tenant hasta identificar al usuario por correo). Aplicarles RLS por tenant
rompería la autenticación. El acceso a `users` es necesariamente global para el
rol de aplicación.

**Riesgo y mitigación:** el rol `erp_app` puede leer estas tablas entre tenants.
Se acota con filtrado explícito en la capa de aplicación y porque son tablas de
identidad, no de negocio. `catalog_items`, `company_modules` y `company_settings`
son candidatas a recibir política en una iteración posterior (no bloquean S1).

## GLOBAL_REFERENCE — sin `tenant_id` (9)

```text
catalog_types  currencies  modules  permissions  role_permissions
schema_migrations  system_settings  tenants  user_profiles
```

Catálogos y metadatos globales legítimamente compartidos. Sin `tenant_id`, sin
RLS por tenant. `schema_migrations` es el libro de migraciones. `tenants` es el
registro maestro de tenants (global por naturaleza).

## Cobertura y límites

- Las 189 tablas de negocio están cubiertas y verificadas por comportamiento en
  una muestra (`parties`) a través del rol restringido.
- No se ejecutó una prueba de comportamiento tabla-por-tabla para las 189; la
  política es idéntica y se validó el mecanismo. Una batería exhaustiva por tabla
  queda como mejora de cobertura.
- Las pruebas sistemáticas de IDOR por endpoint (§8 de la revisión) siguen
  pendientes; S1 aborda la capa de base de datos, no la enumeración de endpoints.
