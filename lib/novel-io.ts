import {
  db,
  type Novel,
  type Chapter,
  type Scene,
  type Character,
  type Note,
  type NameEntry,
  type ReplaceRule,
  type ExcludedName,
  type SceneVersionType,
  type StoryState,
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
  replaceRules?: ReplaceRule[];
  excludedNames?: ExcludedName[];
  storyState?: StoryState;
  /** @deprecated v1 only — analysis data is now on Novel */
  analyses?: unknown[];
}

// ─── Export ─────────────────────────────────────────────────

export interface ExportSelection {
  /** Chapters and their scenes. */
  chapters: boolean;
  /** Include historical scene versions (only when chapters is true). */
  includeVersions: boolean;
  characters: boolean;
  notes: boolean;
  /** QT data (name entries, replace rules, excluded names) + writing StoryState. */
  qtAndState: boolean;
  /** Worldbuilding / analysis fields on the Novel record. */
  worldbuilding: boolean;
}

export const DEFAULT_EXPORT_SELECTION: ExportSelection = {
  chapters: true,
  includeVersions: false,
  characters: true,
  notes: true,
  qtAndState: true,
  worldbuilding: true,
};

const WORLDBUILDING_KEYS: (keyof Novel)[] = [
  "genres",
  "tags",
  "synopsis",
  "worldOverview",
  "powerSystem",
  "storySetting",
  "timePeriod",
  "factions",
  "keyLocations",
  "worldRules",
  "technologyLevel",
  "analysisStatus",
  "chaptersAnalyzed",
  "totalChapters",
  "analysisError",
  "reviewIssues",
];

function stripWorldbuilding(novel: Novel): Novel {
  const clone = { ...novel };
  for (const key of WORLDBUILDING_KEYS) delete clone[key];
  return clone;
}

export async function exportNovel(
  novelId: string,
  selection?: Partial<ExportSelection>,
): Promise<NovelExportData> {
  const sel = { ...DEFAULT_EXPORT_SELECTION, ...selection };
  const novel = await db.novels.get(novelId);
  if (!novel) throw new Error("Novel not found");

  const [chapters, scenes, characters, notes, nameEntries, replaceRules, excludedNames, storyState] =
    await Promise.all([
      sel.chapters
        ? db.chapters.where("novelId").equals(novelId).toArray()
        : Promise.resolve([] as Chapter[]),
      sel.chapters
        ? sel.includeVersions
          ? db.scenes.where("novelId").equals(novelId).toArray()
          : db.scenes.where("[novelId+isActive]").equals([novelId, 1]).toArray()
        : Promise.resolve([] as Scene[]),
      sel.characters
        ? db.characters.where("novelId").equals(novelId).toArray()
        : Promise.resolve([] as Character[]),
      sel.notes
        ? db.notes.where("novelId").equals(novelId).toArray()
        : Promise.resolve([] as Note[]),
      sel.qtAndState
        ? db.nameEntries.where("scope").equals(novelId).toArray()
        : Promise.resolve([] as NameEntry[]),
      sel.qtAndState
        ? db.replaceRules.where("scope").equals(novelId).toArray()
        : Promise.resolve([] as ReplaceRule[]),
      sel.qtAndState
        ? db.excludedNames.where("scope").equals(novelId).toArray()
        : Promise.resolve([] as ExcludedName[]),
      sel.qtAndState ? db.storyStates.get(novelId) : Promise.resolve(undefined),
    ]);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    novel: sel.worldbuilding ? novel : stripWorldbuilding(novel),
    chapters,
    scenes,
    characters,
    notes,
    ...(nameEntries.length > 0 ? { nameEntries } : {}),
    ...(replaceRules.length > 0 ? { replaceRules } : {}),
    ...(excludedNames.length > 0 ? { excludedNames } : {}),
    ...(storyState ? { storyState } : {}),
  };
}

function safeFileName(title: string) {
  return title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF ]/g, "_");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadNovelJson(data: NovelExportData) {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    `${safeFileName(data.novel.title)}.novel.json`,
  );
}

// \u2500\u2500\u2500 Plain text export \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const CHAPTER_HEADING_RE = /^ch\u01B0\u01A1ng\s+\d+/i;

function chapterHeading(title: string, position: number) {
  const trimmed = title.trim();
  if (CHAPTER_HEADING_RE.test(trimmed)) return trimmed;
  return `Ch\u01B0\u01A1ng ${position}. ${trimmed}`;
}

export async function exportNovelTxt(novelId: string): Promise<string> {
  const novel = await db.novels.get(novelId);
  if (!novel) throw new Error("Novel not found");

  const [chapters, scenes] = await Promise.all([
    db.chapters.where("novelId").equals(novelId).sortBy("order"),
    db.scenes.where("[novelId+isActive]").equals([novelId, 1]).toArray(),
  ]);

  const scenesByChapter = new Map<string, Scene[]>();
  for (const scene of scenes) {
    const list = scenesByChapter.get(scene.chapterId);
    if (list) list.push(scene);
    else scenesByChapter.set(scene.chapterId, [scene]);
  }

  return chapters
    .map((chapter, index) => {
      const content = (scenesByChapter.get(chapter.id) ?? [])
        .sort((a, b) => a.order - b.order)
        .map((scene) => scene.content.trim())
        .filter(Boolean)
        .join("\n\n");
      const heading = chapterHeading(chapter.title, index + 1);
      return content ? `${heading}\n\n${content}` : heading;
    })
    .join("\n\n");
}

export function downloadNovelTxt(title: string, text: string) {
  downloadBlob(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
    `${safeFileName(title)}.txt`,
  );
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
  // Backward compat: old exports may have replace rules / excludes in nameEntries
  if (data.nameEntries?.length) {
    for (const entry of data.nameEntries) {
      const raw = entry as NameEntry & { category?: string; isRegex?: boolean; caseSensitive?: boolean; enabled?: boolean; order?: number };
      if (raw.category === "thay thế") {
        await db.replaceRules.add({
          id: crypto.randomUUID(),
          scope: novelId,
          pattern: raw.chinese,
          replacement: raw.vietnamese,
          isRegex: raw.isRegex ?? false,
          caseSensitive: raw.caseSensitive ?? false,
          enabled: raw.enabled ?? true,
          order: raw.order ?? 0,
          createdAt: new Date(raw.createdAt),
          updatedAt: new Date(raw.updatedAt),
        });
      } else if (raw.category === "loại trừ") {
        await db.excludedNames.add({
          id: crypto.randomUUID(),
          scope: novelId,
          chinese: raw.chinese,
          createdAt: new Date(raw.createdAt),
          updatedAt: new Date(raw.updatedAt),
        });
      } else {
        await db.nameEntries.add({
          ...entry,
          id: crypto.randomUUID(),
          scope: novelId,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        });
      }
    }
  }

  // Replace Rules
  if (data.replaceRules?.length) {
    for (const rule of data.replaceRules) {
      await db.replaceRules.add({
        ...rule,
        id: crypto.randomUUID(),
        scope: novelId,
        createdAt: new Date(rule.createdAt),
        updatedAt: new Date(rule.updatedAt),
      });
    }
  }

  // Excluded Names
  if (data.excludedNames?.length) {
    for (const entry of data.excludedNames) {
      await db.excludedNames.add({
        ...entry,
        id: crypto.randomUUID(),
        scope: novelId,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
      });
    }
  }

  // Story State (singleton keyed by novelId)
  if (data.storyState) {
    await db.storyStates.put({
      ...data.storyState,
      id: novelId,
      updatedAt: new Date(data.storyState.updatedAt),
    });
  }

  return novelId;
}
