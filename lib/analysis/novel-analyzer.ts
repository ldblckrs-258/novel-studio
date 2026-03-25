import type { LanguageModel } from "ai";
import { generateStructured } from "@/lib/ai/structured";
import { db } from "@/lib/db";
import { analyzeChapter, analyzeBatchChapters } from "./chapter-analyzer";
import {
  novelAggregationSchema,
  characterProfilingSchema,
  intermediateSummarySchema,
} from "./schemas";
import {
  type CustomPrompts,
  resolvePrompts,
  buildAggregationPrompt,
  buildCharacterPrompt,
  buildIntermediateAggregationPrompt,
} from "./prompts";
import type { AnalysisError, AnalysisProgress, ChapterAnalysisResult } from "./types";
import {
  type AnalysisDepth,
  getBudget,
  estimateTokens,
  sampleChapters,
  batchChapters,
  groupSummariesForAggregation,
  capCharacterMentions,
  type BatchItem,
} from "./token-budget";

const CONCURRENCY_LIMIT = 3;

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    runNext(),
  );
  await Promise.all(workers);
  return results;
}

export interface AnalyzeNovelOptions {
  novelId: string;
  /** Default model used when no per-step override is set */
  defaultModel: LanguageModel;
  signal?: AbortSignal;
  onProgress?: (progress: AnalysisProgress) => void;
  /** Controls the token usage vs quality trade-off. Default: "standard" */
  depth?: AnalysisDepth;
  /** Custom system prompts per analysis step. Falls back to defaults. */
  customPrompts?: CustomPrompts;
  /** Optional per-step model overrides */
  stepModels?: {
    chapters?: LanguageModel;
    aggregation?: LanguageModel;
    characters?: LanguageModel;
  };
  /** Global system instruction prepended to all analysis prompts */
  globalSystemInstruction?: string;
}

