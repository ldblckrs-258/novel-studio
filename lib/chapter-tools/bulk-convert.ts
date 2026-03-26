import { db } from "@/lib/db";
import { getMergedNameDict } from "@/lib/hooks/use-name-entries";
import { convertText } from "@/lib/hooks/use-qt-engine";
import {
  createSceneVersion,
  ensureInitialVersion,
} from "@/lib/hooks/use-scene-versions";
import { updateScene } from "@/lib/hooks/use-scenes";
import type { ConvertChapterResult } from "@/lib/stores/bulk-convert";

const SCENE_BREAK = "===SCENE_BREAK===";

export interface BulkConvertOptions {
  novelId: string;
  chapterIds: string[];
  autoSave: boolean;
  onChapterStart: (chapterId: string, title: string) => void;
  onChapterComplete: (result: ConvertChapterResult) => void;
  onChapterError: (error: {
    chapterId: string;
    chapterTitle: string;
    message: string;
  }) => void;
  onAllComplete: () => void;
}

export async function runBulkConvert(opts: BulkConvertOptions): Promise<void> {
  const {
    novelId,
    chapterIds,
    autoSave,
    onChapterStart,
    onChapterComplete,
    onChapterError,
    onAllComplete,
  } = opts;

  // Prefetch all data
  const allChapters = await db.chapters
    .where("novelId")
    .equals(novelId)
    .sortBy("order");
  const allScenes = await db.scenes
    .where("[novelId+isActive]")
    .equals([novelId, 1])
    .toArray();

  // Group scenes by chapter
  const scenesByChapter = new Map<
    string,
    Array<{ id: string; content: string; order: number }>
  >();
  for (const s of allScenes) {
    if (!scenesByChapter.has(s.chapterId)) scenesByChapter.set(s.chapterId, []);
    scenesByChapter
      .get(s.chapterId)!
      .push({ id: s.id, content: s.content, order: s.order });
  }
  for (const scenes of scenesByChapter.values()) {
    scenes.sort((a, b) => a.order - b.order);
  }

  // Get merged name dict
  const nameDict = await getMergedNameDict(novelId);

  // Process each chapter
  for (const chapterId of chapterIds) {
    const chapter = allChapters.find((c) => c.id === chapterId);
    if (!chapter) {
      onChapterError({
        chapterId,
        chapterTitle: "Unknown",
        message: "Không tìm thấy chương",
      });
      continue;
    }

    onChapterStart(chapterId, chapter.title);

    const scenes = scenesByChapter.get(chapterId);
    if (!scenes?.length) {
      onChapterError({
        chapterId,
        chapterTitle: chapter.title,
        message: "Chương không có cảnh nào",
      });
      continue;
    }

    try {
      // Join scenes
      const joinedContent = scenes
        .map((s) => s.content)
        .join(`\n${SCENE_BREAK}\n`);
      const originalLineCount = joinedContent.split("\n").length;

      // Convert
      const result = await convertText(joinedContent, {
        novelNames: nameDict,
      });

      // Split back to scenes
      const convertedParts = result.plainText.split(SCENE_BREAK);
      const sceneResults = scenes.map((s, i) => ({
        sceneId: s.id,
        content: (convertedParts[i] ?? "").trim(),
      }));

      const convertedLineCount = result.plainText.split("\n").length;

      const chapterResult: ConvertChapterResult = {
        chapterId,
        chapterTitle: chapter.title,
        originalLineCount,
        convertedLineCount,
        scenes: sceneResults,
      };

      onChapterComplete(chapterResult);

      // Auto-save
      if (autoSave) {
        await saveConvertResult(chapterResult, novelId, scenes);
      }
    } catch (err) {
      onChapterError({
        chapterId,
        chapterTitle: chapter.title,
        message:
          err instanceof Error ? err.message : "Lỗi convert không xác định",
      });
    }
  }

  onAllComplete();
}

async function saveConvertResult(
  result: ConvertChapterResult,
  novelId: string,
  originalScenes: Array<{ id: string; content: string }>,
): Promise<void> {
  for (let i = 0; i < result.scenes.length; i++) {
    const scene = result.scenes[i];
    const original = originalScenes[i];
    if (!original) continue;

    await ensureInitialVersion(scene.sceneId, novelId, original.content);
    await createSceneVersion(
      scene.sceneId,
      novelId,
      "qt-convert",
      scene.content,
    );
    await updateScene(scene.sceneId, { content: scene.content });
  }
}

export async function saveBulkConvertResults(
  results: ConvertChapterResult[],
  novelId: string,
): Promise<string[]> {
  const allScenes = await db.scenes
    .where("[novelId+isActive]")
    .equals([novelId, 1])
    .toArray();

  const savedIds: string[] = [];

  for (const result of results) {
    const chapterScenes = allScenes.filter((s) =>
      result.scenes.some((rs) => rs.sceneId === s.id),
    );
    const originalMap = new Map(chapterScenes.map((s) => [s.id, s.content]));
    const originals = result.scenes.map((s) => ({
      id: s.sceneId,
      content: originalMap.get(s.sceneId) ?? "",
    }));

    await saveConvertResult(result, novelId, originals);
    savedIds.push(result.chapterId);
  }

  return savedIds;
}
