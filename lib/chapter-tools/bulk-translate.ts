import { streamText } from "ai";
import type { LanguageModel } from "ai";
import { db } from "@/lib/db";
import type { AnalysisSettings, Scene } from "@/lib/db";
import { createSceneVersion, ensureInitialVersion } from "@/lib/hooks/use-scene-versions";
import type { ContextDepth } from "./context";
import { buildTranslateContext } from "./context";
import {
  resolveChapterToolPrompts,
  buildTranslateTitleNote,
  buildTranslateSceneBreakNote,
  buildTranslateUserPrompt,
} from "./prompts";
import type { TranslateChapterResult, TranslateError } from "@/lib/stores/bulk-translate";

// ── Shared constants & helpers (also used by translate-mode.tsx) ──

export const TITLE_SEPARATOR = "---";

const SCENE_BREAK = "===SCENE_BREAK===";

export function parseTranslateResult(
  raw: string,
  includeTitle: boolean,
): { title: string | null; content: string } {
  if (!includeTitle) return { title: null, content: raw };

  const sepIndex = raw.indexOf(`\n${TITLE_SEPARATOR}\n`);
  if (sepIndex === -1) return { title: null, content: raw };

  const title = raw.slice(0, sepIndex).trim();
  const content = raw.slice(sepIndex + TITLE_SEPARATOR.length + 2).trim();
  return { title: title || null, content };
}

// ── Save helpers ──

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

/** Save a single chapter result with version snapshots. */
async function saveChapterScenes(
  result: TranslateChapterResult,
  timestamp: Date,
) {
  if (result.newTitle) {
    await db.chapters.update(result.chapterId, {
      title: result.newTitle,
      updatedAt: timestamp,
    });
  }
  for (const scene of result.scenes) {
    // Bootstrap v1 (manual) with original content if no versions exist
    const existing = await db.scenes.get(scene.sceneId);
    if (existing) {
      await ensureInitialVersion(scene.sceneId, existing.novelId, existing.content);
      // Save the NEW translated content as a version
      await createSceneVersion(scene.sceneId, existing.novelId, "ai-translate", scene.content);
    }
    await db.scenes.update(scene.sceneId, {
      content: scene.content,
      wordCount: countWords(scene.content),
      updatedAt: timestamp,
    });
  }
}

export async function saveChapterResult(result: TranslateChapterResult) {
  await saveChapterScenes(result, new Date());
}

/** Save multiple chapter results in a single transaction. */
export async function saveBulkResults(results: TranslateChapterResult[]) {
  await db.transaction("rw", [db.chapters, db.scenes], async () => {
    const now = new Date();
    for (const result of results) {
      await saveChapterScenes(result, now);
    }
  });
}

// ── Bulk translate engine ──

export interface BulkTranslateOptions {
  novelId: string;
  chapterIds: string[];
  model: LanguageModel;
  depth: ContextDepth;
  translateTitle: boolean;
  autoSave: boolean;
  settings: AnalysisSettings;
  /** Overrides the translate prompt from settings when provided. */
  customPrompt?: string;
  signal?: AbortSignal;

  onChapterStart: (chapterId: string, chapterTitle: string) => void;
  onChapterComplete: (result: TranslateChapterResult) => void;
  onChapterError: (error: TranslateError) => void;
  onAllComplete: () => void;
}

export async function runBulkTranslate(opts: BulkTranslateOptions): Promise<void> {
  const {
    novelId,
    chapterIds,
    model,
    depth,
    translateTitle,
    autoSave,
    settings,
    customPrompt,
    signal,
    onChapterStart,
    onChapterComplete,
    onChapterError,
    onAllComplete,
  } = opts;

  const chapterIdSet = new Set(chapterIds);

  // Prefetch chapters + all scenes in 2 queries (not N+1)
  const [allChapters, allScenes] = await Promise.all([
    db.chapters.where("novelId").equals(novelId).sortBy("order"),
    db.scenes.where("[novelId+isActive]").equals([novelId, 1]).toArray(),
  ]);

  const chapters = allChapters.filter((c) => chapterIdSet.has(c.id));

  // Group scenes by chapter
  const scenesByChapter = new Map<string, Scene[]>();
  for (const s of allScenes) {
    if (!chapterIdSet.has(s.chapterId)) continue;
    const arr = scenesByChapter.get(s.chapterId) ?? [];
    arr.push(s);
    scenesByChapter.set(s.chapterId, arr);
  }
  // Sort each group by order
  for (const scenes of scenesByChapter.values()) {
    scenes.sort((a, b) => a.order - b.order);
  }

  const basePrompt = customPrompt?.trim() || resolveChapterToolPrompts(settings).translate;

  for (const chapter of chapters) {
    if (signal?.aborted) break;

    onChapterStart(chapter.id, chapter.title);

    try {
      const scenes = scenesByChapter.get(chapter.id) ?? [];

      if (scenes.length === 0) {
        onChapterError({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          message: "Chương không có nội dung (scene)",
        });
        continue;
      }

      // Join scene contents
      const isMultiScene = scenes.length > 1;
      const joinedContent = isMultiScene
        ? scenes.map((s) => s.content).join(`\n\n${SCENE_BREAK}\n\n`)
        : scenes[0].content;

      // Build context (uses chapter summaries — varies per chapter order)
      const context = await buildTranslateContext(novelId, chapter.order, depth);

      // Build system prompt
      let systemPrompt = basePrompt;
      if (translateTitle) {
        systemPrompt += buildTranslateTitleNote(TITLE_SEPARATOR);
      }
      if (isMultiScene) {
        systemPrompt += buildTranslateSceneBreakNote(SCENE_BREAK);
      }
      if (context) {
        systemPrompt += `\n\n${context}`;
      }

      // Build user prompt
      const userPrompt = translateTitle
        ? buildTranslateUserPrompt(joinedContent, chapter.title, TITLE_SEPARATOR)
        : joinedContent;

      // Stream translation
      const result = streamText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        abortSignal: signal,
      });

      let accumulated = "";
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          accumulated += part.text;
        }
      }

      if (!accumulated.trim()) {
        onChapterError({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          message: "AI trả về nội dung trống — có thể bị chặn bởi bộ lọc an toàn.",
        });
        continue;
      }

      // Parse result
      const parsed = parseTranslateResult(accumulated, translateTitle);

      // Split back to scenes
      let sceneResults: { sceneId: string; content: string }[];
      if (isMultiScene) {
        const parts = parsed.content.split(SCENE_BREAK).map((s) => s.trim());
        if (parts.length === scenes.length) {
          sceneResults = scenes.map((s, i) => ({
            sceneId: s.id,
            content: parts[i],
          }));
        } else {
          // Fallback: put all in first scene, keep others unchanged
          sceneResults = scenes.map((s, i) => ({
            sceneId: s.id,
            content: i === 0 ? parsed.content.replaceAll(SCENE_BREAK, "").trim() : s.content,
          }));
        }
      } else {
        sceneResults = [{ sceneId: scenes[0].id, content: parsed.content }];
      }

      const chapterResult: TranslateChapterResult = {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        originalTitle: chapter.title,
        newTitle: parsed.title ?? undefined,
        originalLineCount: joinedContent.split("\n").length,
        translatedLineCount: parsed.content.split("\n").length,
        scenes: sceneResults,
      };

      onChapterComplete(chapterResult);

      if (autoSave) {
        await saveChapterResult(chapterResult);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        break;
      }
      onChapterError({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        message: err instanceof Error ? err.message : "Lỗi không xác định",
      });
    }
  }

  onAllComplete();
}
