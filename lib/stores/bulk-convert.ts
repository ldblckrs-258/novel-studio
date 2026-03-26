import { create } from "zustand";

export type ChapterConvertStatus =
  | "pending"
  | "converting"
  | "done"
  | "error";

export interface ConvertChapterResult {
  chapterId: string;
  chapterTitle: string;
  originalLineCount: number;
  convertedLineCount: number;
  scenes: { sceneId: string; content: string }[];
}

export interface ConvertError {
  chapterId: string;
  chapterTitle: string;
  message: string;
}

interface BulkConvertState {
  step: "config" | "progress" | "results";
  isRunning: boolean;
  chapterIds: string[];

  // Progress
  statuses: Map<string, ChapterConvertStatus>;
  currentChapterId: string | null;
  chaptersCompleted: number;
  totalChapters: number;

  // Results
  results: Map<string, ConvertChapterResult>;
  errors: ConvertError[];
  savedChapterIds: Set<string>;

  // Actions
  start: (chapterIds: string[]) => void;
  setStep: (step: BulkConvertState["step"]) => void;
  setChapterStatus: (
    chapterId: string,
    status: ChapterConvertStatus,
  ) => void;
  setCurrentChapter: (chapterId: string | null) => void;
  addResult: (result: ConvertChapterResult) => void;
  addError: (error: ConvertError) => void;
  markSaved: (chapterIds: string[]) => void;
  incrementCompleted: () => void;
  finish: () => void;
  startRetry: (failedIds: string[]) => void;
  reset: () => void;
}

export const useBulkConvertStore = create<BulkConvertState>((set, get) => ({
  step: "config",
  isRunning: false,
  chapterIds: [],
  statuses: new Map(),
  currentChapterId: null,
  chaptersCompleted: 0,
  totalChapters: 0,
  results: new Map(),
  errors: [],
  savedChapterIds: new Set(),

  start: (chapterIds) => {
    const statuses = new Map<string, ChapterConvertStatus>();
    for (const id of chapterIds) statuses.set(id, "pending");
    set({
      step: "progress",
      isRunning: true,
      chapterIds,
      statuses,
      currentChapterId: null,
      chaptersCompleted: 0,
      totalChapters: chapterIds.length,
      results: new Map(),
      errors: [],
      savedChapterIds: new Set(),
    });
  },

  setStep: (step) => set({ step }),

  setChapterStatus: (chapterId, status) => {
    const statuses = new Map(get().statuses);
    statuses.set(chapterId, status);
    set({ statuses });
  },

  setCurrentChapter: (chapterId) => set({ currentChapterId: chapterId }),

  addResult: (result) => {
    const results = new Map(get().results);
    results.set(result.chapterId, result);
    set({ results });
  },

  addError: (error) => set((s) => ({ errors: [...s.errors, error] })),

  markSaved: (chapterIds) => {
    const saved = new Set(get().savedChapterIds);
    for (const id of chapterIds) saved.add(id);
    set({ savedChapterIds: saved });
  },

  incrementCompleted: () =>
    set((s) => ({ chaptersCompleted: s.chaptersCompleted + 1 })),

  finish: () => set({ isRunning: false, step: "results" }),

  startRetry: (failedIds) => {
    const { statuses, errors, results } = get();
    const newStatuses = new Map(statuses);
    for (const id of failedIds) newStatuses.set(id, "pending");
    set({
      isRunning: true,
      step: "progress",
      statuses: newStatuses,
      errors: errors.filter((e) => !failedIds.includes(e.chapterId)),
      chaptersCompleted: results.size,
    });
  },

  reset: () =>
    set({
      step: "config",
      isRunning: false,
      chapterIds: [],
      statuses: new Map(),
      currentChapterId: null,
      chaptersCompleted: 0,
      totalChapters: 0,
      results: new Map(),
      errors: [],
      savedChapterIds: new Set(),
    }),
}));
