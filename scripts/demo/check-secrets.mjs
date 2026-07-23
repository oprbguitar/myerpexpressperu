import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const binaryOrGenerated = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip"]);
const forbiddenExtensions = new Set([".pem", ".key", ".p12", ".pfx", ".jks"]);
const forbiddenPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bgh[opusr]_[A-Za-z0-9]{30,}\b/
];

async function walk(path, files) {
  const metadata = await stat(path);
  if (metadata.isFile()) {
    files.push(path);
    return;
  }
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (["node_modules", "dist", "dev-dist", "test-results"].includes(entry.name)) continue;
    if (entry.name === ".env.demo") continue;
    await walk(join(path, entry.name), files);
  }
}

export async function checkDemoSecrets(repositoryRoot, additionalRoot) {
  const roots = [
    resolve(repositoryRoot, "deployment/demo"),
    resolve(repositoryRoot, "scripts/demo"),
    resolve(repositoryRoot, "packages/database/src/phase3")
  ];
  if (additionalRoot) roots.push(resolve(additionalRoot));
  const files = [];
  for (const root of roots) await walk(root, files);
  const findings = [];
  for (const file of files) {
    const extension = extname(file).toLowerCase();
    if (forbiddenExtensions.has(extension)) {
      findings.push(`${file}: archivo de credencial prohibido`);
      continue;
    }
    if (binaryOrGenerated.has(extension)) continue;
    const content = await readFile(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) findings.push(`${file}: patrón sensible ${pattern.source}`);
    }
    if (basename(file) === ".env.demo") findings.push(`${file}: .env.demo no debe empaquetarse`);
  }
  if (findings.length > 0) throw new Error(`Escaneo demo falló:\n${findings.join("\n")}`);
  return { scannedFiles: files.length, findings: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await checkDemoSecrets(resolve(process.argv[2] ?? "."), process.argv[3]);
  console.log(`Escaneo demo sin secretos: ${JSON.stringify(result)}`);
}

