import type { WritingAgentRole } from "@/lib/db";
import { create } from "zustand";

interface WritingPipelineState {
  activeSessionId: string | null;
  isRunning: boolean;
  abortController: AbortController | null;
  activePanel: "context" | "pipeline" | "outline" | "content" | "review";
  streamingContent: string;
  /** Smart writer: human-readable status (tool lookup vs generating text). */
  writerActivityLabel: string;
  /** Ephemeral per-step user instructions (not persisted). Keys: wizard steps, agent roles, or "generate-more-plans". */
  stepUserInstructions: Record<string, string>;
  /** When set, show pipeline step config UI before running this role (after re-run). */
  pipelinePreRunRole: WritingAgentRole | null;
  /** Pre-selected arc IDs for direction generation (empty = all active arcs). */
  directionArcIds: string[];
  /** Pre-selected character IDs for direction generation (empty = all characters). */
  directionCharacterIds: string[];
  /** Incremented after a successful standalone rewrite; ReviewPanel opens compare view when it sees a new value. */
  reviewCompareFocusNonce: number;

  // Actions
  startPipeline: (sessionId: string) => AbortController;
  pausePipeline: () => void;
  cancelPipeline: () => void;
  setActivePanel: (
    panel: "context" | "pipeline" | "outline" | "content" | "review",
  ) => void;
  appendStreamingContent: (chunk: string) => void;
  clearStreamingContent: () => void;
  setWriterActivityLabel: (label: string) => void;
  clearWriterActivityLabel: () => void;
  setStepUserInstruction: (key: string, value: string) => void;
  setPipelinePreRunRole: (role: WritingAgentRole | null) => void;
  setDirectionArcIds: (ids: string[]) => void;
  setDirectionCharacterIds: (ids: string[]) => void;
  requestReviewCompareFocus: () => void;
  reset: () => void;
}

export const useWritingPipelineStore = create<WritingPipelineState>(
  (set, get) => ({
    activeSessionId: null,
    isRunning: false,
    abortController: null,
    activePanel: "context",
    streamingContent: "",
    writerActivityLabel: "",
    stepUserInstructions: {},
    pipelinePreRunRole: null,
    directionArcIds: [],
    directionCharacterIds: [],
    reviewCompareFocusNonce: 0,

    startPipeline: (sessionId) => {
      const controller = new AbortController();
      set({
        activeSessionId: sessionId,
        isRunning: true,
        abortController: controller,
        streamingContent: "",
        writerActivityLabel: "",
      });
      return controller;
    },

    pausePipeline: () => {
      const { abortController } = get();
      abortController?.abort();
      set({
        isRunning: false,
        abortController: null,
        writerActivityLabel: "",
      });
    },

    cancelPipeline: () => {
      const { abortController } = get();
      abortController?.abort();
      set({
        isRunning: false,
        abortController: null,
        activeSessionId: null,
        streamingContent: "",
        writerActivityLabel: "",
      });
    },

    setActivePanel: (panel) => set({ activePanel: panel }),

    appendStreamingContent: (chunk) =>
      set((state) => ({
        streamingContent: state.streamingContent + chunk,
      })),

    clearStreamingContent: () => set({ streamingContent: "" }),

    setWriterActivityLabel: (label) => set({ writerActivityLabel: label }),

    clearWriterActivityLabel: () => set({ writerActivityLabel: "" }),

    setStepUserInstruction: (key, value) =>
      set((state) => ({
        stepUserInstructions: { ...state.stepUserInstructions, [key]: value },
      })),

    setPipelinePreRunRole: (role) => set({ pipelinePreRunRole: role }),

    setDirectionArcIds: (ids) => set({ directionArcIds: ids }),
    setDirectionCharacterIds: (ids) => set({ directionCharacterIds: ids }),

    requestReviewCompareFocus: () =>
      set((s) => ({ reviewCompareFocusNonce: s.reviewCompareFocusNonce + 1 })),

    reset: () =>
      set({
        activeSessionId: null,
        isRunning: false,
        abortController: null,
        activePanel: "context",
        streamingContent: "",
        writerActivityLabel: "",
        stepUserInstructions: {},
        pipelinePreRunRole: null,
        directionArcIds: [],
        directionCharacterIds: [],
        reviewCompareFocusNonce: 0,
      }),
  }),
);
