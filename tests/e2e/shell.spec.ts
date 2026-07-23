import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(process.env.SEED_ADMIN_EMAIL ?? "");
  await page.getByLabel("Contraseña").fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Resumen operativo" })).toBeVisible();
}

test("login es accesible y no desborda", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("manifiesto PWA está disponible", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  expect((await response.json()).name).toBe("ERP Express Perú");
});

test("dashboard operativo usa datos del servidor y navega a ventas", async ({ page }, testInfo) => {
  await login(page);
  await expect(page.getByText("Ventas del mes")).toBeVisible();
  await expect(page.getByText("Estado SUNAT")).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
  }
  await page.getByRole("link", { name: "Ventas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ventas" })).toBeVisible();
});

test("flujo móvil no desborda y abre una venta rápida", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Validación específica para viewport móvil.");
  await login(page);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Ventas", exact: true }).click();
  await page.getByRole("button", { name: "Venta rápida" }).click();
  await expect(page.getByRole("heading", { name: "Nueva venta" })).toBeVisible();
  await page.screenshot({
    path: resolve("docs/design/phase2-quick-sale-mobile-implementation.png"),
    fullPage: true
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("genera y almacena un PDF operativo autorizado", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Una ejecución basta para validar almacenamiento PDF.");
  await login(page);
  const generated = await page.evaluate(async () => {
    const salesResponse = await fetch("http://localhost:3100/api/v1/sales?limit=1", { credentials: "include" });
    const sales = await salesResponse.json() as Array<{ id: string }>;
    if (!sales[0]) throw new Error("No existe una venta de demostración para generar el PDF.");
    const response = await fetch(`http://localhost:3100/api/v1/pdf/sale/${sales[0].id}`, {
      method: "POST", credentials: "include"
    });
    if (!response.ok) throw new Error(`PDF API ${response.status}`);
    return response.json() as Promise<{ url: string; filename: string }>;
  });
  expect(generated.filename).toMatch(/\.pdf$/);
  const download = await request.get(generated.url);
  expect(download.ok()).toBe(true);
  expect(download.headers()["content-type"]).toContain("application/pdf");
  expect((await download.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("confirmación concurrente es idempotente y la venta puede cancelarse", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Una ejecución basta para validar concurrencia.");
  await login(page);
  const result = await page.evaluate(async () => {
    const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`http://localhost:3100/api/v1${path}`, {
        ...init, credentials: "include",
        headers: { ...(init?.body === undefined ? {} : { "content-type": "application/json" }), ...init?.headers }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(payload)}`);
      return payload as T;
    };
    const [customers, items] = await Promise.all([
      api<{ data: Array<{ id: string }> }>("/customers?limit=1"),
      api<{ data: Array<{ id: string; itemType: string }> }>("/items?limit=100")
    ]);
    const service = items.data.find((item) => item.itemType === "SERVICE");
    if (!customers.data[0] || !service) throw new Error("La semilla requiere cliente y servicio.");
    const sale = await api<{ id: string }>("/sales", {
      method: "POST", body: JSON.stringify({
        customerPartyId: customers.data[0].id, paymentCondition: "CASH", currency: "PEN",
        lines: [{ itemId: service.id, quantity: "1", discountRate: "0" }]
      })
    });
    const key = `e2e-confirm:${crypto.randomUUID()}`;
    const confirm = () => api<{ id: string; status: string }>(`/sales/${sale.id}/confirm`, {
      method: "POST", headers: { "idempotency-key": key }
    });
    const [left, right] = await Promise.all([confirm(), confirm()]);
    const cancelled = await api<{ status: string }>(`/sales/${sale.id}/cancel`, {
      method: "POST", headers: { "idempotency-key": `e2e-cancel:${crypto.randomUUID()}` },
      body: JSON.stringify({ reason: "Cancelación controlada por prueba E2E" })
    });
    return { left, right, cancelled };
  });
  expect(result.left).toEqual(result.right);
  expect(result.left.status).toBe("CONFIRMED");
  expect(result.cancelled.status).toBe("CANCELLED");
});
