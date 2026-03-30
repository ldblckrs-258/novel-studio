"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Chapter } from "@/lib/db";

export function useChapters(novelId: string | undefined) {
  const chapters = useLiveQuery(
    () =>
      novelId
        ? db.chapters.where("novelId").equals(novelId).sortBy("order")
        : [],
    [novelId]
  );
  return chapters;
}

export function useChapter(id: string | undefined) {
  const chapter = useLiveQuery(
    () => (id ? db.chapters.get(id) : undefined),
    [id]
  );
  return chapter;
}

export async function createChapter(
  data: Omit<Chapter, "id" | "createdAt" | "updatedAt">
) {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.chapters.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateChapter(
  id: string,
  data: Partial<Omit<Chapter, "id" | "createdAt">>
) {
  await db.chapters.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteChapter(id: string) {
  await db.transaction("rw", [db.chapters, db.scenes], async () => {
    // Deletes both active scenes and their inactive versions (share chapterId)
    await db.scenes.where("chapterId").equals(id).delete();
    await db.chapters.delete(id);
  });
}

export type ChapterAnalysisStatus = "analyzed" | "stale" | "unanalyzed";

export function useChapterAnalysisStatus(novelId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!novelId) return [];
      const chapters = await db.chapters
        .where("novelId")
        .equals(novelId)
        .sortBy("order");
      const results: { chapterId: string; status: ChapterAnalysisStatus }[] =
        [];
      for (const ch of chapters) {
        if (!ch.analyzedAt) {
          results.push({ chapterId: ch.id, status: "unanalyzed" });
          continue;
        }
        const scenes = await db.scenes
          .where("[chapterId+isActive]")
          .equals([ch.id, 1])
          .toArray();
        const latestEdit = Math.max(
          ...scenes.map((s) => s.updatedAt.getTime()),
          0,
        );
        results.push({
          chapterId: ch.id,
          status:
            latestEdit > ch.analyzedAt.getTime() ? "stale" : "analyzed",
        });
      }
      return results;
    },
    [novelId],
  );
}

export function useHasAnalyzedChapters(novelId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!novelId) return false;
      const count = await db.chapters
        .where("novelId")
        .equals(novelId)
        .filter((ch) => !!ch.analyzedAt && !!ch.summary)
        .count();
      return count > 0;
    },
    [novelId],
  );
}

export async function reorderChapters(
  chapters: { id: string; order: number }[]
) {
  await db.transaction("rw", db.chapters, async () => {
    for (const { id, order } of chapters) {
      await db.chapters.update(id, { order, updatedAt: new Date() });
    }
  });
}
