import { create } from "zustand";
import type { Sentence } from "@/lib/tts/providers/types";
import type { TTSSettings } from "@/lib/db";
import { Player } from "@/lib/tts/player";
import { getProvider } from "@/lib/tts/providers/registry";
import { updateTTSSettings } from "@/lib/hooks/use-tts-settings";
// Side-effect: ensure all providers are registered
import { tokenizeSentences } from "@/lib/tts";

export const PANEL_MIN_WIDTH = 280;
export const PANEL_MAX_WIDTH = 700;

const WIDTH_STORAGE_KEY = "reader-panel-width";

function loadWidth(): number {
  if (typeof window === "undefined") return 360;
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (raw) {
      const w = Number(raw);
      if (!Number.isNaN(w))
        return Math.max(PANEL_MIN_WIDTH, Math.min(w, PANEL_MAX_WIDTH));
    }
  } catch {
    // ignore
  }
  return 360;
}

function saveWidth(width: number) {
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Singleton Player instance (created lazily on first play)
// ---------------------------------------------------------------------------

let player: Player | null = null;

function getPlayer(): Player {
  if (!player) {
    player = new Player();
  }
  return player;
}

/**
 * Configure the player with TTS settings from Dexie.
 */
function configurePlayer(
  p: Player,
  settings: Pick<
    TTSSettings,
    "providerId" | "voiceId" | "rate" | "pitch" | "fluencyAdjust" | "providerApiKeys"
  >,
): void {
  const { providerId, voiceId, rate, pitch, fluencyAdjust, providerApiKeys } =
    settings;
  if (!providerId) return;

  try {
    const provider = getProvider(providerId);

    // Inject API key if the provider needs one
    if (provider.requiresApiKey && provider.setApiKey && providerApiKeys?.[providerId]) {
      provider.setApiKey(providerApiKeys[providerId]);
    }

    p.setProviderInstance(provider);
  } catch (err) {
    console.error("[TTS] Failed to set provider:", err);
    return;
  }

  const parsed = isNaN(Number(voiceId)) ? voiceId : Number(voiceId);
  p.setVoice(parsed);
  p.setRate(rate);
  p.setPitch(pitch);
  p.setFluencyEffectiveness(fluencyAdjust);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ReaderPanelState {
  // Panel
  isOpen: boolean;
  panelWidth: number;

  // Playback
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentSentenceIndex: number;
  sentences: Sentence[];

  // When true, play() is triggered automatically on the next setSentences call
  autoPlayOnLoad: boolean;

  // TTS settings snapshot (synced from Dexie by the UI)
  ttsSettings: TTSSettings;

  // Chapter context — fully owned by the store; reading page is a consumer
  novelId: string | null;
  novelTitle: string;
  chapterTitle: string;
  chapterIndex: number;
  totalChapters: number;

  // Freeform mode — plain text loaded outside of any novel (e.g. from convert page)
  freeformTitle: string;

  // --- Panel actions ---
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;

  // --- Playback actions ---
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  jumpTo: (index: number) => void;
  setSentences: (sentences: Sentence[]) => void;
  setCurrentSentenceIndex: (index: number) => void;

  // --- Settings actions ---
  syncSettings: (settings: TTSSettings) => void;
  updateSettings: (partial: Partial<Omit<TTSSettings, "id">>) => void;

  // --- Chapter navigation (store is the single source of truth) ---
  /** Called by the reading page on mount to initialise or update novel context. */
  setNovelContext: (ctx: {
    novelId: string;
    novelTitle: string;
    totalChapters: number;
    /** Provide only when the store should be reset to a specific chapter (e.g. novel change). */
    chapterIndex?: number;
  }) => void;
  /** Called by the reading page to keep the displayed chapter title in sync. */
  setChapterTitle: (title: string) => void;
  /**
   * Navigate to a chapter.
   * Stops the current playback, updates chapterIndex, and optionally
   * schedules auto-play for when the new chapter's sentences arrive.
   */
  navigateTo: (index: number, opts?: { autoPlay?: boolean }) => void;
  nextChapter: () => void;
  prevChapter: () => void;

  /**
   * Load arbitrary text into the reader (freeform mode).
   * Clears novel context, tokenises the text, and opens the panel.
   */
  loadText: (text: string, title?: string) => void;
}

const DEFAULT_TTS: TTSSettings = {
  id: "default",
  providerId: "GoogleCloudTTS",
  voiceId: "0",
  rate: 1.0,
  pitch: 1.0,
  highlightColor: "#dbeafe",
  fluencyAdjust: 1.0,
  providerApiKeys: {},
};

export const useReaderPanel = create<ReaderPanelState>((set, get) => ({
  isOpen: false,
  panelWidth: loadWidth(),
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  currentSentenceIndex: 0,
  sentences: [],
  autoPlayOnLoad: false,
  ttsSettings: DEFAULT_TTS,
  novelId: null,
  novelTitle: "",
  chapterTitle: "",
  chapterIndex: 0,
  totalChapters: 0,
  freeformTitle: "",

  // --- Panel ---

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  setOpen: (open) => set({ isOpen: open }),

  setPanelWidth: (width) => {
    const clamped = Math.max(PANEL_MIN_WIDTH, Math.min(width, PANEL_MAX_WIDTH));
    if (clamped !== get().panelWidth) {
      saveWidth(clamped);
      set({ panelWidth: clamped });
    }
  },

  // --- Playback ---

  play: () => {
    const { sentences, currentSentenceIndex, ttsSettings } = get();
    if (sentences.length === 0) return;

    const p = getPlayer();

    p.setCallbacks({
      onSentenceStart: (index) => {
        set({ currentSentenceIndex: index, isLoading: true });
      },
      onAudioPlay: () => {
        set({ isLoading: false });
      },
      onPlayStateChange: (state) => {
        switch (state) {
          case "playing":
            set({ isPlaying: true, isPaused: false });
            break;
          case "paused":
            set({ isPlaying: false, isPaused: true, isLoading: false });
            break;
          case "stopped":
            set({ isPlaying: false, isPaused: false, isLoading: false });
            break;
        }
      },
      onFinish: () => {
        set({ isPlaying: false, isPaused: false, isLoading: false, currentSentenceIndex: 0 });
        // Auto-advance to the next chapter if available
        const { chapterIndex, totalChapters } = get();
        if (totalChapters > 0 && chapterIndex < totalChapters - 1) {
          get().navigateTo(chapterIndex + 1, { autoPlay: true });
        }
      },
      onError: (err) => {
        console.error("[TTS] Playback error:", err);
        set({ isPlaying: false, isPaused: false, isLoading: false });
      },
    });

    configurePlayer(p, ttsSettings);
    set({ isLoading: true, isPlaying: true, isPaused: false });
    p.start(sentences, currentSentenceIndex);
  },

  pause: () => {
    player?.pause();
    set({ isPlaying: false, isPaused: true });
  },

  resume: () => {
    player?.resume();
    set({ isPlaying: true, isPaused: false });
  },

  stop: () => {
    player?.stop();
    set({ isPlaying: false, isPaused: false, isLoading: false, currentSentenceIndex: 0 });
  },

  jumpTo: (index) => {
    const { sentences, isPlaying } = get();
    if (index < 0 || index >= sentences.length) return;
    set({ currentSentenceIndex: index });
    if (isPlaying && player) {
      player.jumpTo(index);
    }
  },

  setSentences: (sentences) => {
    const { isPlaying, isPaused, autoPlayOnLoad } = get();

    if (isPlaying || isPaused) {
      // Player is running — update sentences but preserve playback position
      set({ sentences });
      return;
    }

    set({ sentences, currentSentenceIndex: 0 });

    if (autoPlayOnLoad && sentences.length > 0) {
      set({ autoPlayOnLoad: false });
      // Defer to ensure we're outside any React render cycle
      setTimeout(() => get().play(), 0);
    }
  },

  setCurrentSentenceIndex: (index) => set({ currentSentenceIndex: index }),

  // --- Settings ---

  /** Called by the UI component to keep the store in sync with Dexie data. */
  syncSettings: (settings) => set({ ttsSettings: settings }),

  /** Persist partial settings update to Dexie (async, fire-and-forget). */
  updateSettings: (partial) => {
    const next = { ...get().ttsSettings, ...partial };
    set({ ttsSettings: next });
    updateTTSSettings(partial);

    // Live-update player if currently playing
    if (player && get().isPlaying) {
      configurePlayer(player, next);
    }
  },

  // --- Chapter navigation ---

  setNovelContext: ({ novelId, novelTitle, totalChapters, chapterIndex }) => {
    const current = get();
    const isNewNovel = current.novelId !== novelId;
    set({
      novelId,
      novelTitle,
      totalChapters,
      freeformTitle: "",
      // Only reset chapter index when switching to a different novel
      ...(isNewNovel && chapterIndex !== undefined ? { chapterIndex } : {}),
    });
  },

  setChapterTitle: (title) => set({ chapterTitle: title }),

  navigateTo: (index, opts) => {
    const { isPlaying, totalChapters } = get();
    if (index < 0 || (totalChapters > 0 && index >= totalChapters)) return;

    const autoPlay = opts?.autoPlay ?? isPlaying;

    player?.stop();
    set({
      isPlaying: false,
      isPaused: false,
      isLoading: false,
      currentSentenceIndex: 0,
      chapterIndex: index,
      autoPlayOnLoad: autoPlay,
      // Ensure panel is open so SentenceRenderer can mount and trigger playback
      ...(autoPlay ? { isOpen: true } : {}),
    });
  },

  nextChapter: () => {
    const { chapterIndex, totalChapters } = get();
    if (totalChapters > 0 && chapterIndex < totalChapters - 1) {
      get().navigateTo(chapterIndex + 1);
    }
  },

  prevChapter: () => {
    const { chapterIndex } = get();
    if (chapterIndex > 0) {
      get().navigateTo(chapterIndex - 1);
    }
  },

  loadText: (text, title = "") => {
    const sentences = tokenizeSentences(text);
    player?.stop();
    set({
      novelId: null,
      novelTitle: "",
      chapterTitle: "",
      totalChapters: 0,
      chapterIndex: 0,
      freeformTitle: title,
      sentences,
      currentSentenceIndex: 0,
      isPlaying: false,
      isPaused: false,
      isLoading: false,
      autoPlayOnLoad: false,
      isOpen: true,
    });
  },
}));
