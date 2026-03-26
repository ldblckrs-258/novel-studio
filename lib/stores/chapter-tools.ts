import { create } from "zustand";
import type { SceneVersionType } from "@/lib/db";
import { useActivePanel } from "./active-panel";

export type ChapterToolMode = "translate" | "review" | "edit" | "convert";

export const PANEL_MIN_WIDTH = 280;
export const PANEL_MAX_WIDTH = 700;

interface ChapterToolsState {
  // Panel state
  activeMode: ChapterToolMode | null;
  panelWidth: number;

  // Streaming state
  isStreaming: boolean;
  streamingContent: string;
  abortController: AbortController | null;

  // Review result (session-only, scoped to a specific chapter)
  reviewResult: string | null;
  reviewChapterId: string | null;

  // Completed result for diff view
  completedResult: string | null;
  completedTitle: string | null;

  // Version tracking
  pendingVersionType: SceneVersionType | null;
  setPendingVersionType: (type: SceneVersionType | null) => void;

  // Actions
  setActiveMode: (mode: ChapterToolMode | null) => void;
  setPanelWidth: (width: number) => void;
  startStreaming: () => void;
  setStreamingContent: (text: string) => void;
  finishStreaming: (result: string, title?: string) => void;
  setReviewResult: (result: string | null, chapterId?: string) => void;
  cancelStreaming: () => void;
  clearResult: () => void;
  reset: () => void;
}

export const useChapterTools = create<ChapterToolsState>((set, get) => ({
  activeMode: null,
  panelWidth: 400,
  isStreaming: false,
  streamingContent: "",
  abortController: null,
  reviewResult: null,
  reviewChapterId: null,
  completedResult: null,
  completedTitle: null,
  pendingVersionType: null,

  setPendingVersionType: (type) => set({ pendingVersionType: type }),

  setPanelWidth: (width) => {
    const clamped = Math.max(PANEL_MIN_WIDTH, Math.min(width, PANEL_MAX_WIDTH));
    if (clamped !== get().panelWidth) set({ panelWidth: clamped });
  },

  setActiveMode: (mode) => {
    useActivePanel
      .getState()
      .setActivePanel(mode ? "chapter-tools" : null);
    set({ activeMode: mode, completedResult: null, completedTitle: null, streamingContent: "" });
  },

  startStreaming: () => {
    const controller = new AbortController();
    set({
      isStreaming: true,
      streamingContent: "",
      completedResult: null,
      completedTitle: null,
      abortController: controller,
    });
  },

  setStreamingContent: (text) => set({ streamingContent: text }),

  finishStreaming: (result, title) =>
    set({
      isStreaming: false,
      streamingContent: "",
      completedResult: result,
      completedTitle: title ?? null,
      abortController: null,
    }),

  setReviewResult: (result, chapterId) =>
    set({ reviewResult: result, reviewChapterId: chapterId ?? null }),

  cancelStreaming: () => {
    const { abortController } = get();
    abortController?.abort();
    set({
      isStreaming: false,
      streamingContent: "",
      abortController: null,
    });
  },

  clearResult: () => set({ completedResult: null, completedTitle: null, streamingContent: "" }),

  reset: () =>
    set({
      activeMode: null,
      isStreaming: false,
      streamingContent: "",
      abortController: null,
      reviewResult: null,
      reviewChapterId: null,
      completedResult: null,
      completedTitle: null,
      pendingVersionType: null,
    }),
}));

// Auto-close when another panel takes over
useActivePanel.subscribe((state) => {
  const { activeMode, abortController } = useChapterTools.getState();
  if (state.activePanel !== "chapter-tools" && activeMode !== null) {
    abortController?.abort();
    useChapterTools.setState({
      activeMode: null,
      isStreaming: false,
      streamingContent: "",
      abortController: null,
    });
  }
});
