import { openDB } from "idb";

export interface LocalDraft<T = unknown> {
  schemaVersion: 2;
  userId: string;
  companyId: string;
  type: string;
  draftId: string;
  serverVersion?: number | undefined;
  updatedAt: string;
  value: T;
}

const databasePromise = openDB("erp-express-drafts", 2, {
  upgrade(database) {
    if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts");
    if (!database.objectStoreNames.contains("catalogs")) database.createObjectStore("catalogs");
  }
});

export async function saveDraft<T>(key: string, value: T): Promise<void> {
  const database = await databasePromise;
  await database.put("drafts", { schemaVersion: 1, updatedAt: new Date().toISOString(), value }, key);
}

export async function getDraft<T>(key: string): Promise<T | null> {
  const database = await databasePromise;
  const record = (await database.get("drafts", key)) as { schemaVersion: number; value: T } | undefined;
  return record?.schemaVersion === 1 ? record.value : null;
}

export async function deleteDraft(key: string): Promise<void> {
  const database = await databasePromise;
  await database.delete("drafts", key);
}

export function draftKey(userId: string, companyId: string, type: string, draftId = "new"): string {
  return `${userId}:${companyId}:${type}:${draftId}`;
}

export async function saveScopedDraft<T>(draft: Omit<LocalDraft<T>, "schemaVersion" | "updatedAt">): Promise<void> {
  const database = await databasePromise;
  await database.put("drafts", {
    ...draft, schemaVersion: 2, updatedAt: new Date().toISOString()
  } satisfies LocalDraft<T>, draftKey(draft.userId, draft.companyId, draft.type, draft.draftId));
}

export async function getScopedDraft<T>(
  userId: string, companyId: string, type: string, draftId = "new"
): Promise<LocalDraft<T> | null> {
  const database = await databasePromise;
  const record = await database.get("drafts", draftKey(userId, companyId, type, draftId)) as LocalDraft<T> | undefined;
  return record?.schemaVersion === 2 && record.userId === userId && record.companyId === companyId ? record : null;
}

export async function listScopedDrafts(userId: string, companyId: string): Promise<LocalDraft[]> {
  const database = await databasePromise;
  const records = await database.getAll("drafts") as Array<LocalDraft | { schemaVersion: number }>;
  return records.filter((record): record is LocalDraft =>
    record.schemaVersion === 2 && "userId" in record && record.userId === userId && record.companyId === companyId
  );
}

export async function deleteScopedDraft(userId: string, companyId: string, type: string, draftId = "new"): Promise<void> {
  return deleteDraft(draftKey(userId, companyId, type, draftId));
}
