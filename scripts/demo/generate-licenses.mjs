import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

async function readPackage(file) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (typeof parsed.name !== "string" || typeof parsed.version !== "string") return null;
    const license = typeof parsed.license === "string"
      ? parsed.license
      : Array.isArray(parsed.licenses)
        ? parsed.licenses.map((item) => typeof item === "string" ? item : item?.type).filter(Boolean).join(" OR ")
        : "UNKNOWN";
    return {
      name: parsed.name,
      version: parsed.version,
      license,
      repository: typeof parsed.repository === "string" ? parsed.repository : parsed.repository?.url ?? null
    };
  } catch {
    return null;
  }
}

export async function generateLicenseInventory(repositoryRoot, outputFile) {
  await mkdir(dirname(outputFile), { recursive: true });
  const store = resolve(repositoryRoot, "node_modules/.pnpm");
  const packages = new Map();
  let entries = [];
  try {
    entries = await readdir(store, { withFileTypes: true });
  } catch {
    entries = [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const modules = join(store, entry.name, "node_modules");
    let children = [];
    try {
      children = await readdir(modules, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (!child.isDirectory()) continue;
      if (child.name.startsWith("@")) {
        let scoped = [];
        try {
          scoped = await readdir(join(modules, child.name), { withFileTypes: true });
        } catch {
          continue;
        }
        for (const scopedChild of scoped) {
          if (!scopedChild.isDirectory()) continue;
          const item = await readPackage(join(modules, child.name, scopedChild.name, "package.json"));
          if (item) packages.set(`${item.name}@${item.version}`, item);
        }
      } else {
        const item = await readPackage(join(modules, child.name, "package.json"));
        if (item) packages.set(`${item.name}@${item.version}`, item);
      }
    }
  }
  const inventory = {
    format: "erp-express-peru-license-inventory",
    version: 1,
    applicationVersion: "0.3.0",
    generatedFrom: "installed package manifests",
    reviewRequired: [...packages.values()].some((item) => item.license === "UNKNOWN"),
    packages: [...packages.values()].sort((left, right) =>
      `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`)
    )
  };
  await writeFile(outputFile, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  return inventory;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repositoryRoot = resolve(process.argv[2] ?? ".");
  const output = resolve(process.argv[3] ?? "dist/demo/licenses.json");
  const inventory = await generateLicenseInventory(repositoryRoot, output);
  console.log(`Inventario de licencias generado: ${output} (${inventory.packages.length} paquetes)`);
}
