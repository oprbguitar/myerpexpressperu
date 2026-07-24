/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
const baseUrl = String(import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1");

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...init.headers }
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string; requestId?: string } }
      | null;
    throw new ApiError(
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "No se pudo completar la solicitud.",
      payload?.error?.requestId
    );
  }
  return response.json() as Promise<T>;
}

export function createIdempotencyKey(operation: string): string {
  return `${operation}:${crypto.randomUUID()}`;
}

export function apiIdempotent<T>(path: string, operation: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: "POST",
    headers: { "idempotency-key": createIdempotencyKey(operation) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
