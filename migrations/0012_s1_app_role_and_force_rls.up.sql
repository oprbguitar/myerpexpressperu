-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
--
-- S1 — Separación de roles y RLS efectiva.
-- La ejecuta el rol de migración (propietario/superusuario) vía
-- DATABASE_MIGRATION_URL. Crea el rol de aplicación restringido `erp_app`,
-- le concede privilegios mínimos y FUERZA RLS en todas las tablas con política.

-- 1. Rol de aplicación restringido. Idempotente.
--    Contraseña local de desarrollo; en producción el rol se provisiona aparte
--    con un secreto real y esta sentencia no debe usarse para fijar la clave.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'erp_app') then
    create role erp_app login password 'erp_app_local_only'
      nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
  else
    -- Garantiza que nunca tenga privilegios peligrosos, aunque exista.
    alter role erp_app nosuperuser nobypassrls nocreatedb nocreaterole;
  end if;
end
$$;

-- 2. Privilegios mínimos de DML. Sin DDL, sin ownership.
grant usage on schema public to erp_app;
grant select, insert, update, delete on all tables in schema public to erp_app;
grant usage, select on all sequences in schema public to erp_app;
-- Funciones de apoyo usadas por políticas y por el runtime.
grant execute on all functions in schema public to erp_app;

-- Tablas y secuencias futuras heredan los mismos privilegios.
alter default privileges in schema public
  grant select, insert, update, delete on tables to erp_app;
alter default privileges in schema public
  grant usage, select on sequences to erp_app;
alter default privileges in schema public
  grant execute on functions to erp_app;

-- 3. FORCE ROW LEVEL SECURITY en toda tabla que ya tenga una política.
--    Sin FORCE, el propietario de la tabla omite RLS; con FORCE, RLS aplica a
--    todos salvo superusuarios. erp_app no es propietario ni superusuario, por
--    lo que RLS ya lo restringe; FORCE es defensa en profundidad y protege
--    también cualquier acceso accidental con el rol propietario.
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_policies where schemaname = 'public'
    group by tablename
  loop
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$$;
