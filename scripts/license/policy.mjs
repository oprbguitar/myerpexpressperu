/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Carga compartida de la política de licenciamiento y utilidades de recorrido
 * de archivos. Lo usan headers.mjs, scan.mjs y notices.mjs para no duplicar la
 * lectura de OWNERSHIP.yml ni las reglas de exclusión.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";

/** Directorios que nunca se inspeccionan, sin importar la configuración. */
const HARD_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dev-dist",
  "coverage",
  "test-results",
  "playwright-report",
  "output",
  "data"
]);

/**
 * Estilos de comentario por extensión. Determina cómo se escribe el encabezado
 * SPDX en cada tipo de archivo.
 */
export const COMMENT_STYLES = {
  ".ts": "block",
  ".tsx": "block",
  ".js": "block",
  ".jsx": "block",
  ".mjs": "block",
  ".cjs": "block",
  ".css": "block",
  ".sql": "sql",
  ".yml": "hash",
  ".yaml": "hash",
  ".sh": "hash",
  ".mts": "block",
  ".cts": "block"
};

export async function loadOwnership(repositoryRoot) {
  const file = resolve(repositoryRoot, "docs/legal/OWNERSHIP.yml");
  const parsed = parse(await readFile(file, "utf8"));
  if (!parsed?.copyright?.holder) {
    throw new Error(`OWNERSHIP.yml no declara copyright.holder: ${file}`);
  }
  return parsed;
}

export async function loadLicenseMatrix(repositoryRoot) {
  const file = resolve(repositoryRoot, "docs/compliance/LICENSE-MATRIX.yml");
  const parsed = parse(await readFile(file, "utf8"));
  if (!Array.isArray(parsed?.allowed)) {
    throw new Error(`LICENSE-MATRIX.yml no declara una lista 'allowed': ${file}`);
  }
  return parsed;
}

/**
 * Recorre el repositorio devolviendo rutas relativas de archivos cuya
 * extensión tiene un estilo de comentario conocido.
 */
export async function collectSourceFiles(repositoryRoot, extraExcludedDirs = []) {
  const excluded = new Set([...HARD_EXCLUDED_DIRS, ...extraExcludedDirs]);
  const found = [];

  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (excluded.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const dot = entry.name.lastIndexOf(".");
      if (dot <= 0) continue;
      const extension = entry.name.slice(dot).toLowerCase();
      if (!(extension in COMMENT_STYLES)) continue;
      found.push(relative(repositoryRoot, full).split(sep).join("/"));
    }
  }

  await walk(resolve(repositoryRoot));
  return found.sort();
}

/** Construye el texto del encabezado SPDX para un estilo de comentario dado. */
export function buildHeader(style, holder, year, licenseId) {
  const copyright = `SPDX-FileCopyrightText: ${year} ${holder}`;
  const identifier = `SPDX-License-Identifier: ${licenseId}`;
  const provenance = "Registros de asistencia de IA, cuando corresponda:";
  const provenancePath = "docs/compliance/ai-provenance/";

  if (style === "block") {
    return [
      "/*",
      ` * ${copyright}`,
      ` * ${identifier}`,
      " *",
      ` * ${provenance}`,
      ` * ${provenancePath}`,
      " */",
      ""
    ].join("\n");
  }
  if (style === "sql") {
    return [`-- ${copyright}`, `-- ${identifier}`, ""].join("\n");
  }
  return [`# ${copyright}`, `# ${identifier}`, ""].join("\n");
}

/** True si el archivo ya declara un identificador SPDX de licencia. */
export function hasSpdxIdentifier(contents) {
  return /SPDX-License-Identifier:\s*\S+/.test(contents.slice(0, 4000));
}

/**
 * True si el archivo contiene un aviso de copyright que no es el nuestro.
 * Esos archivos se omiten: la política prohíbe eliminar avisos de terceros.
 */
export function hasForeignCopyright(contents, holder) {
  const head = contents.slice(0, 4000);
  const matches = head.match(/(?:^|\s)(?:Copyright|\(c\)|©)\s+.{0,120}/gim);
  if (!matches) return false;
  return matches.some((line) => !line.includes(holder));
}

/**
 * Inserta el encabezado respetando shebang y la directiva "use strict".
 */
export function insertHeader(contents, header) {
  const lines = contents.split("\n");
  let insertAt = 0;
  if (lines[0]?.startsWith("#!")) insertAt = 1;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  // Evita dejar una línea en blanco doble tras el encabezado.
  while (after.length > 0 && after[0].trim() === "") after.shift();
  return [...before, header + after.join("\n")].join("\n");
}
