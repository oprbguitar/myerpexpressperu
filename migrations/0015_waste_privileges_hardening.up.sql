-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
--
-- Endurecimiento de privilegios del módulo de residuos.
-- El runner de migraciones aplica este archivo dentro de una transacción.

revoke all privileges
  on waste_records, waste_lifecycle_events, waste_exceptions
  from erp_app;

grant select, insert, update
  on waste_records
  to erp_app;
grant select, insert
  on waste_lifecycle_events
  to erp_app;
grant select, insert, update
  on waste_exceptions
  to erp_app;
