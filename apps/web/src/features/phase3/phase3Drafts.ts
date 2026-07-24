/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { openDB } from "idb";
import { assertSafePhase3Draft } from "./draftSafety";

export interface Phase3Draft<T> {
  schemaVersion: 3;
  userId: string;
  companyId: string;
  kind: "sst-inspection" | "time-entry" | "expense" | "ocr-review";
  draftId: string;
  updatedAt: string;
  value: T;
}

const databasePromise = openDB("erp-express-phase3-drafts", 1, {
  upgrade(database) {
    const store = database.createObjectStore("drafts", { keyPath: "key" });
    store.createIndex("scope", ["userId", "companyId"]);
  }
});

function keyOf(userId: string, companyId: string, kind: string, draftId: string): string {
  return `${userId}:${companyId}:${kind}:${draftId}`;
}

export async function savePhase3Draft<T>(
  draft: Omit<Phase3Draft<T>, "schemaVersion" | "updatedAt">
): Promise<Phase3Draft<T>> {
  assertSafePhase3Draft(draft.value);
  const record: Phase3Draft<T> & { key: string } = {
    ...draft,
    key: keyOf(draft.userId, draft.companyId, draft.kind, draft.draftId),
    schemaVersion: 3,
    updatedAt: new Date().toISOString()
  };
  const database = await databasePromise;
  await database.put("drafts", record);
  return record;
}

export async function getPhase3Draft<T>(
  userId: string,
  companyId: string,
  kind: Phase3Draft<T>["kind"],
  draftId = "new"
): Promise<Phase3Draft<T> | null> {
  const database = await databasePromise;
  const record = await database.get("drafts", keyOf(userId, companyId, kind, draftId)) as
    | (Phase3Draft<T> & { key: string })
    | undefined;
  if (!record || record.schemaVersion !== 3 || record.userId !== userId || record.companyId !== companyId) {
    return null;
  }
  return record;
}

export async function deletePhase3Draft(
  userId: string,
  companyId: string,
  kind: Phase3Draft<unknown>["kind"],
  draftId = "new"
): Promise<void> {
  const database = await databasePromise;
  await database.delete("drafts", keyOf(userId, companyId, kind, draftId));
}
