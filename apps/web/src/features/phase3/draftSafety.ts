/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
const forbiddenKeys = /(?:token|password|secret|diagnosis|diagnostico|medicalDetail|detalleMedico)/i;

export function assertSafePhase3Draft(value: unknown, path = "value"): void {
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenKeys.test(key)) {
      throw new Error(`El borrador contiene un campo no permitido: ${path}.${key}`);
    }
    assertSafePhase3Draft(nested, `${path}.${key}`);
  }
}
