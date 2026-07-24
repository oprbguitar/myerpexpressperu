/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { createHash } from "node:crypto";
import {
  chmod, cp, mkdir, readFile, readdir, rm, stat, writeFile
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDemoSecrets } from "./check-secrets.mjs";
import { smokeDemoPackage } from "./demo-smoke.mjs";
import { generateLicenseInventory } from "./generate-licenses.mjs";
import { generateSbom } from "./generate-sbom.mjs";
import { verifyDemoConfiguration } from "./verify-config.mjs";

const version = "0.3.0";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const outputRoot = resolve(repositoryRoot, "dist/demo");
const packageName = `erp-express-peru-demo-portable-v${version}`;
const packageDirectory = resolve(outputRoot, packageName);
const archiveFile = resolve(outputRoot, `erp-express-peru-demo-v${version}.zip`);

function assertInsideOutput(path) {
  const outputPrefix = `${outputRoot}${sep}`;
  if (path !== outputRoot && !path.startsWith(outputPrefix)) {
    throw new Error(`Ruta de salida demo fuera del límite permitido: ${path}`);
  }
}

function includeSource(source) {
  const name = basename(source);
  return !["node_modules", "dist", "dev-dist", "test-results", ".env", ".env.demo", ".git"].includes(name)
    && !name.endsWith(".tsbuildinfo");
}

async function copySource(relativePath) {
  const source = resolve(repositoryRoot, relativePath);
  const destination = resolve(packageDirectory, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, filter: includeSource, preserveTimestamps: false });
}

async function listFiles(root, cursor = root) {
  const files = [];
  for (const entry of await readdir(cursor, { withFileTypes: true })) {
    const absolute = join(cursor, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else if (entry.isFile()) files.push({ absolute, relative: relative(root, absolute).replaceAll("\\", "/") });
  }
  return files;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, data, checksum) {
  const nameBuffer = Buffer.from(name);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  return Buffer.concat([header, nameBuffer, data]);
}

function centralHeader(name, data, checksum, offset, executable) {
  const nameBuffer = Buffer.from(name);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x21, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(nameBuffer.length, 28);
  header.writeUInt32LE(((executable ? 0o100755 : 0o100644) << 16) >>> 0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, nameBuffer]);
}

async function createZip(sourceDirectory, destination) {
  const files = (await listFiles(sourceDirectory)).sort((left, right) => left.relative.localeCompare(right.relative));
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const data = await readFile(file.absolute);
    const name = `${basename(sourceDirectory)}/${file.relative}`;
    const checksum = crc32(data);
    const local = localHeader(name, data, checksum);
    localParts.push(local);
    centralParts.push(centralHeader(name, data, checksum, offset, file.relative.endsWith(".sh")));
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(destination, Buffer.concat([...localParts, central, end]));
}

async function writeChecksums() {
  const files = (await listFiles(packageDirectory))
    .filter((file) => file.relative !== "checksums.sha256")
    .sort((left, right) => left.relative.localeCompare(right.relative));
  const lines = [];
  for (const file of files) {
    const digest = createHash("sha256").update(await readFile(file.absolute)).digest("hex");
    lines.push(`${digest}  ${file.relative}`);
  }
  await writeFile(resolve(packageDirectory, "checksums.sha256"), `${lines.join("\n")}\n`, "utf8");
  return lines.length;
}

