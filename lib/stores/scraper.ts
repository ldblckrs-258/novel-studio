import { create } from "zustand";
import { detectAdapter } from "../scraper/adapters";
import { scrapeChapters } from "../scraper/engine";
import { extensionFetch, isExtensionAvailable } from "../scraper/extension-bridge";
import type {
  ChapterContent,
  NovelInfo,
  SiteAdapter,
} from "../scraper/types";

export type ScraperStep = "url" | "select" | "scraping" | "preview";

export interface DebugLog {
  timestamp: string;
  label: string;
  data: string;
}

interface ScraperState {
  step: ScraperStep;
  url: string;
  adapter: SiteAdapter | null;
  extensionAvailable: boolean | null;
  novelInfo: NovelInfo | null;
  selectedChapterUrls: Set<string>;
  scrapedChapters: ChapterContent[];
  progress: { completed: number; total: number; current: string };
  isLoading: boolean;
  error: string | null;
  abortController: AbortController | null;
  debugLogs: DebugLog[];

  // Actions
  setUrl: (url: string) => void;
  setAdapter: (adapter: SiteAdapter | null) => void;
  checkExtension: () => Promise<void>;
  fetchNovelInfo: () => Promise<void>;
  toggleChapter: (url: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  startScraping: () => Promise<void>;
  retryScrapeChapter: (index: number) => Promise<void>;
  abortScraping: () => void;
  setStep: (step: ScraperStep) => void;
  reset: () => void;
  clearDebugLogs: () => void;
}

const initialState = {
  step: "url" as ScraperStep,
  url: "",
  adapter: null as SiteAdapter | null,
  extensionAvailable: null as boolean | null,
  novelInfo: null as NovelInfo | null,
  selectedChapterUrls: new Set<string>(),
  scrapedChapters: [] as ChapterContent[],
  progress: { completed: 0, total: 0, current: "" },
  isLoading: false,
  error: null as string | null,
  abortController: null as AbortController | null,
  debugLogs: [] as DebugLog[],
};

function addLog(label: string, data: unknown) {
  const log: DebugLog = {
    timestamp: new Date().toLocaleTimeString(),
    label,
    data: typeof data === "string" ? data : JSON.stringify(data, null, 2),
  };
  const prev = useScraperStore.getState().debugLogs;
  useScraperStore.setState({ debugLogs: [...prev, log] });
}

export const useScraperStore = create<ScraperState>((set, get) => ({
  ...initialState,

  setUrl: (url) => {
    const adapter = detectAdapter(url);
    // Only auto-detect if no manual override or URL changed domain
    const current = get().adapter;
    set({ url, adapter: adapter ?? current, error: null });
  },

  setAdapter: (adapter) => {
    set({ adapter });
  },

  checkExtension: async () => {
    const available = await isExtensionAvailable();
    set({ extensionAvailable: available });
  },

  fetchNovelInfo: async () => {
    const { url, adapter } = get();
    if (!adapter) {
      set({ error: "Không tìm thấy adapter cho URL này" });
      return;
    }

    set({ isLoading: true, error: null, debugLogs: [] });
    try {
      addLog("Fetching", url);
      const { html, logs } = await extensionFetch(url);
      if (logs?.length) addLog("Extension", logs.join("\n"));
      const novelInfo = adapter.getNovelInfo(html, url);

      addLog("NovelInfo", {
        title: novelInfo.title,
        author: novelInfo.author,
        chapterCount: novelInfo.chapters.length,
      });

      if (novelInfo.chapters.length === 0) {
        addLog("⚠ No chapters found", "Kiểm tra adapter hoặc URL");
        set({ error: "Không tìm thấy chương nào", isLoading: false });
        return;
      }

      const selectedChapterUrls = new Set(
        novelInfo.chapters.map((ch) => ch.url),
      );

      set({
        novelInfo,
        selectedChapterUrls,
        isLoading: false,
        step: "select",
      });
    } catch (err) {
      addLog("✗ Error", err instanceof Error ? err.message : String(err));
      set({
        error:
          err instanceof Error ? err.message : "Lỗi khi lấy thông tin truyện",
        isLoading: false,
      });
    }
  },

  toggleChapter: (url) => {
    const selected = new Set(get().selectedChapterUrls);
    if (selected.has(url)) selected.delete(url);
    else selected.add(url);
    set({ selectedChapterUrls: selected });
  },

  selectAll: () => {
    const chapters = get().novelInfo?.chapters ?? [];
    set({ selectedChapterUrls: new Set(chapters.map((ch) => ch.url)) });
  },

  deselectAll: () => {
    set({ selectedChapterUrls: new Set() });
  },

  startScraping: async () => {
    const { novelInfo, selectedChapterUrls, adapter } = get();
    if (!novelInfo || !adapter) return;

    const selectedChapters = novelInfo.chapters.filter((ch) =>
      selectedChapterUrls.has(ch.url),
    );
    if (selectedChapters.length === 0) return;

    const abortController = new AbortController();
    set({
      step: "scraping",
      isLoading: true,
      error: null,
      scrapedChapters: [],
      progress: { completed: 0, total: selectedChapters.length, current: "" },
      abortController,
    });

    try {
      await scrapeChapters(
        selectedChapters,
        adapter,
        (completed, total, currentTitle) => {
          set({ progress: { completed, total, current: currentTitle } });
        },
        abortController.signal,
        (entry) => {
          // Push chapter to store immediately for live UI updates
          const prev = get().scrapedChapters;
          set({ scrapedChapters: [...prev, entry.parsed] });

          const info: Record<string, unknown> = {
            len: entry.parsed.content.length,
          };
          if (entry.parsed.warning) info.warning = entry.parsed.warning;
          if (entry.extensionLogs?.length) info.ext = entry.extensionLogs.join("\n");
          addLog(`Ch: ${entry.chapterTitle}`, info);
        },
      );

      set({
        isLoading: false,
        step: "preview",
        abortController: null,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        set({ isLoading: false, error: "Đã hủy scraping", abortController: null });
        return;
      }
      set({
        error: err instanceof Error ? err.message : "Lỗi khi scrape",
        isLoading: false,
        abortController: null,
      });
    }
  },

  retryScrapeChapter: async (index) => {
    const { novelInfo, scrapedChapters, adapter } = get();
    if (!novelInfo || !adapter) return;

    // Find the original chapter link by matching index to selected chapters
    const selectedUrls = get().selectedChapterUrls;
    const selectedChapters = novelInfo.chapters.filter((ch) => selectedUrls.has(ch.url));
    const chapterLink = selectedChapters[index];
    if (!chapterLink) return;

    addLog(`Retry: ${chapterLink.title}`, "Re-scraping...");
    try {
      const { html, contentText } = await extensionFetch(
        chapterLink.url,
        adapter.chapterWaitSelector,
        adapter.chapterClickSelector,
      );
      const content = adapter.getChapterContent(html, chapterLink.url, contentText);
      if (content.content.length < 1000) {
        content.warning = `Nội dung quá ngắn (${content.content.length} ký tự) — có thể chưa load được`;
      }
      const updated = [...scrapedChapters];
      updated[index] = content;
      set({ scrapedChapters: updated });
      addLog(`Retry: ${chapterLink.title}`, {
        len: content.content.length,
        warning: content.warning || null,
      });
    } catch (err) {
      addLog(`Retry failed: ${chapterLink.title}`, err instanceof Error ? err.message : String(err));
    }
  },

  abortScraping: () => {
    get().abortController?.abort();
  },

  setStep: (step) => set({ step }),

  reset: () => set({ ...initialState, debugLogs: [] }),

  clearDebugLogs: () => set({ debugLogs: [] }),
}));
