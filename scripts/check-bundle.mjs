import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";

const directory = join(process.cwd(), "apps/web/dist/assets");
const files = await readdir(directory);
let failed = false;
for (const file of files.filter((name) => name.endsWith(".js"))) {
  const path = join(directory, file);
  const raw = (await stat(path)).size;
  const gzip = gzipSync(await readFile(path)).byteLength;
  console.log(`${file}: ${(raw / 1024).toFixed(1)} KB raw, ${(gzip / 1024).toFixed(1)} KB gzip`);
  if (gzip > 500 * 1024) failed = true;
}
if (failed) {
  console.error("Un activo JavaScript supera el presupuesto de 500 KB comprimido.");
  process.exit(1);
}
