import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ignored = new Set([".git", "node_modules", "data", "playwright-report", "test-results"]);
const suspicious = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[ps]_[A-Za-z0-9]{30,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /service_role\s*[:=]\s*["'][^"']+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];
async function walk(directory) {
  const findings = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) findings.push(...(await walk(path)));
    else if (entry.isFile() && !/\.(png|jpg|jpeg|webp|ico|woff2|zip|lock)$/.test(entry.name)) {
      const contents = await readFile(path, "utf8").catch(() => "");
      if (suspicious.some((pattern) => pattern.test(contents))) findings.push(path);
    }
  }
  return findings;
}
const findings = await walk(process.cwd());
if (findings.length) {
  console.error(`Posibles secretos: ${findings.join(", ")}`);
  process.exit(1);
}
console.log("No se detectaron patrones de secretos reales en código ni artefactos.");
