-- SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
-- SPDX-License-Identifier: MPL-2.0
drop table if exists catalog_items, catalog_types, company_settings, system_settings, audit_events,
documents, login_attempts, password_reset_tokens, sessions, company_modules, modules, user_roles,
role_permissions, permissions, roles, user_branches, user_companies, cost_centers,
organizational_areas, establishments, branches, user_profiles, companies, users, tenants cascade;
drop function if exists prevent_area_cycle() cascade;
drop function if exists app_tenant_id() cascade;
drop function if exists app_company_id() cascade;
drop type if exists company_classification, module_status, record_status cascade;
