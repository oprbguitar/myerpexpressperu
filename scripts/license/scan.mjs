/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Clasifica las licencias de las dependencias instaladas contra
 * docs/compliance/LICENSE-MATRIX.yml.
 *
 *   node scripts/license/scan.mjs           informe en terminal
 *   node scripts/license/scan.mjs --json    salida legible por máquina
 *
 * Sale con código 1 si aparece una licencia prohibida, desconocida o que
 * requiere revisión sin excepción aprobada. Ese es el fallo de CI que exige
 * la instrucción de Fase 4.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateLicenseInventory } from "../demo/generate-licenses.mjs";
import { loadLicenseMatrix } from "./policy.mjs";

/**
 * Resuelve una expresión SPDX compuesta a las licencias que la componen,
 * usando las resoluciones declaradas en la matriz.
 */
function resolveExpression(license, matrix) {
  const resolutions = Array.isArray(matrix.compound_resolutions)
    ? matrix.compound_resolutions
    : [];
  const match = resolutions.find((item) => item.expression === license);
  if (!match) return [license];
  return Array.isArray(match.resolve_to) ? match.resolve_to : [match.resolve_to];
}

function classifyOne(licenseId, matrix) {
  const allowed = matrix.allowed.map((item) => item.id);
  const review = (matrix.review ?? []).filter((item) => item.id).map((item) => item.id);
  const reviewPatterns = (matrix.review ?? [])
    .filter((item) => item.pattern)
    .map((item) => item.pattern);
  const prohibited = (matrix.prohibited ?? []).map((item) => item.id);

  if (allowed.includes(licenseId)) return "allowed";
  if (prohibited.includes(licenseId)) return "prohibited";
  if (review.includes(licenseId)) return "review";
  if (reviewPatterns.some((pattern) => licenseId.toLowerCase().includes(pattern.toLowerCase()))) {
    return "review";
  }
  // Cualquier licencia no clasificada explícitamente exige revisión.
  return "review";
}

/** Clasifica un paquete completo, resolviendo expresiones compuestas. */
export function classifyPackage(item, matrix) {
  const parts = resolveExpression(item.license, matrix);
  const verdicts = parts.map((part) => classifyOne(part, matrix));
  if (verdicts.includes("prohibited")) return "prohibited";
  if (verdicts.includes("review")) return "review";
  return "allowed";
}

export async function scanLicenses(repositoryRoot) {
  const matrix = await loadLicenseMatrix(repositoryRoot);
  const inventory = await generateLicenseInventory(
    repositoryRoot,
    resolve(repositoryRoot, "dist/compliance/licenses.json")
  );

  const exceptions = new Set(
    (matrix.exceptions ?? []).map((item) => `${item.package}@${item.version}`)
  );

  const result = {
    format: "erp-express-peru-license-scan",
    version: 1,
    generated_at: new Date().toISOString(),
    project_license: matrix.project_license,
    project_license_status: matrix.project_license_status,
    packages_scanned: inventory.packages.length,
    allowed: [],
    review: [],
    prohibited: [],
    excepted: [],
    by_license: {}
  };

  for (const item of inventory.packages) {
    const key = `${item.name}@${item.version}`;
    result.by_license[item.license] = (result.by_license[item.license] ?? 0) + 1;

    if (exceptions.has(key)) {
      result.excepted.push({ ...item });
      continue;
    }
    const verdict = classifyPackage(item, matrix);
    result[verdict].push({ name: item.name, version: item.version, license: item.license });
  }

  result.compliant = result.prohibited.length === 0 && result.review.length === 0;
  return result;
}

function report(result) {
  console.log(`Licencia del proyecto: ${result.project_license} (${result.project_license_status})`);
  console.log(`Paquetes escaneados:   ${result.packages_scanned}`);
  console.log("");
  console.log("Distribución de licencias:");
  for (const [license, count] of Object.entries(result.by_license).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${license}`);
  }
  console.log("");
  console.log(`Permitidas:            ${result.allowed.length}`);
  console.log(`Requieren revisión:    ${result.review.length}`);
  console.log(`Prohibidas:            ${result.prohibited.length}`);
  console.log(`Con excepción:         ${result.excepted.length}`);

  for (const item of result.review) {
    console.log(`  REVISIÓN  ${item.name}@${item.version} — ${item.license}`);
  }
  for (const item of result.prohibited) {
    console.log(`  PROHIBIDA ${item.name}@${item.version} — ${item.license}`);
  }

  console.log("");
  console.log(result.compliant ? "Resultado: conforme con la política." : "Resultado: NO conforme.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repositoryRoot = resolve(process.env.REPO_ROOT ?? ".");
  const result = await scanLicenses(repositoryRoot);
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else report(result);
  if (!result.compliant) process.exitCode = 1;
}
