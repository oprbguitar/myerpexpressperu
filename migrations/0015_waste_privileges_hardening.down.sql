-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
--
-- Restaura exactamente los privilegios concedidos por la migración 0014.
-- El runner de migraciones aplica este archivo dentro de una transacción.

revoke all privileges
  on waste_records, waste_lifecycle_events, waste_exceptions
  from erp_app;

grant select, insert, update, delete
  on waste_records, waste_lifecycle_events, waste_exceptions
  to erp_app;
