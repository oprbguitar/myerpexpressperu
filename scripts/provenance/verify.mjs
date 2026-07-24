/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

/**
 * Valida los registros de procedencia de desarrollo asistido por IA contra
 * la política declarada en docs/compliance/AI-PROVENANCE.yml.
 *
 *   node scripts/provenance/verify.mjs           informe en terminal
 *   node scripts/provenance/verify.mjs --json    salida legible por máquina
 *   node scripts/provenance/verify.mjs --strict  falla si algo está sin aceptar
 *
 * Por defecto, un registro sin aceptar NO es un error: es el estado normal
 * mientras espera revisión humana. Se reporta, pero no rompe la construcción.
 * Con --strict sí falla, para usarse como puerta previa a una release.
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

const RECORDS_DIRECTORY = "docs/compliance/ai-provenance";
const POLICY_FILE = "docs/compliance/AI-PROVENANCE.yml";

export async function verifyProvenance(repositoryRoot) {
  const policy = parse(await readFile(resolve(repositoryRoot, POLICY_FILE), "utf8"));
  const required = policy.required_fields ?? [];

  const directory = resolve(repositoryRoot, RECORDS_DIRECTORY);
  let files = [];
  try {
    files = (await readdir(directory)).filter((name) => /\.ya?ml$/i.test(name)).sort();
  } catch {
    files = [];
  }

  const result = {
    format: "erp-express-peru-provenance-verification",
    version: 1,
    generated_at: new Date().toISOString(),
    records_found: files.length,
    valid: [],
    invalid: [],
    accepted: [],
    awaiting_human_review: [],
    errors: []
  };

  const seenIds = new Set();

  for (const name of files) {
    const path = `${RECORDS_DIRECTORY}/${name}`;
    let record;
    try {
      record = parse(await readFile(join(directory, name), "utf8"));
    } catch (error) {
      result.errors.push({ file: path, problem: `no se pudo interpretar: ${error.message}` });
      result.invalid.push(path);
      continue;
    }

    const problems = [];

    for (const field of required) {
      if (!(field in record)) problems.push(`falta el campo obligatorio '${field}'`);
    }

    if (record.provenance_id) {
      if (seenIds.has(record.provenance_id)) {
        problems.push(`provenance_id duplicado: ${record.provenance_id}`);
      }
      seenIds.add(record.provenance_id);
    }

    // Control de integridad del revisor: no se admite aceptar sin revisor.
    const reviewer = record.human_reviewer;
    const hasRealReviewer =
      typeof reviewer === "string" && reviewer.trim() !== "" && reviewer !== "pending";

    if (record.accepted === true && !hasRealReviewer) {
      problems.push(
        "accepted: true sin human_reviewer verificado — un cambio no puede aceptarse sin revisión humana"
      );
    }
    if (record.accepted === true && !record.review_date) {
      problems.push("accepted: true sin review_date");
    }

    if (problems.length > 0) {
      result.invalid.push(path);
      result.errors.push({ file: path, id: record.provenance_id ?? null, problems });
    } else {
      result.valid.push(path);
    }

    if (record.accepted === true) result.accepted.push(record.provenance_id ?? path);
    else result.awaiting_human_review.push(record.provenance_id ?? path);
  }

  result.structurally_valid = result.invalid.length === 0;
  result.all_accepted =
    result.records_found > 0 && result.awaiting_human_review.length === 0;
  return result;
}

function report(result) {
  console.log(`Registros de procedencia: ${result.records_found}`);
  console.log(`Estructuralmente válidos: ${result.valid.length}`);
  console.log(`Inválidos:                ${result.invalid.length}`);
  console.log(`Aceptados:                ${result.accepted.length}`);
  console.log(`Pendientes de revisión:   ${result.awaiting_human_review.length}`);

  for (const error of result.errors) {
    console.log("");
    console.log(`  ${error.file}`);
    for (const problem of error.problems ?? [error.problem]) console.log(`     - ${problem}`);
  }

  if (result.awaiting_human_review.length > 0) {
    console.log("");
    console.log("Pendientes de revisión humana:");
    for (const id of result.awaiting_human_review) console.log(`   - ${id}`);
    console.log("");
    console.log("Ningún cambio asistido por IA se considera aceptado hasta que");
    console.log("una persona lo revise y lo registre explícitamente.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repositoryRoot = resolve(process.env.REPO_ROOT ?? ".");
  const result = await verifyProvenance(repositoryRoot);

  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else report(result);

  if (!result.structurally_valid) process.exitCode = 1;
  if (process.argv.includes("--strict") && !result.all_accepted) process.exitCode = 1;
}
