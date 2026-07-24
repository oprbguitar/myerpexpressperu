# Resultados de aislamiento multi-tenant

- **Fecha:** 2026-07-23
- **Método:** consultas ejecutadas contra la base de datos en ejecución
- **Veredicto:** **RLS INERTE — el aislamiento depende únicamente de la capa de aplicación**

## Resumen

El sistema declara aislamiento multi-tenant en dos capas: filtrado de aplicación
y políticas RLS de PostgreSQL. **La segunda capa no existe en ejecución.**

## Evidencia 1 — El rol de la aplicación es superusuario

```sql
select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
from pg_roles where rolname='erp';
```

```text
 rolname | rolsuper | rolbypassrls | rolcreatedb | rolcreaterole
---------+----------+--------------+-------------+---------------
 erp     | t        | t            | t           | t
```

`DATABASE_URL` en `.env` usa exactamente este rol. `docker-compose.yml` define
`POSTGRES_USER: erp`, y la imagen oficial de PostgreSQL convierte ese usuario en
superusuario del clúster.

En PostgreSQL, un rol con `rolsuper` o `rolbypassrls` **omite toda política RLS**,
incluso con `FORCE ROW LEVEL SECURITY` activo.

## Evidencia 2 — Ninguna tabla tiene FORCE RLS

```sql
select relforcerowsecurity, count(*) from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' group by relforcerowsecurity;
```

```text
 relforcerowsecurity | count
---------------------+-------
 f                   |   209
```

Además, `erp` es propietario de las 209 tablas. Incluso sin `rolbypassrls`, el
propietario omite RLS salvo con `FORCE`.

## Evidencia 3 — Prueba de comportamiento

Las políticas están bien escritas. Sobre `parties`:

```text
 policyname                 | cmd | qual
 parties_company_isolation  | ALL | ((tenant_id = app_tenant_id()) AND (company_id = app_company_id()))
 relrowsecurity = t
```

Con el GUC apuntando a un tenant inexistente, la política debería devolver 0 filas:

```sql
select set_config('app.tenant_id','00000000-0000-4000-8000-000000000000',false);
select set_config('app.company_id','00000000-0000-4000-8000-000000000000',false);
select count(*) from parties;
```

```text
 filas_visibles_de_otros_tenants
---------------------------------
                               3      ← debería ser 0
```

Repetido tras `alter table parties force row level security`: **también 3 filas**,
confirmando que `rolbypassrls` anula incluso `FORCE`.

## Evidencia 4 — No existe ningún rol restringido

```bash
grep -rn "create role|create user|grant |bypassrls|set role" migrations/*.up.sql
# sin resultados
```

Ninguna migración crea un rol de runtime. `AGENTS.md` menciona «un rol de
mantenimiento separado del runtime sujeto a RLS» para los reinicios demo, pero ese
rol nunca se crea.

## Atenuante verificado — el filtrado de aplicación sí funciona

El aislamiento **no está roto hoy**, porque la aplicación lo impone por su cuenta:

`apps/api/src/database.service.ts:24` fija el ámbito por petición:

```sql
select set_config('app.tenant_id',$1,true), set_config('app.company_id',$2,true)
```

Y los servicios filtran explícitamente. En `parties.service.ts`:

```text
:43   const conditions = ["p.tenant_id=$1", "p.company_id=$2"];
:79   where p.id=$1 and p.tenant_id=$2 and p.company_id=$3
:153  select * from parties where id=$1 and tenant_id=$2 and company_id=$3 for update
:161  where id=$1 and tenant_id=$2 and company_id=$3 and version=$17
```

El ámbito se deriva de la sesión (`auth.guard.ts:56-61`), nunca de entrada del
cliente. Eso es correcto.

## Por qué sigue siendo crítico

| Riesgo | Consecuencia |
| --- | --- |
| Un `WHERE` omitido en un servicio nuevo | Exposición entre tenants, sin red de seguridad |
| Inyección SQL en cualquier ruta | Acceso total al clúster: el rol es superusuario |
| Un módulo de Fase 4 que no siga la convención | Fuga silenciosa; ninguna prueba la detectaría |
| Reversión accidental del filtrado | Nada falla; las pruebas siguen verdes |

La Fase 4 añadiría ~200 tablas y 19 módulos. Depender de que cada desarrollador
recuerde dos cláusulas `WHERE` en cada consulta, con el respaldo desactivado y sin
prueba que detecte un olvido, es la base equivocada para ese crecimiento.

## Por qué las pruebas no lo detectaron

14 de las 17 pruebas de integración consultan solo `information_schema` y
`pg_catalog`. Afirman que **existe** una política, no que **actúe**:

- `phase1.test.ts:35-48` — comprueba que 4 nombres de política aparecen en `pg_policies`
- `phase2.test.ts:55-64` — comprueba que 6 tablas tienen ≥1 política de cualquier predicado
- `phase3-database.test.ts:63-72` — comprueba `relrowsecurity=true` en 124 tablas

Las tres afirmaciones son **verdaderas**. Y las tres seguirían siendo verdaderas
con el sistema exactamente igual de desprotegido. Ninguna prueba fija un GUC,
conecta con un rol restringido ni observa una denegación.

## Corrección requerida

1. Crear rol de aplicación sin `SUPERUSER` ni `BYPASSRLS`, con `GRANT` mínimo.
2. `ALTER TABLE ... FORCE ROW LEVEL SECURITY` en toda tabla con ámbito de tenant.
3. Mantener un rol de mantenimiento separado para migraciones y semillas.
4. Añadir prueba de comportamiento: conectar como rol de aplicación, fijar GUC de
   tenant A, e imponer que una lectura de datos de tenant B devuelva **0 filas**.

El paso 4 no es opcional. Sin él, los pasos 1–3 pueden revertirse sin que nada
falle.

## Alcance no cubierto

No se produjo la matriz tabla por tabla de las 208 tablas que pedía §7.2, ni las
pruebas sistemáticas de IDOR por endpoint de §8. Se declara la ausencia en lugar
de estimarla. La evidencia anterior es suficiente para el veredicto: mientras el
rol sea superusuario, el estado RLS de cada tabla individual es irrelevante.