export async function analyzeNovel({
  novelId,
  defaultModel,
  signal,
  onProgress,
  depth = "standard",
  customPrompts,
  stepModels,
  globalSystemInstruction,
}: AnalyzeNovelOptions): Promise<void> {
  const budget = getBudget(depth);
  const rawPrompts = resolvePrompts(customPrompts);

  // Prepend global instruction to all system prompts
  const g = globalSystemInstruction?.trim();
  const prepend = (s: string) => (g ? `${g}\n\n${s}` : s);
  const prompts = {
    chapterAnalysis: prepend(rawPrompts.chapterAnalysis),
    batchChapterAnalysis: prepend(rawPrompts.batchChapterAnalysis),
    intermediateAggregation: prepend(rawPrompts.intermediateAggregation),
    novelAggregation: prepend(rawPrompts.novelAggregation),
    characterProfiling: prepend(rawPrompts.characterProfiling),
  };

  // Resolve per-step models (fall back to default)
  const chapterModel = stepModels?.chapters ?? defaultModel;
  const aggregationModel = stepModels?.aggregation ?? defaultModel;
  const characterModel = stepModels?.characters ?? defaultModel;

  // Load chapters and scenes
  const allChapters = await db.chapters
    .where("novelId")
    .equals(novelId)
    .sortBy("order");

  if (allChapters.length === 0) {
    throw new Error("Không tìm thấy chương nào cho tiểu thuyết này");
  }

  // Sample chapters for quick mode
  const sampled = sampleChapters(allChapters, budget.chapterSampleRate);
  const totalChapters = sampled.length;

  // Update novel analysis status
  const now = new Date();
  await db.novels.update(novelId, {
    analysisStatus: "analyzing",
    chaptersAnalyzed: 0,
    totalChapters,
    analysisError: undefined,
    updatedAt: now,
  });

  const errors: AnalysisError[] = [];

  // ── Phase 1: Chapter Analysis (with batching + truncation) ──

  const chapterContents: BatchItem[] = [];
  for (const { item: chapter, originalIndex } of sampled) {
    const scenes = await db.scenes
      .where("chapterId")
      .equals(chapter.id)
      .sortBy("order");
    const content = scenes.map((s) => s.content).join("\n\n");
    chapterContents.push({
      chapterIndex: originalIndex,
      title: chapter.title,
      content,
      tokens: estimateTokens(content),
    });
  }

  const batches = batchChapters(chapterContents, budget.batchTargetTokens);

  let chaptersCompleted = 0;
  const chapterResults: {
    chapterId: string;
    title: string;
    result: ChapterAnalysisResult;
  }[] = [];

  const batchTasks = batches.map((batch) => async () => {
    // Abort errors always propagate immediately
    signal?.throwIfAborted();

    try {
      let results: ChapterAnalysisResult[];

      if (batch.length === 1) {
        const item = batch[0];
        if (!item.content.trim()) {
          results = [
            { summary: "Chương trống", keyScenes: [], characters: [] },
          ];
        } else {
          const result = await analyzeChapter(
            chapterModel,
            item.title,
            item.content,
            signal,
            budget.maxChapterTokens,
            prompts.chapterAnalysis,
          );
          results = [result];
        }
      } else {
        const nonEmpty = batch.filter((b) => b.content.trim());
        if (nonEmpty.length === 0) {
          results = batch.map(() => ({
            summary: "Chương trống",
            keyScenes: [],
            characters: [],
          }));
        } else {
          const batchResults = await analyzeBatchChapters(
            chapterModel,
            nonEmpty.map((b) => ({ title: b.title, content: b.content })),
            signal,
            budget.maxChapterTokens,
            prompts.batchChapterAnalysis,
          );
          let resultIdx = 0;
          results = batch.map((b) => {
            if (!b.content.trim()) {
              return {
                summary: "Chương trống",
                keyScenes: [],
                characters: [],
              };
            }
            return batchResults[resultIdx++];
          });
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const chapter = allChapters[item.chapterIndex];
        const result = results[i];

        const now = new Date();
        await db.chapters.update(chapter.id, {
          summary: result.summary,
          analyzedAt: now,
          updatedAt: now,
        });

        chapterResults.push({
          chapterId: chapter.id,
          title: item.title,
          result,
        });

        chaptersCompleted++;
        onProgress?.({
          phase: "chapters",
          chaptersCompleted,
          totalChapters,
        });
        await db.novels.update(novelId, {
          chaptersAnalyzed: chaptersCompleted,
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      // Re-throw abort errors so the entire analysis stops
      if (err instanceof Error && err.name === "AbortError") throw err;

      const msg = err instanceof Error ? err.message : "Unknown error";
      const titles = batch.map((b) => b.title);
      for (const title of titles) {
        const error: AnalysisError = {
          phase: "chapters",
          chapterTitle: title,
          message: msg,
        };
        errors.push(error);
        onProgress?.({
          phase: "chapters",
          chaptersCompleted,
          totalChapters,
          error,
        });
      }
      // Count them as "processed" so progress moves forward
      chaptersCompleted += batch.length;
      onProgress?.({
        phase: "chapters",
        chaptersCompleted,
        totalChapters,
      });
    }
  });

  await runWithConcurrency(batchTasks, CONCURRENCY_LIMIT);

  // ── Phase 2: Novel Aggregation (with recursive summarization) ──
  if (chapterResults.length > 0) {
    try {
      signal?.throwIfAborted();
      onProgress?.({
        phase: "aggregation",
        chaptersCompleted: totalChapters,
        totalChapters,
      });

      const summaries = chapterResults.map((cr) => ({
        title: cr.title,
        summary: cr.result.summary,
      }));

      const groups = groupSummariesForAggregation(
        summaries,
        budget.maxAggregationTokens,
      );

      let finalSummaries = summaries;

      if (groups.length > 1) {
        const intermediateTasks = groups.map((group, gi) => async () => {
          signal?.throwIfAborted();
          const result = await generateStructured({
            model: aggregationModel,
            schema: intermediateSummarySchema,
            system: prompts.intermediateAggregation,
            prompt: buildIntermediateAggregationPrompt(group),
            abortSignal: signal,
          });
          return {
            title: `Group ${gi + 1} (chapters ${group[0].title} – ${group[group.length - 1].title})`,
            summary: result.object.summary,
          };
        });

        finalSummaries = await runWithConcurrency(
          intermediateTasks,
          CONCURRENCY_LIMIT,
        );
      }

      const aggregation = await generateStructured({
        model: aggregationModel,
        schema: novelAggregationSchema,
        system: prompts.novelAggregation,
        prompt: buildAggregationPrompt(finalSummaries),
        abortSignal: signal,
      });

      await db.novels.update(novelId, {
        genres: aggregation.object.genres,
        tags: aggregation.object.tags,
        synopsis: aggregation.object.synopsis,
        worldOverview: aggregation.object.worldOverview,
        powerSystem: aggregation.object.powerSystem ?? undefined,
        storySetting: aggregation.object.storySetting,
        timePeriod: aggregation.object.timePeriod ?? undefined,
        factions: aggregation.object.factions,
        keyLocations: aggregation.object.keyLocations,
        worldRules: aggregation.object.worldRules ?? undefined,
        technologyLevel: aggregation.object.technologyLevel ?? undefined,
        updatedAt: new Date(),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      const error: AnalysisError = {
        phase: "aggregation",
        message: err instanceof Error ? err.message : "Unknown error",
      };
      errors.push(error);
      onProgress?.({
        phase: "aggregation",
        chaptersCompleted: totalChapters,
        totalChapters,
        error,
      });
    }
  }

  // ── Phase 3: Character Profiling (with capping) ──────────
  if (chapterResults.length > 0) {
    try {
      signal?.throwIfAborted();
      onProgress?.({
        phase: "characters",
        chaptersCompleted: totalChapters,
        totalChapters,
      });

      const rawCharacterMap = new Map<string, string[]>();
      for (const cr of chapterResults) {
        for (const char of cr.result.characters) {
          const key = char.name.toLowerCase().trim();
          const existing = rawCharacterMap.get(key) ?? [];
          existing.push(
            `[${cr.title}] (${char.role}) ${char.noteInChapter}`,
          );
          rawCharacterMap.set(key, existing);
        }
      }

      const characterMap = capCharacterMentions(
        rawCharacterMap,
        budget.maxMentionsPerCharacter,
        budget.maxCharactersToProfile,
      );

      if (characterMap.size > 0) {
        const nameKeyMap = new Map<string, string>();
        for (const cr of chapterResults) {
          for (const char of cr.result.characters) {
            const key = char.name.toLowerCase().trim();
            if (!nameKeyMap.has(key) && characterMap.has(key)) {
              nameKeyMap.set(key, char.name);
            }
          }
        }

        const characterNotes: { name: string; mentions: string[] }[] = [];
        for (const [key, mentions] of characterMap.entries()) {
          characterNotes.push({
            name: nameKeyMap.get(key) ?? key,
            mentions,
          });
        }

        const profiling = await generateStructured({
          model: characterModel,
          schema: characterProfilingSchema,
          system: prompts.characterProfiling,
          prompt: buildCharacterPrompt(characterNotes),
          abortSignal: signal,
        });

        const now = new Date();
        for (const profile of profiling.object.characters) {
          const existing = await db.characters
            .where("novelId")
            .equals(novelId)
            .filter(
              (c) =>
                c.name.toLowerCase().trim() ===
                profile.name.toLowerCase().trim(),
            )
            .first();

          const charData = {
            role: profile.role,
            description: profile.description,
            age: profile.age,
            sex: profile.sex,
            appearance: profile.appearance,
            personality: profile.personality,
            hobbies: profile.hobbies,
            relationshipWithMC: profile.relationshipWithMC,
            relationships: profile.relationships,
            characterArc: profile.characterArc,
            strengths: profile.strengths,
            weaknesses: profile.weaknesses,
            motivations: profile.motivations,
            goals: profile.goals,
          };

          if (existing) {
            await db.characters.update(existing.id, {
              ...charData,
              updatedAt: now,
            });
          } else {
            await db.characters.add({
              id: crypto.randomUUID(),
              novelId,
              name: profile.name,
              ...charData,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        for (const cr of chapterResults) {
          const charNames = cr.result.characters.map((c) =>
            c.name.toLowerCase().trim(),
          );
          const charRecords = await db.characters
            .where("novelId")
            .equals(novelId)
            .filter((c) => charNames.includes(c.name.toLowerCase().trim()))
            .toArray();
          await db.chapters.update(cr.chapterId, {
            characterIds: charRecords.map((c) => c.id),
            updatedAt: new Date(),
          });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      const error: AnalysisError = {
        phase: "characters",
        message: err instanceof Error ? err.message : "Unknown error",
      };
      errors.push(error);
      onProgress?.({
        phase: "characters",
        chaptersCompleted: totalChapters,
        totalChapters,
        error,
      });
    }
  }

  // ── Mark Complete ───────────────────────────────────────
  await db.novels.update(novelId, {
    analysisStatus: "completed",
    analysisError: errors.length > 0
      ? errors.map((e) => e.chapterTitle ? `[${e.chapterTitle}] ${e.message}` : `[${e.phase}] ${e.message}`).join("; ")
      : undefined,
    updatedAt: new Date(),
  });
  onProgress?.({
    phase: "complete",
    chaptersCompleted: totalChapters,
    totalChapters,
  });
}
