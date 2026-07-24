-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
--
-- Revierte S1: quita FORCE RLS y revoca los privilegios de erp_app.
-- No elimina el rol (puede tener sesiones o pertenencias); solo lo desarma.

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_policies where schemaname = 'public'
    group by tablename
  loop
    execute format('alter table public.%I no force row level security', t);
  end loop;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'erp_app') then
    alter default privileges in schema public revoke select, insert, update, delete on tables from erp_app;
    alter default privileges in schema public revoke usage, select on sequences from erp_app;
    alter default privileges in schema public revoke execute on functions from erp_app;
    revoke all on all tables in schema public from erp_app;
    revoke all on all sequences in schema public from erp_app;
    revoke all on all functions in schema public from erp_app;
    revoke usage on schema public from erp_app;
  end if;
end
$$;
