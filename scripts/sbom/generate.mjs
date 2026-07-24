/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Genera el SBOM CycloneDX del proyecto completo, enriquecido con la
 * licencia de cada componente tomada de los manifiestos instalados.
 *
 *   node scripts/sbom/generate.mjs [salida]
 *
 * Se distingue del SBOM del paquete demo (scripts/demo/generate-sbom.mjs),
 * que describe únicamente el artefacto portable.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateSbom } from "../demo/generate-sbom.mjs";
import { generateLicenseInventory } from "../demo/generate-licenses.mjs";
import { loadOwnership } from "../license/policy.mjs";

export async function generateProjectSbom(repositoryRoot, outputFile) {
  await mkdir(dirname(outputFile), { recursive: true });

  const manifest = JSON.parse(
    await readFile(resolve(repositoryRoot, "package.json"), "utf8")
  );
  const ownership = await loadOwnership(repositoryRoot);

  // Componentes desde el archivo de bloqueo (fuente de verdad de versiones).
  const base = await generateSbom(repositoryRoot, resolve(repositoryRoot, "dist/compliance/.sbom-base.json"));

  // Licencias desde los manifiestos realmente instalados.
  const inventory = await generateLicenseInventory(
    repositoryRoot,
    resolve(repositoryRoot, "dist/compliance/licenses.json")
  );
  const licenseByKey = new Map(
    inventory.packages.map((item) => [`${item.name}@${item.version}`, item.license])
  );

  let withLicense = 0;
  const components = base.components.map((component) => {
    const license = licenseByKey.get(`${component.name}@${component.version}`);
    if (!license || license === "UNKNOWN") return component;
    withLicense += 1;
    // Las expresiones compuestas usan 'expression'; los identificadores
    // simples usan 'license.id', conforme a CycloneDX.
    const licenses = license.includes(" AND ") || license.includes(" OR ")
      ? [{ expression: license.replace(/^\(|\)$/g, "") }]
      : [{ license: { id: license } }];
    return { ...component, licenses };
  });

  const lock = await readFile(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8");
  const digest = createHash("sha256").update(lock).digest("hex");

  const bom = {
    ...base,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: "application",
        name: manifest.name,
        version: manifest.version,
        licenses: [{ license: { id: ownership.license?.default ?? "MPL-2.0" } }]
      },
      properties: [
        { name: "erp.lockfile.sha256", value: digest },
        { name: "erp.copyright.holder", value: ownership.copyright.holder },
        { name: "erp.copyright.status", value: String(ownership.copyright.status) },
        { name: "erp.license.status", value: String(ownership.license?.status) },
        { name: "erp.components.total", value: String(components.length) },
        { name: "erp.components.with-license", value: String(withLicense) }
      ]
    },
    components
  };

  await writeFile(outputFile, `${JSON.stringify(bom, null, 2)}\n`, "utf8");
  return { bom, total: components.length, withLicense };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repositoryRoot = resolve(process.env.REPO_ROOT ?? ".");
  const output = resolve(repositoryRoot, process.argv[2] ?? "dist/compliance/sbom.cdx.json");
  const result = await generateProjectSbom(repositoryRoot, output);
  console.log(
    `SBOM del proyecto generado: ${output} ` +
      `(${result.total} componentes, ${result.withLicense} con licencia declarada)`
  );
}
