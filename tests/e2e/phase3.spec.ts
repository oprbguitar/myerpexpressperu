import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(process.env.SEED_ADMIN_EMAIL ?? "");
  await page.getByLabel("Contraseña").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Resumen operativo" })).toBeVisible();
}

test("centro administrativo Fase 3 usa configuración real y es adaptable", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/administracion");
  await expect(page.getByRole("heading", { name: "Centro de administración" })).toBeVisible();
  await expect(page.getByText("No se pudo consultar esta superficie.")).toHaveCount(0);
  await expect(page.getByText("Configuración y gobierno por empresa.")).toBeVisible();
  const mobile = testInfo.project.name.includes("mobile");
  await page.screenshot({
    path: resolve(
      mobile
        ? "docs/design/phase3-admin-control-plane-mobile-implementation.png"
        : "docs/design/phase3-admin-control-plane-implementation.png"
    ),
    fullPage: true
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
});

test("API de administración exige sesión y no filtra configuración", async ({ request }) => {
  const response = await request.get("http://localhost:3100/api/v1/admin/settings");
  expect(response.status()).toBe(401);
  expect(JSON.stringify(await response.json())).not.toMatch(/password|api[_-]?key|secret:\/\//i);
});
