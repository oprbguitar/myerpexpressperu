-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
--
-- El runner de migraciones aplica este archivo dentro de una transacción.

drop table if exists waste_exceptions;
drop table if exists waste_lifecycle_events;
drop table if exists waste_records;
