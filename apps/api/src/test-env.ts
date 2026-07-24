/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Valores mínimos de entorno para que `config.ts` no falle al importarse en
 * pruebas unitarias que cargan controladores. No son secretos reales; solo
 * satisfacen la validación de esquema. Debe importarse ANTES que cualquier
 * módulo que dependa de la configuración.
 */
process.env.APP_URL ??= "http://localhost:5273";
process.env.DATABASE_URL ??= "postgresql://erp_app:test@localhost:5432/erp_test";
process.env.SESSION_SECRET ??= "test-only-session-secret-at-least-32-chars";
