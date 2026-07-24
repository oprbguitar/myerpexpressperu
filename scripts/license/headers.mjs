/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Verifica —y opcionalmente aplica— los encabezados SPDX en los archivos
 * fuente originales del proyecto.
 *
 *   node scripts/license/headers.mjs            verifica y falla si falta alguno
 *   node scripts/license/headers.mjs --apply    inserta los que falten
 *   node scripts/license/headers.mjs --json     salida legible por máquina
 *
 * No modifica archivos de terceros ni elimina avisos de copyright ajenos.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import {
  COMMENT_STYLES,
  buildHeader,
  collectSourceFiles,
  hasForeignCopyright,
  hasSpdxIdentifier,
  insertHeader,
  loadOwnership
} from "./policy.mjs";

/** Resuelve la licencia aplicable a una ruta según el mapa de OWNERSHIP.yml. */
function licenseForPath(relativePath, ownership) {
  const map = Array.isArray(ownership.license_map) ? ownership.license_map : [];
  let best = null;
  for (const entry of map) {
    if (typeof entry?.path !== "string") continue;
    if (relativePath === entry.path || relativePath.startsWith(`${entry.path}/`)) {
      if (!best || entry.path.length > best.path.length) best = entry;
    }
  }
  if (!best) return ownership.license?.default ?? "MPL-2.0";
  // Rutas especiales que no llevan encabezado insertado.
  if (best.license === "UPSTREAM" || best.license === "MANIFEST") return null;
  return best.license;
}

export async function checkHeaders(repositoryRoot, { apply = false } = {}) {
  const ownership = await loadOwnership(repositoryRoot);
  const holder = ownership.copyright.holder;
  const year = ownership.copyright.year ?? new Date().getFullYear();

  const files = await collectSourceFiles(repositoryRoot);
  const result = {
    format: "erp-express-peru-spdx-header-report",
    version: 1,
    generated_at: new Date().toISOString(),
    holder,
    holder_status: ownership.copyright.status ?? "unknown",
    scanned: files.length,
    compliant: [],
    missing: [],
    applied: [],
    skipped_foreign_copyright: [],
    skipped_by_policy: []
  };

  for (const relativePath of files) {
    const licenseId = licenseForPath(relativePath, ownership);
    if (licenseId === null) {
      result.skipped_by_policy.push(relativePath);
      continue;
    }

    const absolute = resolve(repositoryRoot, relativePath);
    const contents = await readFile(absolute, "utf8");

    if (hasSpdxIdentifier(contents)) {
      result.compliant.push(relativePath);
      continue;
    }
    if (hasForeignCopyright(contents, holder)) {
      // Nunca se sobrescribe ni elimina un aviso de copyright de terceros.
      result.skipped_foreign_copyright.push(relativePath);
      continue;
    }

    result.missing.push(relativePath);

    if (apply) {
      const style = COMMENT_STYLES[extname(relativePath).toLowerCase()];
      const header = buildHeader(style, holder, year, licenseId);
      await writeFile(absolute, insertHeader(contents, header), "utf8");
      result.applied.push(relativePath);
    }
  }

  return result;
}

function report(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Titular: ${result.holder} (estado: ${result.holder_status})`);
  console.log(`Archivos inspeccionados: ${result.scanned}`);
  console.log(`Con encabezado SPDX:     ${result.compliant.length}`);
  console.log(`Sin encabezado SPDX:     ${result.missing.length}`);
  if (result.applied.length > 0) {
    console.log(`Encabezados aplicados:   ${result.applied.length}`);
  }
  if (result.skipped_foreign_copyright.length > 0) {
    console.log(
      `Omitidos por aviso de terceros: ${result.skipped_foreign_copyright.length}`
    );
    for (const file of result.skipped_foreign_copyright) console.log(`   - ${file}`);
  }
  if (result.skipped_by_policy.length > 0) {
    console.log(`Omitidos por política: ${result.skipped_by_policy.length}`);
  }
  if (result.missing.length > 0 && result.applied.length === 0) {
    console.log("");
    console.log("Archivos sin identificación de licencia:");
    for (const file of result.missing) console.log(`   - ${file}`);
    console.log("");
    console.log("Ejecute `pnpm license:headers:apply` para insertarlos.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const apply = process.argv.includes("--apply");
  const asJson = process.argv.includes("--json");
  const repositoryRoot = resolve(process.env.REPO_ROOT ?? ".");

  const result = await checkHeaders(repositoryRoot, { apply });
  report(result, asJson);

  // En modo verificación, la ausencia de encabezados es un fallo de CI.
  const unresolved = result.missing.length - result.applied.length;
  if (unresolved > 0) process.exitCode = 1;
}
