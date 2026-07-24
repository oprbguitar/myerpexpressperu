/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Ejecuta las pruebas de integración FALLANDO EN CERRADO (hallazgo C-4).
 *
 * Antes, `test:integration` salía 0 aunque las 17 pruebas se OMITIERAN por falta
 * de `DATABASE_URL`. Cualquier CI sin esa variable reportaba éxito sin verificar
 * nada. Ahora:
 *
 *   - Si falta `DATABASE_URL` -> FALLA con mensaje claro.
 *   - Solo se permite omitir con `ALLOW_INTEGRATION_TEST_SKIP=true`, y esa vía
 *     está PROHIBIDA cuando `CI=true`.
 *   - Tras ejecutar, verifica que corrió al menos una suite y un número mínimo de
 *     pruebas; si no, falla (guarda de conteo de ejecución, §10.2).
 */

import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const MIN_EXPECTED_TESTS = 15;
const isCi = process.env.CI === "true" || process.env.CI === "1";
const allowSkip = process.env.ALLOW_INTEGRATION_TEST_SKIP === "true";
const hasDatabase = Boolean(process.env.DATABASE_URL);

if (isCi && allowSkip) {
  console.error(
    "ALLOW_INTEGRATION_TEST_SKIP está prohibido en CI. Las pruebas de integración deben ejecutarse."
  );
  process.exit(1);
}

if (!hasDatabase) {
  if (allowSkip) {
    console.error(
      "AVISO: DATABASE_URL ausente y ALLOW_INTEGRATION_TEST_SKIP=true. Se OMITEN las pruebas de integración (solo desarrollo local)."
    );
    process.exit(0);
  }
  console.error(
    "ERROR: DATABASE_URL es obligatorio para las pruebas de integración.\n" +
      "Levante la base (pnpm docker:up && pnpm db:migrate) o, solo en local, use\n" +
      "ALLOW_INTEGRATION_TEST_SKIP=true para omitirlas explícitamente."
  );
  process.exit(1);
}

const reportFile = resolve("dist/test/integration-report.json");
const result = spawnSync(
  process.execPath,
  [
    "--env-file-if-exists=.env",
    "./node_modules/vitest/vitest.mjs",
    "run",
    "tests/integration",
    "--reporter=json",
    `--outputFile=${reportFile}`
  ],
  { stdio: ["inherit", "inherit", "inherit"] }
);

if (result.status !== 0) process.exit(result.status ?? 1);

// Guarda de conteo de ejecución.
let report;
try {
  report = JSON.parse(readFileSync(reportFile, "utf8"));
} catch {
  console.error("No se pudo leer el reporte de integración; se considera fallo de verificación.");
  process.exit(1);
}
rmSync(reportFile, { force: true });

const total = report.numTotalTests ?? 0;
const passed = report.numPassedTests ?? 0;
const skipped = report.numPendingTests ?? 0;
const suites = report.numTotalTestSuites ?? (report.testResults?.length ?? 0);

console.log(`Integración: ${passed} pasadas, ${skipped} omitidas, ${total} totales, ${suites} suites.`);

if (suites === 0 || total < MIN_EXPECTED_TESTS) {
  console.error(
    `Guarda de conteo: se esperaban al menos ${MIN_EXPECTED_TESTS} pruebas de integración y corrieron ${total}. ` +
      "Esto indica que las suites no se ejecutaron realmente."
  );
  process.exit(1);
}
if (skipped > 0 && hasDatabase) {
  console.error(
    `Guarda de conteo: ${skipped} pruebas de integración quedaron omitidas pese a existir DATABASE_URL. ` +
      "Ninguna suite crítica debe omitirse cuando la base está disponible."
  );
  process.exit(1);
}