async function main() {
  assertInsideOutput(packageDirectory);
  assertInsideOutput(archiveFile);
  await verifyDemoConfiguration(repositoryRoot);
  await checkDemoSecrets(repositoryRoot);
  await mkdir(outputRoot, { recursive: true });
  await rm(packageDirectory, { recursive: true, force: true });
  await rm(archiveFile, { force: true });
  await mkdir(packageDirectory, { recursive: true });

  for (const file of [
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json", ".dockerignore"
  ]) await copySource(file);
  for (const directory of ["apps/api", "apps/web", "apps/worker", "packages", "migrations", "scripts/demo"]) {
    await copySource(directory);
  }
  for (const file of [
    "deployment/demo/runtime.Dockerfile",
    "deployment/demo/web.Dockerfile",
    "deployment/demo/demo-nginx.conf",
    "deployment/demo/demo-entry.html",
    "deployment/demo/demo-profile.json"
  ]) await copySource(file);

  const demoDirectory = resolve(repositoryRoot, "deployment/demo");
  const directCopies = [
    ["README-DEMO.md", "README-DEMO.md"],
    ["QUICKSTART.md", "QUICKSTART.md"],
    ["LICENSE.txt", "LICENSE.txt"],
    ["THIRD-PARTY-NOTICES.txt", "THIRD-PARTY-NOTICES.txt"],
    [".env.demo.example", ".env.demo.example"]
  ];
  for (const [sourceName, destinationName] of directCopies) {
    await cp(resolve(demoDirectory, sourceName), resolve(packageDirectory, destinationName));
  }
  const compose = (await readFile(resolve(demoDirectory, "docker-compose.demo.yml"), "utf8"))
    .replaceAll("context: ../..", "context: .");
  await writeFile(resolve(packageDirectory, "docker-compose.demo.yml"), compose, "utf8");
  for (const name of [
    "demo-start.sh", "demo-status.sh", "demo-health.sh", "demo-reset.sh", "demo-stop.sh",
    "demo-start.ps1", "demo-status.ps1", "demo-health.ps1", "demo-reset.ps1", "demo-stop.ps1"
  ]) {
    const destination = resolve(packageDirectory, name);
    await cp(resolve(repositoryRoot, "scripts/demo", name), destination);
    if (name.endsWith(".sh")) await chmod(destination, 0o755);
  }
  await cp(resolve(repositoryRoot, "scripts/demo/scenarios.json"), resolve(packageDirectory, "scenarios.json"));

  const metadataDirectory = resolve(packageDirectory, "metadata");
  await mkdir(metadataDirectory, { recursive: true });
  const sbom = await generateSbom(repositoryRoot, resolve(metadataDirectory, "sbom.cdx.json"));
  const licenses = await generateLicenseInventory(repositoryRoot, resolve(metadataDirectory, "licenses.json"));
  const manifest = {
    format: "erp-express-peru-demo-version-manifest",
    version: 1,
    applicationVersion: version,
    packageName,
    environment: "demo",
    sourceDateEpoch: Number(process.env.SOURCE_DATE_EPOCH ?? 0),
    databaseMigrations: "0001..0010",
    scenarios: ["A", "B", "C"],
    providers: {
      electronicInvoicing: "mock",
      email: "local-disabled",
      ai: "disabled",
      ocr: "mock",
      geocoding: "manual",
      digitalSignature: "disabled"
    },
    sbomComponents: sbom.components.length,
    licensePackages: licenses.packages.length,
    dockerImages: [
      "node:24-alpine",
      "nginx:1.29-alpine",
      "postgres:17-alpine",
      "minio/minio:RELEASE.2025-07-23T15-54-02Z",
      "minio/mc:RELEASE.2025-07-21T05-28-08Z"
    ],
    dataClassification: "synthetic-demo-only",
    productionSuitable: false
  };
  await writeFile(resolve(metadataDirectory, "version-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const checksumCount = await writeChecksums();
  await checkDemoSecrets(repositoryRoot, packageDirectory);
  await createZip(packageDirectory, archiveFile);
  const smoke = await smokeDemoPackage(packageDirectory, archiveFile);
  const archive = await stat(archiveFile);
  const archiveSha256 = createHash("sha256").update(await readFile(archiveFile)).digest("hex");
  await writeFile(`${archiveFile}.sha256`, `${archiveSha256}  ${basename(archiveFile)}\n`, "utf8");
  console.log(JSON.stringify({
    artifact: relative(repositoryRoot, archiveFile).replaceAll("\\", "/"),
    bytes: archive.size,
    sha256: archiveSha256,
    checksumCount,
    smoke
  }, null, 2));
}

await main();
