/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LanguageModel } from "ai";
import { generateText, stepCountIs } from "ai";
import { db } from "@/lib/db";
import { analyzeChapter, analyzeBatchChapters } from "./chapter-analyzer";
import { aggregationTools, characterTools } from "./incremental-tools";
import { getChaptersNeedingAnalysis } from "./incremental";
import {
  type CustomPrompts,
  resolvePrompts,
  buildCharacterPrompt,
} from "./prompts";
import {
  EMPTY_CHAPTER_RESULT,
  type AnalysisError,
  type AnalysisProgress,
  type ChapterAnalysisResult,
  type SkipPhases,
} from "./types";
import {
  type AnalysisDepth,
  getBudget,
  estimateTokens,
  batchChapters,
  capCharacterMentions,
  type BatchItem,
} from "./token-budget";
import { CONCURRENCY_LIMIT, runWithConcurrency } from "./concurrency";

// ─── Result Summary ─────────────────────────────────────────

export interface IncrementalResultSummary {
  chaptersAnalyzed: number;
  charactersAdded: number;
  charactersUpdated: number;
  relationshipsAdded: number;
  /** Names of aggregation fields that were updated */
  updatedFields: string[];
  factionsAdded: number;
  factionsUpdated: number;
  locationsAdded: number;
  locationsUpdated: number;
}

// ─── Options ────────────────────────────────────────────────

export interface IncrementalAnalyzeOptions {
  novelId: string;
  defaultModel: LanguageModel;
  signal?: AbortSignal;
  onProgress?: (progress: AnalysisProgress) => void;
  depth?: AnalysisDepth;
  customPrompts?: CustomPrompts;
  stepModels?: {
    chapters?: LanguageModel;
    aggregation?: LanguageModel;
    characters?: LanguageModel;
  };
  globalSystemInstruction?: string;
  /** When provided, only analyze these specific chapters (ignoring stale detection) */
  selectedChapterIds?: string[];
  /** Skip specific phases (for retry or user toggle) */
  skipPhases?: SkipPhases;
}

/**
 * Incremental novel analysis:
 * 1. Only analyze chapters that changed or are new
 * 2. Use tool calls to surgically update existing analysis (not regenerate)
 * 3. Use tool calls to update/add character profiles
 *
 * Returns a summary of what changed.
 */
