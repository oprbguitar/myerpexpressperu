/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Genera THIRD-PARTY-NOTICES.md a partir de los manifiestos realmente
 * instalados. Cumple la obligación de atribución de las dependencias
 * permisivas y de CC-BY-4.0.
 *
 *   node scripts/license/notices.mjs
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scanLicenses } from "./scan.mjs";
import { loadOwnership } from "./policy.mjs";

export async function generateNotices(repositoryRoot, outputFile) {
  const scan = await scanLicenses(repositoryRoot);
  const ownership = await loadOwnership(repositoryRoot);

  const all = [...scan.allowed, ...scan.review, ...scan.prohibited, ...scan.excepted].sort(
    (left, right) => left.name.localeCompare(right.name)
  );

  const grouped = new Map();
  for (const item of all) {
    if (!grouped.has(item.license)) grouped.set(item.license, []);
    grouped.get(item.license).push(item);
  }

  const lines = [];
  lines.push("# Avisos de software de terceros");
  lines.push("");
  lines.push("ERP Express Perú incorpora software de terceros. Este archivo preserva");
  lines.push("sus avisos de licencia. **Las licencias de terceros no son sustituidas**");
  lines.push(`por la licencia del proyecto (${ownership.license?.default ?? "MPL-2.0"}).`);
  lines.push("");
  lines.push("> Generado automáticamente por `pnpm license:notices` a partir de los");
  lines.push("> manifiestos instalados. No editar a mano.");
  lines.push("");
  lines.push(`- **Generado:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`- **Paquetes:** ${all.length}`);
  lines.push(`- **Licencias distintas:** ${grouped.size}`);
  lines.push("");
  lines.push("## Resumen");
  lines.push("");
  lines.push("| Licencia | Paquetes |");
  lines.push("| --- | --- |");
  for (const [license, items] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`| \`${license}\` | ${items.length} |`);
  }
  lines.push("");

  // Atribución explícita para licencias que la exigen.
  const attribution = all.filter((item) => item.license.includes("CC-BY"));
  if (attribution.length > 0) {
    lines.push("## Atribución requerida");
    lines.push("");
    lines.push("Los siguientes componentes se distribuyen bajo licencias que obligan a");
    lines.push("dar atribución. Esta sección cumple esa obligación.");
    lines.push("");
    for (const item of attribution) {
      lines.push(`- **${item.name}** ${item.version} — \`${item.license}\``);
    }
    lines.push("");
  }

  lines.push("## Detalle por licencia");
  lines.push("");
  for (const [license, items] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${license}`);
    lines.push("");
    for (const item of items) {
      lines.push(`- ${item.name}@${item.version}`);
    }
    lines.push("");
  }

  await writeFile(outputFile, `${lines.join("\n")}\n`, "utf8");
  return { packages: all.length, licenses: grouped.size, outputFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repositoryRoot = resolve(process.env.REPO_ROOT ?? ".");
  const output = resolve(repositoryRoot, process.argv[2] ?? "THIRD-PARTY-NOTICES.md");
  const result = await generateNotices(repositoryRoot, output);
  console.log(
    `Avisos generados: ${result.outputFile} (${result.packages} paquetes, ${result.licenses} licencias)`
  );
}
