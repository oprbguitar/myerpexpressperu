/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { ConflictException } from "@nestjs/common";

export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const normalized = source.replace(/^\uFEFF/, "");
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]!;
    if (quoted) {
      if (character === '"' && normalized[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(value.trim());
      value = "";
    } else if (character === "\n") {
      row.push(value.trim().replace(/\r$/, ""));
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (quoted) throw new ConflictException("El CSV contiene una comilla sin cerrar.");
  row.push(value.trim().replace(/\r$/, ""));
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

export function serializeCsv(headers: readonly string[], rows: readonly Readonly<Record<string, unknown>>[]): string {
  const safe = (raw: unknown) => {
    let value = "";
    if (typeof raw === "string") value = raw;
    else if (typeof raw === "number" || typeof raw === "bigint" || typeof raw === "boolean") value = String(raw);
    else if (raw != null) value = JSON.stringify(raw);
    if (/^[=+\-@]/.test(value)) value = `'${value}`;
    return `"${value.replace(/"/g, '""')}"`;
  };
  return [headers.map(safe).join(","), ...rows.map((row) => headers.map((header) => safe(row[header])).join(","))].join("\r\n");
}
