/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
const allowed = new Set(["start", "status", "health", "reset", "stop"]);
if (!command || !allowed.has(command)) {
  throw new Error(`Comando demo inválido: ${command ?? "(vacío)"}`);
}
const directory = dirname(fileURLToPath(import.meta.url));
const windows = process.platform === "win32";
const executable = windows ? "powershell.exe" : "sh";
const script = resolve(directory, `demo-${command}.${windows ? "ps1" : "sh"}`);
const args = windows
  ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script]
  : [script];
const result = spawnSync(executable, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

