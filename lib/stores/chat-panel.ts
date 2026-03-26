import { create } from "zustand";
import { useActivePanel } from "./active-panel";

interface ChatPanelState {
  isOpen: boolean;
  activeConversationId: string | null;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setActiveConversation: (id: string | null) => void;
}

export const useChatPanel = create<ChatPanelState>((set) => ({
  isOpen: false,
  activeConversationId: null,
  toggle: () =>
    set((s) => {
      const next = !s.isOpen;
      useActivePanel.getState().setActivePanel(next ? "chat" : null);
      return { isOpen: next };
    }),
  open: () => {
    useActivePanel.getState().setActivePanel("chat");
    set({ isOpen: true });
  },
  close: () => {
    const { activePanel } = useActivePanel.getState();
    if (activePanel === "chat") {
      useActivePanel.getState().setActivePanel(null);
    }
    set({ isOpen: false });
  },
  setActiveConversation: (id) => set({ activeConversationId: id }),
}));

// Auto-close when another panel takes over
useActivePanel.subscribe((state) => {
  if (state.activePanel !== "chat" && useChatPanel.getState().isOpen) {
    useChatPanel.setState({ isOpen: false });
  }
});
