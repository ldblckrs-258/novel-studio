import { create } from "zustand";

export type ActivePanel = "chat" | "chapter-tools" | "name-dict" | null;

interface ActivePanelState {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
}

export const useActivePanel = create<ActivePanelState>((set) => ({
  activePanel: null,
  setActivePanel: (panel) => set({ activePanel: panel }),
}));