export async function analyzeNovelIncremental({
  novelId,
  defaultModel,
  signal,
  onProgress,
  depth = "standard",
  customPrompts,
  stepModels,
  globalSystemInstruction,
  selectedChapterIds,
  skipPhases,
}: IncrementalAnalyzeOptions): Promise<IncrementalResultSummary> {
  const budget = getBudget(depth);
  const rawPrompts = resolvePrompts(customPrompts);
  const g = globalSystemInstruction?.trim();
  const prepend = (s: string) => (g ? `${g}\n\n${s}` : s);

  const chapterModel = stepModels?.chapters ?? defaultModel;
  const aggregationModel = stepModels?.aggregation ?? defaultModel;
  const characterModel = stepModels?.characters ?? defaultModel;

  // Track what changed
  const summary: IncrementalResultSummary = {
    chaptersAnalyzed: 0,
    charactersAdded: 0,
    charactersUpdated: 0,
    relationshipsAdded: 0,
    updatedFields: [],
    factionsAdded: 0,
    factionsUpdated: 0,
    locationsAdded: 0,
    locationsUpdated: 0,
  };

  // Determine which chapters need work
  let needsAnalysis: Awaited<ReturnType<typeof getChaptersNeedingAnalysis>>["needsAnalysis"];
  let upToDate: Awaited<ReturnType<typeof getChaptersNeedingAnalysis>>["upToDate"];

  if (selectedChapterIds && selectedChapterIds.length > 0) {
    const allChaptersRaw = await db.chapters
      .where("novelId")
      .equals(novelId)
      .sortBy("order");
    const selectedSet = new Set(selectedChapterIds);
    needsAnalysis = allChaptersRaw.filter((ch) => selectedSet.has(ch.id));
    upToDate = allChaptersRaw.filter((ch) => !selectedSet.has(ch.id));
  } else {
    const result = await getChaptersNeedingAnalysis(novelId);
    needsAnalysis = result.needsAnalysis;
    upToDate = result.upToDate;
  }

  const allChapters = [...upToDate, ...needsAnalysis].sort(
    (a, b) => a.order - b.order,
  );

  const now = new Date();
  const totalToAnalyze = needsAnalysis.length;

  await db.novels.update(novelId, {
    analysisStatus: "analyzing",
    chaptersAnalyzed: 0,
    totalChapters: totalToAnalyze,
    analysisError: undefined,
    updatedAt: now,
  });

  const errors: AnalysisError[] = [];

  // ── Phase 1: Analyze only changed/new chapters ──────────

  const newChapterResults: {
    chapterId: string;
    title: string;
    result: ChapterAnalysisResult;
  }[] = [];

  if (skipPhases?.chapters) {
    // Phase 1 skipped — load existing results from DB for Phase 2/3
    onProgress?.({
      phase: "chapters",
      chaptersCompleted: totalToAnalyze,
      totalChapters: totalToAnalyze,
      phaseResult: { phase: "chapters", result: "skipped" },
    });

    // Load previously analyzed chapters for downstream phases
    // Reconstruct character mentions from DB so Phase 3 can work
    const existingCharacters = await db.characters
      .where("novelId")
      .equals(novelId)
      .toArray();
    const charById = new Map(existingCharacters.map((c) => [c.id, c]));

    for (const ch of allChapters) {
      if (ch.summary && ch.analyzedAt) {
        const characters = (ch.characterIds ?? [])
          .map((id) => charById.get(id))
          .filter(Boolean)
          .map((c) => ({
            name: c!.name,
            role: c!.role ?? "unknown",
            noteInChapter: c!.description ?? "",
          }));

        newChapterResults.push({
          chapterId: ch.id,
          title: ch.title,
          result: {
            summary: ch.summary,
            keyScenes: [],
            characters,
          },
        });
      }
    }
    summary.chaptersAnalyzed = 0;
  } else if (needsAnalysis.length === 0) {
    // Nothing to analyze
    onProgress?.({
      phase: "chapters",
      chaptersCompleted: 0,
      totalChapters: 0,
      phaseResult: { phase: "chapters", result: "done" },
    });
  } else {
    const chapterContents: BatchItem[] = [];
    for (const chapter of needsAnalysis) {
      const scenes = await db.scenes
        .where("[chapterId+isActive]")
        .equals([chapter.id, 1])
        .sortBy("order");
      const content = scenes.map((s) => s.content).join("\n\n");
      chapterContents.push({
        chapterIndex: allChapters.findIndex((c) => c.id === chapter.id),
        title: chapter.title,
        content,
        tokens: estimateTokens(content),
      });
    }

    const batches = batchChapters(chapterContents, budget.batchTargetTokens);
    let chaptersCompleted = 0;

    const batchTasks = batches.map((batch) => async () => {
      signal?.throwIfAborted();

      try {
        let results: ChapterAnalysisResult[];

        if (batch.length === 1) {
          const item = batch[0];
          if (!item.content.trim()) {
            results = [EMPTY_CHAPTER_RESULT];
          } else {
            results = [
              await analyzeChapter(
                chapterModel,
                item.title,
                item.content,
                signal,
                budget.maxChapterTokens,
                prepend(rawPrompts.chapterAnalysis),
              ),
            ];
          }
        } else {
          const nonEmpty = batch.filter((b) => b.content.trim());
          if (nonEmpty.length === 0) {
            results = batch.map(() => EMPTY_CHAPTER_RESULT);
          } else {
            const batchResults = await analyzeBatchChapters(
              chapterModel,
              nonEmpty.map((b) => ({ title: b.title, content: b.content })),
              signal,
              budget.maxChapterTokens,
              prepend(rawPrompts.batchChapterAnalysis),
            );
            let resultIdx = 0;
            results = batch.map((b) => {
              if (!b.content.trim()) {
                return EMPTY_CHAPTER_RESULT;
              }
              return batchResults[resultIdx++];
            });
          }
        }

        for (let i = 0; i < batch.length; i++) {
          const item = batch[i];
          const chapter = allChapters[item.chapterIndex];
          const result = results[i];
          const ts = new Date();

          await db.chapters.update(chapter.id, {
            summary: result.summary,
            analyzedAt: ts,
            updatedAt: ts,
          });

          newChapterResults.push({
            chapterId: chapter.id,
            title: item.title,
            result,
          });

          chaptersCompleted++;
          onProgress?.({
            phase: "chapters",
            chaptersCompleted,
            totalChapters: totalToAnalyze,
          });
          await db.novels.update(novelId, {
            chaptersAnalyzed: chaptersCompleted,
            updatedAt: new Date(),
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;

        const msg = err instanceof Error ? err.message : "Unknown error";
        const chapterIds = batch.map((item) => allChapters[item.chapterIndex].id);
        for (const item of batch) {
          const error: AnalysisError = {
            phase: "chapters",
            chapterTitle: item.title,
            chapterIds,
            message: msg,
          };
          errors.push(error);
          onProgress?.({
            phase: "chapters",
            chaptersCompleted,
            totalChapters: totalToAnalyze,
            error,
          });
        }
        chaptersCompleted += batch.length;
        onProgress?.({
          phase: "chapters",
          chaptersCompleted,
          totalChapters: totalToAnalyze,
        });
      }
    });

    await runWithConcurrency(batchTasks, CONCURRENCY_LIMIT);
    summary.chaptersAnalyzed = newChapterResults.length;

    // Report Phase 1 result
    const chapterErrors = errors.filter((e) => e.phase === "chapters");
    onProgress?.({
      phase: "chapters",
      chaptersCompleted: totalToAnalyze,
      totalChapters: totalToAnalyze,
      phaseResult: {
        phase: "chapters",
        result: chapterErrors.length > 0 ? "error" : "done",
      },
    });
  }

  // ── Phase 2: Incremental aggregation via tool calls ─────
  if (skipPhases?.aggregation) {
    onProgress?.({
      phase: "aggregation",
      chaptersCompleted: totalToAnalyze,
      totalChapters: totalToAnalyze,
      phaseResult: { phase: "aggregation", result: "skipped" },
    });
  } else if (newChapterResults.length > 0) {
    try {
      signal?.throwIfAborted();
      onProgress?.({
        phase: "aggregation",
        chaptersCompleted: totalToAnalyze,
        totalChapters: totalToAnalyze,
        phaseResult: { phase: "aggregation", result: "running" },
      });

      const currentNovel = await db.novels.get(novelId);

      const newSummariesText = newChapterResults
        .map((cr) => `### ${cr.title}\n${cr.result.summary}`)
        .join("\n\n");

      const aggregationResult = await generateText({
        model: aggregationModel,
        system: prepend(
          `Bạn là nhà phân tích văn học đang cập nhật phân tích tiểu thuyết hiện có dựa trên nội dung chương mới.

Quy tắc:
- Bạn có các công cụ để cập nhật từng phần cụ thể.
- Nếu một trường đang trống và chương mới có thông tin liên quan, hãy GỌI công cụ để điền dữ liệu.
- Nếu một trường đã có dữ liệu và chương mới bổ sung hoặc thay đổi thông tin, hãy GỌI công cụ để cập nhật.
- Nếu chương mới không ảnh hưởng đến một trường ĐÃ CÓ dữ liệu, KHÔNG gọi công cụ cho trường đó.
- Khi cập nhật synopsis, viết lại hoàn chỉnh (không chỉ thêm vào cuối), giữ hấp dẫn và không spoil.
- Khi cập nhật genres/tags, giữ lại các mục cũ vẫn đúng, thêm mới nếu cần, bỏ mục không còn phù hợp.
- Khi thêm/cập nhật phe phái hoặc địa điểm, kiểm tra xem đã tồn tại chưa trước khi thêm mới.
- Bạn có thể gọi nhiều công cụ cùng lúc.
- QUAN TRỌNG: Hãy đảm bảo gọi update_world_building nếu các trường thế giới quan đang trống.

Trả lời bằng Tiếng Việt.`,
        ),
        prompt: `## Phân tích hiện tại
${JSON.stringify(
  {
    genres: currentNovel?.genres ?? [],
    tags: currentNovel?.tags ?? [],
    synopsis: currentNovel?.synopsis ?? "",
    worldOverview: currentNovel?.worldOverview ?? "",
    powerSystem: currentNovel?.powerSystem ?? null,
    storySetting: currentNovel?.storySetting ?? "",
    timePeriod: currentNovel?.timePeriod ?? null,
    factions: currentNovel?.factions ?? [],
    keyLocations: currentNovel?.keyLocations ?? [],
    worldRules: currentNovel?.worldRules ?? null,
    technologyLevel: currentNovel?.technologyLevel ?? null,
  },
  null,
  2,
)}

## Tóm tắt chương mới
${newSummariesText}

Dựa trên các chương mới, hãy gọi các công cụ phù hợp để cập nhật phân tích. Lưu ý: nếu các trường đang trống/null và có thể điền dựa trên nội dung, hãy điền chúng.`,
        tools: aggregationTools,
        stopWhen: stepCountIs(10),
        abortSignal: signal,
      });

      // Apply aggregation tool calls — batch DB reads
      for (const step of aggregationResult.steps) {
        for (const tc of step.toolCalls as any[]) {
          const input = (tc as any).input;
          switch (tc.toolName) {
            case "update_synopsis":
              await db.novels.update(novelId, { synopsis: input.synopsis, updatedAt: new Date() });
              summary.updatedFields.push("Tóm tắt");
              break;
            case "update_genres_tags":
              await db.novels.update(novelId, { genres: input.genres, tags: input.tags, updatedAt: new Date() });
              summary.updatedFields.push("Thể loại & Nhãn");
              break;
            case "update_world_building": {
              const updates: any = { updatedAt: new Date() };
              const fields: string[] = [];
              if (input.worldOverview !== undefined) { updates.worldOverview = input.worldOverview; fields.push("Thế giới quan"); }
              if (input.powerSystem !== undefined) { updates.powerSystem = input.powerSystem ?? undefined; fields.push("Hệ thống sức mạnh"); }
              if (input.storySetting !== undefined) { updates.storySetting = input.storySetting; fields.push("Bối cảnh"); }
              if (input.timePeriod !== undefined) { updates.timePeriod = input.timePeriod ?? undefined; fields.push("Thời kỳ"); }
              if (input.worldRules !== undefined) { updates.worldRules = input.worldRules ?? undefined; fields.push("Quy luật thế giới"); }
              if (input.technologyLevel !== undefined) { updates.technologyLevel = input.technologyLevel ?? undefined; fields.push("Công nghệ"); }
              await db.novels.update(novelId, updates);
              summary.updatedFields.push(...fields);
              break;
            }
            case "add_faction": {
              const n = await db.novels.get(novelId);
              await db.novels.update(novelId, { factions: [...(n?.factions ?? []), input], updatedAt: new Date() });
              summary.factionsAdded++;
              break;
            }
            case "update_faction": {
              const n = await db.novels.get(novelId);
              const factions = (n?.factions ?? []).map((f) => f.name.toLowerCase() === input.name.toLowerCase() ? { name: f.name, description: input.description } : f);
              await db.novels.update(novelId, { factions, updatedAt: new Date() });
              summary.factionsUpdated++;
              break;
            }
            case "add_location": {
              const n = await db.novels.get(novelId);
              await db.novels.update(novelId, { keyLocations: [...(n?.keyLocations ?? []), input], updatedAt: new Date() });
              summary.locationsAdded++;
              break;
            }
            case "update_location": {
              const n = await db.novels.get(novelId);
              const locs = (n?.keyLocations ?? []).map((l) => l.name.toLowerCase() === input.name.toLowerCase() ? { name: l.name, description: input.description } : l);
              await db.novels.update(novelId, { keyLocations: locs, updatedAt: new Date() });
              summary.locationsUpdated++;
              break;
            }
          }
        }
      }

      onProgress?.({
        phase: "aggregation",
        chaptersCompleted: totalToAnalyze,
        totalChapters: totalToAnalyze,
        phaseResult: { phase: "aggregation", result: "done" },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      const error: AnalysisError = { phase: "aggregation", message: err instanceof Error ? err.message : "Unknown error" };
      errors.push(error);
      onProgress?.({
        phase: "aggregation",
        chaptersCompleted: totalToAnalyze,
        totalChapters: totalToAnalyze,
        error,
        phaseResult: { phase: "aggregation", result: "error" },
      });
    }
  }

  // ── Phase 3: Incremental character update via tool calls ──
  if (skipPhases?.characters) {
    onProgress?.({
      phase: "characters",
      chaptersCompleted: totalToAnalyze,
      totalChapters: totalToAnalyze,
      phaseResult: { phase: "characters", result: "skipped" },
    });
  } else if (newChapterResults.length > 0) {
    try {
      signal?.throwIfAborted();
      onProgress?.({
        phase: "characters",
        chaptersCompleted: totalToAnalyze,
        totalChapters: totalToAnalyze,
        phaseResult: { phase: "characters", result: "running" },
      });

      const rawCharacterMap = new Map<string, string[]>();
      for (const cr of newChapterResults) {
        for (const char of cr.result.characters) {
          const key = char.name.toLowerCase().trim();
          const existing = rawCharacterMap.get(key) ?? [];
          existing.push(`[${cr.title}] (${char.role}) ${char.noteInChapter}`);
          rawCharacterMap.set(key, existing);
        }
      }

      const characterMap = capCharacterMentions(rawCharacterMap, budget.maxMentionsPerCharacter, budget.maxCharactersToProfile);

      if (characterMap.size > 0) {
        const existingCharacters = await db.characters.where("novelId").equals(novelId).toArray();
        const existingProfilesText = existingCharacters.map((c) => `- **${c.name}** (${c.role}): ${c.description ?? "No description"}`).join("\n");

        const nameKeyMap = new Map<string, string>();
        for (const cr of newChapterResults) {
          for (const char of cr.result.characters) {
            const key = char.name.toLowerCase().trim();
            if (!nameKeyMap.has(key) && characterMap.has(key)) nameKeyMap.set(key, char.name);
          }
        }

        const characterNotes: { name: string; mentions: string[] }[] = [];
        for (const [key, mentions] of characterMap.entries()) {
          characterNotes.push({ name: nameKeyMap.get(key) ?? key, mentions });
        }

        const mentionsText = buildCharacterPrompt(characterNotes);

        const charResult = await generateText({
          model: characterModel,
          system: prepend(`Bạn là nhà phân tích văn học đang cập nhật hồ sơ nhân vật dựa trên thông tin từ các chương mới.

Quy tắc:
- Dùng add_character cho nhân vật CHƯA có trong danh sách hiện có (so sánh tên, bao gồm biệt danh/danh xưng).
- Dùng update_character cho nhân vật ĐÃ có — chỉ cập nhật trường có thông tin mới, không ghi đè trường cũ bằng giá trị kém hơn.
- Dùng add_relationship khi phát hiện mối quan hệ mới giữa hai nhân vật.
- KHÔNG tạo lại nhân vật đã có. KHÔNG gọi công cụ nếu không có thông tin mới.
- Gộp nhân vật có nhiều tên gọi (biệt danh, danh xưng, họ/tên) — chọn tên đầy đủ nhất.
- Bỏ qua nhân vật nền/quần chúng không tên.

Trả lời bằng Tiếng Việt.`),
          prompt: `## Nhân vật hiện có\n${existingProfilesText || "Chưa có."}\n\n## Đề cập nhân vật mới (từ các chương vừa phân tích)\n${mentionsText}\n\nDựa trên các đề cập mới, hãy gọi các công cụ phù hợp để thêm hoặc cập nhật nhân vật.`,
          tools: characterTools,
          stopWhen: stepCountIs(10),
          abortSignal: signal,
        });

        const ts = new Date();
        for (const step of charResult.steps) {
          for (const tc of step.toolCalls as any[]) {
            const input = (tc as any).input;
            switch (tc.toolName) {
              case "add_character": {
                const existing = await db.characters.where("novelId").equals(novelId).filter((c) => c.name.toLowerCase().trim() === input.name.toLowerCase().trim()).first();
                if (!existing) {
                  await db.characters.add({
                    id: crypto.randomUUID(), novelId,
                    name: input.name, role: input.role, description: input.description,
                    age: input.age, sex: input.sex, appearance: input.appearance,
                    personality: input.personality, hobbies: input.hobbies,
                    relationshipWithMC: input.relationshipWithMC, relationships: input.relationships,
                    characterArc: input.characterArc, strengths: input.strengths,
                    weaknesses: input.weaknesses, motivations: input.motivations, goals: input.goals,
                    createdAt: ts, updatedAt: ts,
                  });
                  summary.charactersAdded++;
                }
                break;
              }
              case "update_character": {
                const char = await db.characters.where("novelId").equals(novelId).filter((c) => c.name.toLowerCase().trim() === input.name.toLowerCase().trim()).first();
                if (char) {
                  const { name: _, ...updates } = input;
                  const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
                  if (Object.keys(filtered).length > 0) {
                    await db.characters.update(char.id, { ...filtered, updatedAt: ts });
                    summary.charactersUpdated++;
                  }
                }
                break;
              }
              case "add_relationship": {
                const char = await db.characters.where("novelId").equals(novelId).filter((c) => c.name.toLowerCase().trim() === input.characterName.toLowerCase().trim()).first();
                if (char) {
                  const rels = [...(char.relationships ?? [])];
                  rels.push({ characterName: input.relatedTo, description: input.description });
                  await db.characters.update(char.id, { relationships: rels, updatedAt: ts });
                  summary.relationshipsAdded++;
                }
                break;
              }
            }
          }
        }

        for (const cr of newChapterResults) {
          const charNames = cr.result.characters.map((c) => c.name.toLowerCase().trim());
          const charRecords = await db.characters.where("novelId").equals(novelId).filter((c) => charNames.includes(c.name.toLowerCase().trim())).toArray();
          await db.chapters.update(cr.chapterId, { characterIds: charRecords.map((c) => c.id), updatedAt: new Date() });
        }
      }

      onProgress?.({
        phase: "characters",
        chaptersCompleted: totalToAnalyze,
        totalChapters: totalToAnalyze,
        phaseResult: { phase: "characters", result: "done" },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      const error: AnalysisError = { phase: "characters", message: err instanceof Error ? err.message : "Unknown error" };
      errors.push(error);
      onProgress?.({
        phase: "characters",
        chaptersCompleted: totalToAnalyze,
        totalChapters: totalToAnalyze,
        error,
        phaseResult: { phase: "characters", result: "error" },
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
    chaptersCompleted: totalToAnalyze,
    totalChapters: totalToAnalyze,
  });

  return summary;
}
