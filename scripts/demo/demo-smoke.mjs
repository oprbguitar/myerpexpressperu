/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { createHash } from "node:crypto";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const requiredFiles = [
  "README-DEMO.md",
  "QUICKSTART.md",
  "LICENSE.txt",
  "THIRD-PARTY-NOTICES.txt",
  "docker-compose.demo.yml",
  ".env.demo.example",
  "demo-start.sh",
  "demo-status.sh",
  "demo-reset.sh",
  "demo-stop.sh",
  "demo-start.ps1",
  "demo-status.ps1",
  "demo-reset.ps1",
  "demo-stop.ps1",
  "metadata/sbom.cdx.json",
  "metadata/licenses.json",
  "metadata/version-manifest.json",
  "checksums.sha256"
];

export async function smokeDemoPackage(packageDirectory, archiveFile) {
  for (const relative of requiredFiles) await access(resolve(packageDirectory, relative));
  try {
    await access(resolve(packageDirectory, ".env.demo"));
    throw new Error("El paquete contiene .env.demo.");
  } catch (error) {
    if (error instanceof Error && error.message === "El paquete contiene .env.demo.") throw error;
  }
  if (archiveFile) await access(resolve(archiveFile));

  const sbom = JSON.parse(await readFile(resolve(packageDirectory, "metadata/sbom.cdx.json"), "utf8"));
  if (sbom.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components) || sbom.components.length === 0) {
    throw new Error("SBOM CycloneDX vacío o inválido.");
  }
  const checksumLines = (await readFile(resolve(packageDirectory, "checksums.sha256"), "utf8"))
    .trim().split(/\r?\n/).filter(Boolean);
  for (const line of checksumLines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!match) throw new Error(`Línea de checksum inválida: ${line}`);
    const content = await readFile(resolve(packageDirectory, match[2]));
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== match[1]) throw new Error(`Checksum inválido: ${match[2]}`);
  }

  const template = await readFile(resolve(packageDirectory, ".env.demo.example"), "utf8");
  const generated = ["a".repeat(48), "b".repeat(64), "c".repeat(24), "d".repeat(64), "e".repeat(32)];
  let index = 0;
  const smokeEnvironment = template.replaceAll("__GENERATED__", () => generated[index++] ?? "f".repeat(32));
  const smokeEnvPath = resolve(packageDirectory, ".env.demo");
  await writeFile(smokeEnvPath, smokeEnvironment, { encoding: "utf8", mode: 0o600 });
  let dockerCompose = "skipped-docker-not-available";
  try {
    const version = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
    if (!version.error && version.status === 0) {
      const config = spawnSync(
        "docker",
        ["compose", "--env-file", smokeEnvPath, "-f", resolve(packageDirectory, "docker-compose.demo.yml"), "config", "--quiet"],
        { cwd: packageDirectory, encoding: "utf8" }
      );
      if (config.status !== 0) throw new Error(`docker compose config falló: ${config.stderr || config.stdout}`);
      dockerCompose = "passed";
    }
  } finally {
    await rm(smokeEnvPath, { force: true });
  }
  return {
    requiredFiles: requiredFiles.length,
    checksums: checksumLines.length,
    sbomComponents: sbom.components.length,
    dockerCompose
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const packageDirectory = resolve(process.argv[2] ?? "dist/demo/erp-express-peru-demo-portable-v0.3.0");
  const archive = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const result = await smokeDemoPackage(packageDirectory, archive);
  console.log(`Smoke demo aprobado: ${JSON.stringify(result)}`);
}
