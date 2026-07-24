/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

const API = "http://localhost:3100/api/v1";

async function login(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }
  });
  expect(response.status()).toBe(201);
}

// Solo en un proyecto para no mutar el estado de módulos en paralelo.
test.describe("enforcement de módulos en runtime (C-2)", () => {
  test("deshabilitar un módulo de Fase 2 bloquea sus endpoints con MODULE_DISABLED", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Una ejecución basta para el enforcement de servidor");
    await login(request);
    const reason = { reason: "Prueba e2e de enforcement de módulos" };

    // Habilitado: el endpoint responde.
    expect((await request.get(`${API}/cash-accounts`)).status()).toBe(200);

    // 'dashboard' depende de 'cash'; se deshabilita primero.
    await request.post(`${API}/modules/dashboard/disable`, { data: reason });
    const disabled = await request.post(`${API}/modules/cash/disable`, { data: reason });
    expect(disabled.status()).toBe(201);

    try {
      // Deshabilitado: el endpoint de Fase 2 se bloquea con error estable.
      const blocked = await request.get(`${API}/cash-accounts`);
      expect(blocked.status()).toBe(409);
      const body = await blocked.json();
      expect(body.error.code).toBe("MODULE_DISABLED");
      expect(body.error.module).toBe("cash");

      // Otro módulo del mismo controlador (payments) sigue disponible.
      expect((await request.get(`${API}/payments?limit=1`)).status()).toBe(200);
      // Un endpoint core nunca se bloquea.
      expect((await request.get(`${API}/me`)).status()).toBe(200);
    } finally {
      // Restaurar siempre el estado.
      await request.post(`${API}/modules/cash/enable`, { data: {} });
      await request.post(`${API}/modules/dashboard/enable`, { data: {} });
    }

    // Rehabilitado: el endpoint vuelve a responder.
    expect((await request.get(`${API}/cash-accounts`)).status()).toBe(200);
  });

  test("disable-impact describe efectos reales del registro", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Una ejecución basta");
    await login(request);
    const response = await request.get(`${API}/modules/cash/disable-impact`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.impact).toBeDefined();
    expect(body.impact.frontendRoutes).toContain("/caja");
    expect(body.impact.historicalDataPreserved).toBe(true);
  });
});
