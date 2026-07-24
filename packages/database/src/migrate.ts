/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgresDatabase } from "./index.js";

// Las migraciones usan el rol de migración (propietario/superusuario), nunca el
// rol de aplicación restringido. Si no se define, se cae a DATABASE_URL para no
// romper entornos locales que aún no separan roles.
const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_MIGRATION_URL o DATABASE_URL es obligatorio.");
const database = new PostgresDatabase(connectionString);
const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../../migrations");

async function ensureHistory(): Promise<void> {
  await database.query(`create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )`);
}

async function up(): Promise<void> {
  await ensureHistory();
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".up.sql")).sort();
  const appliedRows = await database.query<{ version: string }>("select version from schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.version));
  for (const file of files) {
    const version = file.replace(".up.sql", "");
    if (applied.has(version)) continue;
    const sql = await readFile(join(migrationsDirectory, file), "utf8");
    await database.transaction(async (client) => {
      await client.query(sql);
      await client.query("insert into schema_migrations(version) values($1)", [version]);
    });
    console.log(`Migración aplicada: ${version}`);
  }
}

async function down(): Promise<void> {
  await ensureHistory();
  const [last] = await database.query<{ version: string }>(
    "select version from schema_migrations order by applied_at desc limit 1"
  );
  if (!last) return;
  const sql = await readFile(join(migrationsDirectory, `${last.version}.down.sql`), "utf8");
  await database.transaction(async (client) => {
    await client.query(sql);
    await client.query("delete from schema_migrations where version=$1", [last.version]);
  });
  console.log(`Migración revertida: ${last.version}`);
}

const command = process.argv[2] ?? "up";
try {
  if (command === "up") await up();
  else if (command === "down") await down();
  else if (command === "reset") {
    let count = Number((await database.query<{ count: string }>("select count(*)::text as count from schema_migrations"))[0]?.count ?? 0);
    while (count-- > 0) await down();
    await up();
  } else throw new Error(`Comando de migración desconocido: ${command}`);
} finally {
  await database.close();
}
