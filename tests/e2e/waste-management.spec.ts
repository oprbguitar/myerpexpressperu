/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { PostgresDatabase } from "../../packages/database/src/index.js";

const createdDescriptions: string[] = [];

test.afterEach(async () => {
  if (createdDescriptions.length === 0 || !process.env.DATABASE_MIGRATION_URL) return;
  const database = new PostgresDatabase(process.env.DATABASE_MIGRATION_URL);
  const descriptions = createdDescriptions.splice(0);
  try {
    await database.transaction(async (client) => {
      const records = await client.query<{ id: string }>(
        "select id from waste_records where description=any($1::text[])",
        [descriptions]
      );
      const ids = records.rows.map((row) => row.id);
      if (ids.length === 0) return;
      await client.query("delete from waste_exceptions where waste_record_id=any($1::uuid[])", [ids]);
      await client.query("delete from waste_lifecycle_events where waste_record_id=any($1::uuid[])", [ids]);
      await client.query("delete from waste_records where id=any($1::uuid[])", [ids]);
    });
  } finally {
    await database.close();
  }
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(process.env.SEED_ADMIN_EMAIL ?? "");
  await page.getByLabel("Contraseña").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Resumen operativo" })).toBeVisible();
}

test("registra y avanza un residuo con trazabilidad real", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/residuos");
  await expect(page.getByRole("heading", { name: "Cadena de custodia operativa" })).toBeVisible();

  const marker = `${testInfo.project.name}-${Date.now()}`;
  const description = `Paños absorbentes de prueba ${marker}`;
  createdDescriptions.push(description);
  await page.getByRole("button", { name: "Registrar generación" }).click();
  await page.getByLabel("Origen o área generadora").fill("Taller de mantenimiento");
  await page.getByLabel("Descripción del material").fill(description);
  await page.getByLabel("Cantidad").fill("2.5");
  await page.getByLabel("Marcar para revisión de peligrosidad").check();
  await page.getByRole("button", { name: "Crear registro" }).click();

  await expect(page.getByRole("heading", { name: description })).toBeVisible();
  await expect(page.getByText("Generación", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Avanzar a Clasificación" }).click();
  await expect(page.getByRole("button", { name: "Avanzar a Segregación" })).toBeVisible();
  await expect(page.getByText("Clasificación", { exact: true }).last()).toBeVisible();

  const controls = await page.evaluate(async (recordDescription) => {
    const list = await fetch("http://localhost:3100/api/v1/waste/records?limit=100", {
      credentials: "include"
    });
    const records = await list.json() as Array<{ id: string; description: string; version: number }>;
    const record = records.find((item) => item.description === recordDescription);
    if (!record) throw new Error("No se encontró el registro creado.");
    const post = (path: string, key: string, body: unknown) => fetch(
      `http://localhost:3100/api/v1${path}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify(body)
      }
    );
    const exceptionKey = `e2e-waste-exception:${crypto.randomUUID()}`;
    const exceptionBody = {
      severity: "MEDIUM",
      exceptionType: "OTHER",
      description: "Excepción controlada por prueba E2E"
    };
    const firstException = await post(`/waste/records/${record.id}/exceptions`, exceptionKey, exceptionBody);
    const firstPayload = await firstException.json();
    const replayException = await post(`/waste/records/${record.id}/exceptions`, exceptionKey, exceptionBody);
    const replayPayload = await replayException.json();

    const advance = (key: string) => post(`/waste/records/${record.id}/advance`, key, {
      targetPhase: "SEGREGATION",
      version: record.version
    });
    const [left, right] = await Promise.all([
      advance(`e2e-waste-advance:${crypto.randomUUID()}`),
      advance(`e2e-waste-advance:${crypto.randomUUID()}`)
    ]);
    const closure = await post(
      `/waste/records/${record.id}/advance`,
      `e2e-waste-close:${crypto.randomUUID()}`,
      { targetPhase: "DOCUMENTARY_CLOSURE", version: record.version + 1 }
    );
    return {
      exceptionStatuses: [firstException.status, replayException.status],
      firstPayload,
      replayPayload,
      advanceStatuses: [left.status, right.status].sort(),
      closureStatus: closure.status
    };
  }, description);
  expect(controls.exceptionStatuses).toEqual([201, 201]);
  expect(controls.firstPayload).toEqual(controls.replayPayload);
  expect(controls.advanceStatuses).toEqual([201, 409]);
  expect([400, 409]).toContain(controls.closureStatus);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Cadena de custodia operativa" })).toBeVisible();
  await page.getByRole("button", { name: `Revisar ${description}` }).click();
  await expect(page.getByText("Segregación", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Excepción controlada por prueba E2E").last()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);

  if (testInfo.project.name !== "webkit") {
    await page.screenshot({
      path: resolve(
        testInfo.project.name.includes("mobile")
          ? "docs/design/waste-operations-mobile-implementation.png"
          : "docs/design/waste-operations-desktop-implementation.png"
      ),
      fullPage: true
    });
  }
});

test("API de residuos rechaza consultas sin sesión", async ({ request }) => {
  const response = await request.get("http://localhost:3100/api/v1/waste/overview");
  expect(response.status()).toBe(401);
});
