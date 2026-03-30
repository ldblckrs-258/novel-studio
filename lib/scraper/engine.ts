import { extensionFetch } from "./extension-bridge";
import type { ChapterContent, ChapterLink, SiteAdapter } from "./types";

export interface ScrapeDebugEntry {
  chapterTitle: string;
  url: string;
  htmlLength: number;
  parsed: ChapterContent;
  extensionLogs?: string[];
}

/**
 * Scrape selected chapters sequentially through the extension.
 */
export async function scrapeChapters(
  chapters: ChapterLink[],
  adapter: SiteAdapter,
  onProgress?: (completed: number, total: number, currentTitle: string) => void,
  signal?: AbortSignal,
  onDebug?: (entry: ScrapeDebugEntry) => void,
): Promise<ChapterContent[]> {
  const results: ChapterContent[] = [];

  for (let i = 0; i < chapters.length; i++) {
    signal?.throwIfAborted();

    const chapter = chapters[i];
    onProgress?.(i, chapters.length, chapter.title);

    const { html, contentText, timedOut, logs } = await extensionFetch(
      chapter.url,
      adapter.chapterWaitSelector,
      adapter.chapterClickSelector,
    );
    const content = adapter.getChapterContent(html, chapter.url, contentText);
    if (timedOut) {
      content.warning = `Timeout — nội dung chưa load được (${content.content.length} ký tự)`;
    } else if (content.content.length < 1000) {
      content.warning = `Nội dung quá ngắn (${content.content.length} ký tự)`;
    }
    results.push(content);

    onDebug?.({
      chapterTitle: chapter.title,
      url: chapter.url,
      htmlLength: html.length,
      parsed: content,
      extensionLogs: logs,
    });

    // Stop if 3 consecutive chapters have warnings
    if (results.length >= 3) {
      const lastThree = results.slice(-3);
      if (lastThree.every((ch) => ch.warning)) {
        throw new Error(
          "Đã dừng: 3 chương liên tiếp không load được nội dung. Vui lòng mở trang gốc để đảm bảo trang truyện không bị lỗi.",
        );
      }
    }

    if (i < chapters.length - 1) {
      await delay(300);
    }
  }

  onProgress?.(chapters.length, chapters.length, "");
  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
