export { analyzeNovel, type AnalyzeNovelOptions } from "./novel-analyzer";
export {
  analyzeNovelIncremental,
  type IncrementalAnalyzeOptions,
} from "./incremental-analyzer";
export { getChaptersNeedingAnalysis } from "./incremental";
export { analyzeChapter, analyzeBatchChapters } from "./chapter-analyzer";
export {
  type AnalysisDepth,
  estimateTokens,
  getBudget,
} from "./token-budget";
export {
  type CustomPrompts,
  DEFAULT_CHAPTER_ANALYSIS_SYSTEM,
  DEFAULT_NOVEL_AGGREGATION_SYSTEM,
  DEFAULT_CHARACTER_PROFILING_SYSTEM,
} from "./prompts";
export type {
  ChapterAnalysisResult,
  ChapterSceneResult,
  ChapterCharacterMention,
  NovelAggregationResult,
  CharacterProfileResult,
  CharacterProfilingResult,
  AnalysisPhase,
  AnalysisProgress,
  AnalysisError,
  SkipPhases,
} from "./types";
