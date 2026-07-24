/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Informe de compatibilidad entre las licencias de las dependencias y la
 * licencia del proyecto.
 *
 *   node scripts/license/compatibility.mjs
 *
 * ADVERTENCIA: este informe es una ayuda de ingeniería, no un dictamen
 * legal. Clasifica según reglas declaradas, no evalúa el caso concreto de
 * distribución. La compatibilidad definitiva la determina un abogado.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scanLicenses } from "./scan.mjs";

/**
 * Reglas de compatibilidad frente a un proyecto MPL-2.0 distribuido como
 * software. Solo cubre familias de licencias realmente presentes o
 * plausibles en este árbol.
 */
const COMPATIBILITY = {
  "MPL-2.0": ["compatible", "misma licencia"],
  MIT: ["compatible", "permisiva; puede combinarse en archivos separados"],
  "Apache-2.0": ["compatible", "permisiva con concesión de patentes; MPL-2.0 la admite"],
  ISC: ["compatible", "permisiva equivalente a MIT"],
  "BSD-2-Clause": ["compatible", "permisiva"],
  "BSD-3-Clause": ["compatible", "permisiva con cláusula de no-endoso"],
  "0BSD": ["compatible", "permisiva sin obligación de aviso"],
  "BlueOak-1.0.0": ["compatible", "permisiva aprobada por OSI"],
  "Python-2.0": ["compatible", "permisiva (PSF)"],
  Zlib: ["compatible", "permisiva"],
  "CC0-1.0": ["compatible", "renuncia de derechos; apta para datos"],
  "CC-BY-4.0": [
    "compatible_con_condicion",
    "exige atribución; se cumple mediante THIRD-PARTY-NOTICES.md; solo para datos"
  ],
  PostgreSQL: ["compatible", "permisiva tipo BSD"],
  "Unicode-3.0": ["compatible", "permisiva para datos de Unicode"],
  "LGPL-2.1": ["revisar", "depende de enlace estático o dinámico"],
  "LGPL-3.0": ["revisar", "depende de enlace estático o dinámico"],
  "EPL-2.0": ["revisar", "copyleft débil por archivo; evaluar interacción"],
  "CDDL-1.0": ["revisar", "copyleft débil por archivo"],
  "GPL-2.0": ["incompatible_sin_revision", "copyleft fuerte; contamina la obra combinada"],
  "GPL-3.0": ["incompatible_sin_revision", "copyleft fuerte; contamina la obra combinada"],
  "AGPL-3.0": [
    "incompatible_sin_revision",
    "copyleft fuerte con cláusula de red; obliga a publicar fuente a usuarios remotos"
  ],
  "SSPL-1.0": ["incompatible_sin_revision", "no es software libre según OSI"],
  "BUSL-1.1": ["incompatible_sin_revision", "fuente disponible con restricción temporal"],
  "Elastic-2.0": ["incompatible_sin_revision", "fuente disponible con restricción de uso"]
};

export async function buildCompatibilityReport(repositoryRoot) {
  const scan = await scanLicenses(repositoryRoot);
  const all = [...scan.allowed, ...scan.review, ...scan.prohibited, ...scan.excepted];

  const byLicense = new Map();
  for (const item of all) {
    if (!byLicense.has(item.license)) byLicense.set(item.license, 0);
    byLicense.set(item.license, byLicense.get(item.license) + 1);
  }

  const findings = [];
  for (const [license, count] of byLicense) {
    // Para expresiones compuestas se evalúa cada rama por separado.
    const parts = license.replace(/[()]/g, "").split(/\s+(?:AND|OR)\s+/);
    let verdict = "compatible";
    let rationale = [];
    let known = true;
    for (const part of parts) {
      const entry = COMPATIBILITY[part.trim()];
      if (!entry) {
        known = false;
        continue;
      }
      rationale.push(`${part.trim()}: ${entry[1]}`);
      const order = [
        "compatible",
        "compatible_con_condicion",
        "revisar",
        "incompatible_sin_revision"
      ];
      if (order.indexOf(entry[0]) > order.indexOf(verdict)) verdict = entry[0];
    }
    if (!known && rationale.length === 0) {
      verdict = "desconocida";
      rationale = ["licencia no cubierta por las reglas declaradas"];
    }
    findings.push({ license, packages: count, verdict, rationale: rationale.join("; ") });
  }

  findings.sort((a, b) => b.packages - a.packages);

  return {
    format: "erp-express-peru-license-compatibility",
    version: 1,
    generated_at: new Date().toISOString(),
    project_license: scan.project_license,
    project_license_status: scan.project_license_status,
    disclaimer:
      "Informe de ingeniería basado en reglas declaradas. No constituye asesoría legal " +
      "ni dictamen de compatibilidad para un escenario de distribución concreto.",
    findings,
    blocking: findings.filter(
      (item) => item.verdict === "incompatible_sin_revision" || item.verdict === "desconocida"
    )
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repositoryRoot = resolve(process.env.REPO_ROOT ?? ".");
  const report = await buildCompatibilityReport(repositoryRoot);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Licencia del proyecto: ${report.project_license} (${report.project_license_status})`);
    console.log("");
    for (const item of report.findings) {
      console.log(`${item.verdict.padEnd(26)} ${String(item.packages).padStart(4)}  ${item.license}`);
      console.log(`${" ".repeat(26)}       ${item.rationale}`);
    }
    console.log("");
    console.log(report.disclaimer);
  }

  if (report.blocking.length > 0) process.exitCode = 1;
}
