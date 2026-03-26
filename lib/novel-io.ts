import {
  db,
  type Novel,
  type Chapter,
  type Scene,
  type Character,
  type Note,
  type NameEntry,
  type SceneVersionType,
} from "@/lib/db";

// ─── Export Format ──────────────────────────────────────────

export interface NovelExportData {
  version: 1 | 2;
  exportedAt: string;
  novel: Novel;
  chapters: Chapter[];
  scenes: Scene[];
  characters: Character[];
  notes: Note[];
  nameEntries?: NameEntry[];
  /** @deprecated v1 only — analysis data is now on Novel */
  analyses?: unknown[];
}

// ─── Export ─────────────────────────────────────────────────

export async function exportNovel(
  novelId: string,
  options?: { includeVersions?: boolean },
): Promise<NovelExportData> {
  const novel = await db.novels.get(novelId);
  if (!novel) throw new Error("Novel not found");

  const includeVersions = options?.includeVersions ?? false;

  const [chapters, scenes, characters, notes, nameEntries] =
    await Promise.all([
      db.chapters.where("novelId").equals(novelId).toArray(),
      includeVersions
        ? db.scenes.where("novelId").equals(novelId).toArray()
        : db.scenes
            .where("[novelId+isActive]")
            .equals([novelId, 1])
            .toArray(),
      db.characters.where("novelId").equals(novelId).toArray(),
      db.notes.where("novelId").equals(novelId).toArray(),
      db.nameEntries.where("scope").equals(novelId).toArray(),
    ]);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    novel,
    chapters,
    scenes,
    characters,
    notes,
    ...(nameEntries.length > 0 ? { nameEntries } : {}),
  };
}

export function downloadNovelJson(data: NovelExportData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.novel.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF ]/g, "_")}.novel.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import ─────────────────────────────────────────────────

export async function importNovel(file: File): Promise<string> {
  const text = await file.text();
  let data: NovelExportData;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Tệp JSON không hợp lệ.");
  }

  if (!data.version || !data.novel?.title) {
    throw new Error("Định dạng tệp không đúng.");
  }

  // Generate new IDs to avoid collisions
  const novelId = crypto.randomUUID();
  const now = new Date();

  // Map old IDs → new IDs
  const chapterIdMap = new Map<string, string>();
  const characterIdMap = new Map<string, string>();
  const sceneIdMap = new Map<string, string>();

  // Novel — merge v1 analysis data if present
  const novelData = { ...data.novel };
  if (data.version === 1 && Array.isArray(data.analyses) && data.analyses.length > 0) {
    const a = data.analyses[0] as Record<string, unknown>;
    if (a) {
      if (a.genres) novelData.genres = a.genres as string[];
      if (a.tags) novelData.tags = a.tags as string[];
      if (a.synopsis) novelData.synopsis = a.synopsis as string;
      if (a.worldOverview) novelData.worldOverview = a.worldOverview as string;
      if (a.powerSystem) novelData.powerSystem = a.powerSystem as string;
      if (a.storySetting) novelData.storySetting = a.storySetting as string;
      if (a.timePeriod) novelData.timePeriod = a.timePeriod as string;
      if (a.factions) novelData.factions = a.factions as Novel["factions"];
      if (a.keyLocations) novelData.keyLocations = a.keyLocations as Novel["keyLocations"];
      if (a.worldRules) novelData.worldRules = a.worldRules as string;
      if (a.technologyLevel) novelData.technologyLevel = a.technologyLevel as string;
      if (a.analysisStatus) novelData.analysisStatus = a.analysisStatus as Novel["analysisStatus"];
      if (a.chaptersAnalyzed) novelData.chaptersAnalyzed = a.chaptersAnalyzed as number;
      if (a.totalChapters) novelData.totalChapters = a.totalChapters as number;
      if (a.error) novelData.analysisError = a.error as string;
    }
  }

  await db.novels.add({
    ...novelData,
    id: novelId,
    createdAt: now,
    updatedAt: now,
  });

  // Chapters
  if (data.chapters?.length) {
    for (const ch of data.chapters) {
      const newId = crypto.randomUUID();
      chapterIdMap.set(ch.id, newId);
      await db.chapters.add({
        ...ch,
        id: newId,
        novelId,
        createdAt: new Date(ch.createdAt),
        updatedAt: new Date(ch.updatedAt),
        analyzedAt: ch.analyzedAt ? new Date(ch.analyzedAt) : undefined,
      });
    }
  }

  // Scenes (active + inactive versions)
  if (data.scenes?.length) {
    for (const sc of data.scenes) {
      const newId = crypto.randomUUID();
      sceneIdMap.set(sc.id, newId);
      await db.scenes.add({
        ...sc,
        id: newId,
        novelId,
        chapterId: chapterIdMap.get(sc.chapterId) ?? sc.chapterId,
        // Remap activeSceneId for inactive versions
        activeSceneId: sc.activeSceneId
          ? (sceneIdMap.get(sc.activeSceneId) ?? sc.activeSceneId)
          : undefined,
        // Ensure version fields have defaults for old exports without them
        version: sc.version ?? 0,
        versionType: (sc.versionType ?? "manual") as SceneVersionType,
        isActive: sc.isActive ?? 1,
        createdAt: new Date(sc.createdAt),
        updatedAt: new Date(sc.updatedAt),
      });
    }
  }

  // Second pass: fix activeSceneId for scenes imported before their parent
  if (data.scenes?.length) {
    for (const sc of data.scenes) {
      if (sc.activeSceneId && sceneIdMap.has(sc.activeSceneId)) {
        const newId = sceneIdMap.get(sc.id)!;
        const newActiveId = sceneIdMap.get(sc.activeSceneId)!;
        await db.scenes.update(newId, { activeSceneId: newActiveId });
      }
    }
  }

  // Characters
  if (data.characters?.length) {
    for (const char of data.characters) {
      const newId = crypto.randomUUID();
      characterIdMap.set(char.id, newId);
      await db.characters.add({
        ...char,
        id: newId,
        novelId,
        createdAt: new Date(char.createdAt),
        updatedAt: new Date(char.updatedAt),
      });
    }
  }

  // Remap characterIds in chapters
  if (characterIdMap.size > 0) {
    for (const ch of data.chapters ?? []) {
      if (ch.characterIds?.length) {
        const newChId = chapterIdMap.get(ch.id);
        if (newChId) {
          await db.chapters.update(newChId, {
            characterIds: ch.characterIds.map(
              (cid) => characterIdMap.get(cid) ?? cid
            ),
          });
        }
      }
    }
  }

  // Notes
  if (data.notes?.length) {
    for (const note of data.notes) {
      await db.notes.add({
        ...note,
        id: crypto.randomUUID(),
        novelId,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
      });
    }
  }

  // Name Entries (scope remaps from old novelId to new novelId)
  if (data.nameEntries?.length) {
    for (const entry of data.nameEntries) {
      await db.nameEntries.add({
        ...entry,
        id: crypto.randomUUID(),
        scope: novelId,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
      });
    }
  }

  return novelId;
}
