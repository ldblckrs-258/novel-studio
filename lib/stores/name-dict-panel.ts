import { create } from "zustand";
import { useActivePanel } from "./active-panel";

export type ScopeFilter = "all" | "novel" | "global";

interface NameDictPanelState {
  isOpen: boolean;
  activeNovelId: string | null;
  searchQuery: string;
  categoryFilter: string | null;
  scopeFilter: ScopeFilter;

  toggle: (novelId?: string | null) => void;
  open: (novelId: string) => void;
  close: () => void;
  setNovelId: (novelId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: string | null) => void;
  setScopeFilter: (scope: ScopeFilter) => void;
}

export const useNameDictPanel = create<NameDictPanelState>((set, get) => ({
  isOpen: false,
  activeNovelId: null,
  searchQuery: "",
  categoryFilter: null,
  scopeFilter: "all" as ScopeFilter,

  toggle: (novelId) => {
    const next = !get().isOpen;
    if (next) {
      useActivePanel.getState().setActivePanel("name-dict");
      if (novelId) set({ isOpen: true, activeNovelId: novelId });
      else set({ isOpen: true });
    } else {
      const { activePanel } = useActivePanel.getState();
      if (activePanel === "name-dict") {
        useActivePanel.getState().setActivePanel(null);
      }
      set({ isOpen: false });
    }
  },

  open: (novelId) => {
    useActivePanel.getState().setActivePanel("name-dict");
    set({ isOpen: true, activeNovelId: novelId, searchQuery: "", categoryFilter: null, scopeFilter: "all" });
  },

  close: () => {
    const { activePanel } = useActivePanel.getState();
    if (activePanel === "name-dict") {
      useActivePanel.getState().setActivePanel(null);
    }
    set({ isOpen: false });
  },

  setNovelId: (novelId) => set({ activeNovelId: novelId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCategoryFilter: (category) => set({ categoryFilter: category }),
  setScopeFilter: (scope) => set({ scopeFilter: scope }),
}));

// Auto-close when another panel takes over
useActivePanel.subscribe((state) => {
  if (state.activePanel !== "name-dict" && useNameDictPanel.getState().isOpen) {
    useNameDictPanel.setState({ isOpen: false });
  }
});
