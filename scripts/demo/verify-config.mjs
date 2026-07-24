/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function requireText(content, expected, source) {
  if (!content.includes(expected)) throw new Error(`${source}: falta ${expected}`);
}

export async function verifyDemoConfiguration(repositoryRoot) {
  const demoDir = resolve(repositoryRoot, "deployment/demo");
  const [template, compose, profile, entry] = await Promise.all([
    readFile(resolve(demoDir, ".env.demo.example"), "utf8"),
    readFile(resolve(demoDir, "docker-compose.demo.yml"), "utf8"),
    readFile(resolve(demoDir, "demo-profile.json"), "utf8"),
    readFile(resolve(demoDir, "demo-entry.html"), "utf8")
  ]);
  const markers = template.match(/__GENERATED__/g) ?? [];
  if (markers.length !== 7) throw new Error(`Se esperaban 7 secretos generados; se encontraron ${markers.length}.`);
  for (const expected of [
    "APP_ENVIRONMENT=demo",
    "DEMO_RESET_ENABLED=true",
    "DEMO_DATABASE_NAME=erp_express_demo",
    "DEMO_DB_RUNTIME_USER=erp_demo_runtime",
    "DEMO_DB_RESET_USER=erp_demo_reset",
    "AI_ENABLED=false",
    "AI_PROVIDER=none",
    "ELECTRONIC_INVOICING_PROVIDER=mock",
    "DIGITAL_SIGNATURE_PROVIDER=disabled"
  ]) requireText(template, expected, ".env.demo.example");
  for (const expected of [
    "127.0.0.1:${DEMO_WEB_PORT",
    "127.0.0.1:${DEMO_API_PORT",
    "profiles: [tools]",
    "packages/database/dist/phase3/demo-seed.js",
    "APP_ENVIRONMENT: ${APP_ENVIRONMENT}",
    "DEMO_RESET_ENABLED: ${DEMO_RESET_ENABLED}"
  ]) requireText(compose, expected, "docker-compose.demo.yml");
  requireText(compose, "grant set on parameter session_replication_role to erp_demo_reset", "docker-compose.demo.yml");
  requireText(compose, "mc rm --recursive --force demo/erp-demo-private", "docker-compose.demo.yml");
  if (compose.includes("mc rm --recursive --force demo/erp-demo-private || true")) {
    throw new Error("storage-reset no puede ignorar errores de borrado.");
  }
  const parsedProfile = JSON.parse(profile);
  if (parsedProfile.environment !== "demo" || parsedProfile.providers.ai !== "disabled") {
    throw new Error("demo-profile.json no conserva el perfil local seguro.");
  }
  for (const forbidden of ["Guaranteed legal compliance", "Guaranteed tax compliance", "Official SUNAT certification"]) {
    if (entry.includes(forbidden)) throw new Error(`Afirmación prohibida en demo-entry.html: ${forbidden}`);
  }
  requireText(entry, "No apto para producción", "demo-entry.html");
  requireText(entry, "DATOS COMPLETAMENTE FICTICIOS", "demo-entry.html");
  return { generatedSecretMarkers: markers.length, environment: parsedProfile.environment };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyDemoConfiguration(resolve(process.argv[2] ?? "."));
  console.log(`Configuración demo verificada: ${JSON.stringify(result)}`);
}
