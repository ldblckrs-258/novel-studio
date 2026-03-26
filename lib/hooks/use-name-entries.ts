"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type NameEntry } from "@/lib/db";

// ─── Reads ───────────────────────────────────────────────────

export function useNameEntries(scope: string | undefined) {
  return useLiveQuery(
    () =>
      scope ? db.nameEntries.where("scope").equals(scope).toArray() : [],
    [scope],
  );
}

export function useGlobalNameEntries() {
  return useLiveQuery(
    () => db.nameEntries.where("scope").equals("global").toArray(),
    [],
  );
}

export function useNovelNameEntries(novelId: string | undefined) {
  return useLiveQuery(
    () =>
      novelId
        ? db.nameEntries.where("scope").equals(novelId).toArray()
        : [],
    [novelId],
  );
}

export function useMergedNameEntries(novelId: string | undefined) {
  return useLiveQuery(async () => {
    if (!novelId) return [];
    const [globalEntries, novelEntries] = await Promise.all([
      db.nameEntries.where("scope").equals("global").toArray(),
      db.nameEntries.where("scope").equals(novelId).toArray(),
    ]);
    const merged = new Map<string, NameEntry>();
    for (const e of globalEntries) merged.set(e.chinese, e);
    for (const e of novelEntries) merged.set(e.chinese, e); // override
    return Array.from(merged.values());
  }, [novelId]);
}

export function useNameEntryCount(scope: string | undefined) {
  return useLiveQuery(
    () =>
      scope ? db.nameEntries.where("scope").equals(scope).count() : 0,
    [scope],
  );
}

// ─── Mutations ───────────────────────────────────────────────

export async function createNameEntry(
  data: Omit<NameEntry, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.nameEntries.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateNameEntry(
  id: string,
  data: Partial<Omit<NameEntry, "id" | "createdAt">>,
): Promise<void> {
  await db.nameEntries.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteNameEntry(id: string): Promise<void> {
  await db.nameEntries.delete(id);
}

export async function deleteNameEntriesByScope(
  scope: string,
): Promise<void> {
  await db.nameEntries.where("scope").equals(scope).delete();
}

export async function bulkCreateNameEntries(
  entries: Omit<NameEntry, "id" | "createdAt" | "updatedAt">[],
): Promise<void> {
  const now = new Date();
  const rows = entries.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));
  await db.nameEntries.bulkAdd(rows);
}

export type DuplicateMode = "skip" | "replace";

export interface BulkImportResult {
  added: number;
  skipped: number;
  replaced: number;
}

/**
 * Bulk import name entries with duplicate handling.
 * Duplicates are detected by matching scope + chinese.
 *
 * @param scope - "global" or a novelId
 * @param entries - Array of { chinese, vietnamese } pairs
 * @param category - Category for new entries
 * @param duplicateMode - "skip" keeps existing, "replace" overwrites
 */
export async function bulkImportNameEntries(
  scope: string,
  entries: Array<{ chinese: string; vietnamese: string }>,
  category: string,
  duplicateMode: DuplicateMode = "skip",
): Promise<BulkImportResult> {
  // Fetch existing entries for this scope in one query
  const existing = await db.nameEntries
    .where("scope")
    .equals(scope)
    .toArray();
  const existingMap = new Map(existing.map((e) => [e.chinese, e]));

  const now = new Date();
  const toAdd: NameEntry[] = [];
  const toUpdate: Array<{ id: string; vietnamese: string; updatedAt: Date }> =
    [];
  let skipped = 0;

  // Deduplicate input (last wins within the import set)
  const uniqueEntries = new Map(
    entries.map((e) => [e.chinese, e.vietnamese]),
  );

  for (const [chinese, vietnamese] of uniqueEntries) {
    const ex = existingMap.get(chinese);
    if (ex) {
      if (duplicateMode === "replace") {
        toUpdate.push({ id: ex.id, vietnamese, updatedAt: now });
      } else {
        skipped++;
      }
    } else {
      toAdd.push({
        id: crypto.randomUUID(),
        scope,
        chinese,
        vietnamese,
        category,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Batch write
  await db.transaction("rw", db.nameEntries, async () => {
    if (toAdd.length > 0) await db.nameEntries.bulkAdd(toAdd);
    for (const u of toUpdate) {
      await db.nameEntries.update(u.id, {
        vietnamese: u.vietnamese,
        updatedAt: u.updatedAt,
      });
    }
  });

  return {
    added: toAdd.length,
    skipped,
    replaced: toUpdate.length,
  };
}

/** Legacy wrapper — import QT names to global scope */
export async function importQTNamesToGlobal(
  entries: Array<{ chinese: string; vietnamese: string }>,
  category: string,
  duplicateMode: DuplicateMode = "skip",
): Promise<BulkImportResult> {
  return bulkImportNameEntries("global", entries, category, duplicateMode);
}

/** Get merged name entries as simple key-value pairs for QT engine / AI context */
export async function getMergedNameDict(
  novelId?: string,
): Promise<Array<{ chinese: string; vietnamese: string }>> {
  const globalEntries = await db.nameEntries
    .where("scope")
    .equals("global")
    .toArray();
  const novelEntries = novelId
    ? await db.nameEntries.where("scope").equals(novelId).toArray()
    : [];
  const merged = new Map<string, string>();
  for (const e of globalEntries) merged.set(e.chinese, e.vietnamese);
  for (const e of novelEntries) merged.set(e.chinese, e.vietnamese);
  return Array.from(merged, ([chinese, vietnamese]) => ({
    chinese,
    vietnamese,
  }));
}
