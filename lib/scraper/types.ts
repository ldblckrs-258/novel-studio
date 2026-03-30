// ─── Site Adapter ──────────────────────────────────────────

export interface SiteAdapter {
  /** Display name, e.g. "Sáng Tác Việt" */
  name: string;
  /** Regex to auto-detect adapter from URL */
  urlPattern: RegExp;
  /** CSS selector to wait for before extracting chapter HTML (AJAX content) */
  chapterWaitSelector?: string;
  /** CSS selector to click after page load to trigger content loading */
  chapterClickSelector?: string;
  /** Parse novel page HTML → novel info + chapter list */
  getNovelInfo(html: string, url: string): NovelInfo;
  /** Parse chapter page HTML → chapter content. contentText is innerText from live DOM (bypasses font obfuscation). */
  getChapterContent(html: string, url: string, contentText?: string): ChapterContent;
}

// ─── Data Types ────────────────────────────────────────────

export interface NovelInfo {
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  chapters: ChapterLink[];
}

export interface ChapterLink {
  title: string;
  url: string;
  order: number;
}

export interface ChapterContent {
  title: string;
  /** Plain text content */
  content: string;
  /** Warning message if content may be incomplete */
  warning?: string;
}

export interface ScrapeProgress {
  completed: number;
  total: number;
  currentTitle: string;
}
