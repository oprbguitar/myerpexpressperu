/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function generateSbom(repositoryRoot, outputFile) {
  await mkdir(dirname(outputFile), { recursive: true });
  const lock = await readFile(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8");
  const snapshotStart = lock.indexOf("\nsnapshots:\n");
  const snapshotText = snapshotStart >= 0 ? lock.slice(snapshotStart + 12) : lock;
  const components = new Map();
  for (const line of snapshotText.split(/\r?\n/)) {
    if (!line.startsWith("  ") || line.startsWith("    ")) continue;
    // pnpm escribe los paquetes sin dependencias como "'pkg@1.0.0': {}" y
    // los que sí tienen como "'pkg@1.0.0':". Ambas formas son componentes.
    // Aceptar solo la segunda omitía silenciosamente los paquetes hoja.
    const trimmedEnd = line.trimEnd();
    let entry;
    if (trimmedEnd.endsWith(":")) entry = trimmedEnd.trim().slice(0, -1);
    else if (trimmedEnd.endsWith(": {}")) entry = trimmedEnd.trim().slice(0, -4);
    else continue;
    let key = entry;
    if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith("\"") && key.endsWith("\""))) {
      key = key.slice(1, -1);
    }
    // pnpm anexa las dependencias de pares entre paréntesis, por ejemplo
    // "@apideck/better-ajv-errors@0.3.7(ajv@8.20.0)". Ese sufijo debe
    // eliminarse ANTES de buscar el separador de versión: si no, el último
    // "@" encontrado es el de la dependencia de pares y tanto el nombre
    // como la versión quedan corruptos.
    const parenthesis = key.indexOf("(");
    const bare = parenthesis >= 0 ? key.slice(0, parenthesis) : key;
    const at = bare.lastIndexOf("@");
    if (at <= 0) continue;
    const name = bare.slice(0, at);
    const version = bare.slice(at + 1);
    if (!name || !version || version.startsWith("link:") || version.startsWith("workspace:")) continue;
    components.set(`${name}@${version}`, {
      type: "library",
      name,
      version,
      purl: `pkg:npm/${encodeURIComponent(name).replace("%2F", "/")}@${encodeURIComponent(version)}`
    });
  }
  const digest = createHash("sha256").update(lock).digest("hex");
  const serial = [
    digest.slice(0, 8), digest.slice(8, 12), `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`, digest.slice(20, 32)
  ].join("-");
  const bom = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${serial}`,
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: "erp-express-peru-demo",
        version: "0.3.0"
      },
      properties: [
        { name: "erp.demo.source-lock-sha256", value: digest },
        { name: "erp.demo.data", value: "synthetic-only" }
      ]
    },
    components: [...components.values()].sort((left, right) =>
      `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`)
    )
  };
  await writeFile(outputFile, `${JSON.stringify(bom, null, 2)}\n`, "utf8");
  return bom;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repositoryRoot = resolve(process.argv[2] ?? ".");
  const output = resolve(process.argv[3] ?? "dist/demo/sbom.cdx.json");
  await generateSbom(repositoryRoot, output);
  console.log(`SBOM CycloneDX generado: ${output}`);
}
