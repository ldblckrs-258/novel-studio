import { create } from "zustand";
import type { AnalysisError, AnalysisPhase } from "@/lib/analysis";
import type { IncrementalResultSummary } from "@/lib/analysis/incremental-analyzer";

type PhaseResult = "pending" | "running" | "done" | "skipped" | "error";

interface PhaseResults {
  chapters: PhaseResult;
  aggregation: PhaseResult;
  characters: PhaseResult;
}

interface EnabledSteps {
  chapters: boolean;
  aggregation: boolean;
  characters: boolean;
}

const DEFAULT_PHASE_RESULTS: PhaseResults = {
  chapters: "pending",
  aggregation: "pending",
  characters: "pending",
};

const DEFAULT_ENABLED_STEPS: EnabledSteps = {
  chapters: true,
  aggregation: true,
  characters: true,
};

interface AnalysisState {
  isAnalyzing: boolean;
  currentNovelId: string | null;
  phase: AnalysisPhase | "idle" | "error" | "completed_with_errors";
  chaptersCompleted: number;
  totalChapters: number;
  errors: AnalysisError[];
  abortController: AbortController | null;
  resultSummary: IncrementalResultSummary | null;

  // Per-phase tracking for smart retry
  failedChapterIds: string[];
  phaseResults: PhaseResults;

  // Step enable/disable (ephemeral, per-run)
  enabledSteps: EnabledSteps;

  start: (novelId: string, totalChapters: number) => void;
  updateProgress: (chaptersCompleted: number, totalChapters?: number) => void;
  setPhase: (phase: AnalysisPhase | "error" | "completed_with_errors") => void;
  addError: (error: AnalysisError) => void;
  setError: (error: string) => void;
  setResultSummary: (summary: IncrementalResultSummary) => void;
  setPhaseResult: (phase: keyof PhaseResults, result: PhaseResult) => void;
  addFailedChapterIds: (ids: string[]) => void;
  setEnabledSteps: (steps: Partial<EnabledSteps>) => void;
  cancel: () => void;
  reset: () => void;
  resetForRetry: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  isAnalyzing: false,
  currentNovelId: null,
  phase: "idle",
  chaptersCompleted: 0,
  totalChapters: 0,
  errors: [],
  abortController: null,
  resultSummary: null,
  failedChapterIds: [],
  phaseResults: { ...DEFAULT_PHASE_RESULTS },
  enabledSteps: { ...DEFAULT_ENABLED_STEPS },

  start: (novelId, totalChapters) =>
    set((state) => ({
      isAnalyzing: true,
      currentNovelId: novelId,
      phase: "chapters",
      chaptersCompleted: 0,
      totalChapters,
      errors: [],
      resultSummary: null,
      abortController: new AbortController(),
      failedChapterIds: [],
      phaseResults: {
        chapters: state.enabledSteps.chapters ? "running" : "skipped",
        aggregation: state.enabledSteps.aggregation ? "pending" : "skipped",
        characters: state.enabledSteps.characters ? "pending" : "skipped",
      },
    })),

  updateProgress: (chaptersCompleted, totalChapters) => {
    const state = get();
    // Only increase — concurrent batch workers can report out of order
    if (chaptersCompleted < state.chaptersCompleted) return;
    const update: Partial<AnalysisState> = { chaptersCompleted };
    if (totalChapters !== undefined) update.totalChapters = totalChapters;
    set(update);
  },

  setPhase: (phase) => set({ phase }),

  addError: (error) =>
    set((state) => ({ errors: [...state.errors, error] })),

  setError: (error) =>
    set({
      errors: [{ phase: "unknown", message: error }],
      phase: "error",
      isAnalyzing: false,
    }),

  setResultSummary: (summary) => set({ resultSummary: summary }),

  setPhaseResult: (phase, result) =>
    set((state) => ({
      phaseResults: { ...state.phaseResults, [phase]: result },
    })),

  addFailedChapterIds: (ids) =>
    set((state) => ({
      failedChapterIds: [...state.failedChapterIds, ...ids],
    })),

  setEnabledSteps: (steps) =>
    set((state) => ({
      enabledSteps: { ...state.enabledSteps, ...steps },
    })),

  cancel: () => {
    const { abortController } = get();
    abortController?.abort();
    set({ isAnalyzing: false, phase: "idle", abortController: null });
  },

  reset: () =>
    set({
      isAnalyzing: false,
      currentNovelId: null,
      phase: "idle",
      chaptersCompleted: 0,
      totalChapters: 0,
      errors: [],
      resultSummary: null,
      abortController: null,
      failedChapterIds: [],
      phaseResults: { ...DEFAULT_PHASE_RESULTS },
    }),

  // Reset for retry: clear progress but KEEP phaseResults + failedChapterIds
  resetForRetry: () =>
    set((state) => ({
      isAnalyzing: true,
      phase: "chapters",
      chaptersCompleted: 0,
      errors: [],
      resultSummary: null,
      abortController: new AbortController(),
      // Keep these for retry targeting
      failedChapterIds: state.failedChapterIds,
      phaseResults: state.phaseResults,
    })),
}));

export type { PhaseResult, PhaseResults, EnabledSteps };
