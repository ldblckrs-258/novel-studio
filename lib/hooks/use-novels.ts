"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Novel } from "@/lib/db";

export function useNovels() {
  const novels = useLiveQuery(() =>
    db.novels.orderBy("updatedAt").reverse().toArray()
  );
  return novels;
}

export function useNovel(id: string | undefined) {
  const novel = useLiveQuery(
    () => (id ? db.novels.get(id) : undefined),
    [id]
  );
  return novel;
}

export async function createNovel(
  data: Omit<Novel, "id" | "createdAt" | "updatedAt">
) {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.novels.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateNovel(
  id: string,
  data: Partial<Omit<Novel, "id" | "createdAt">>
) {
  await db.novels.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteNovel(id: string) {
  await db.transaction("rw", [db.novels, db.chapters, db.scenes, db.characters, db.notes], async () => {
    await db.scenes.where("novelId").equals(id).delete();
    await db.chapters.where("novelId").equals(id).delete();
    await db.characters.where("novelId").equals(id).delete();
    await db.notes.where("novelId").equals(id).delete();
    await db.novels.delete(id);
  });
}
