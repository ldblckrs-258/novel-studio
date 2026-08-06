import type { ChapterLink, SiteAdapter } from "../types";

export const AliceSWAdapter: SiteAdapter = {
  name: "爱丽丝书屋(AliceSW)",
  urlPattern: /alicesw\.(?:com|tw|cc)/i,
  chapterWaitSelector: ".j_readContent",

  getChapterListApiUrl(url) {
    const id = url.match(/\/novel\/(\d+)\.html/)?.[1];
    if (!id) return null;
    const origin = getOrigin(url);
    return `${origin}/other/chapters/id/${id}.html`;
  },

  getNovelInfo(html, url, apiText) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const base = new URL(url);
    const origin = base.origin;

    const isListPage = !!doc.querySelector("ul.mulu_list");
    const listHtml = isListPage ? html : apiText;

    let title = "";
    let author: string | undefined;
    let description: string | undefined;
    let coverImage: string | undefined;
    let chapters: ChapterLink[] = [];

    if (isListPage) {
      title = cleanText(doc.querySelector(".mu_h1 h1")?.textContent);
      author =
        cleanText(doc.querySelector(".infos span a")?.textContent) || undefined;
      chapters = parseChapterListHtml(doc, origin);
    } else {
      title =
        cleanText(doc.querySelector(".novel_title")?.textContent) ||
        doc.querySelector("title")?.textContent?.split("-")[0]?.trim() ||
        "";

      const infoEls = [...doc.querySelectorAll(".novel_info p")];
      const authorEl = infoEls
        .map((p) => p.querySelector("a"))
        .find((a) => a?.closest("p")?.textContent?.includes("作 者"));
      author = cleanText(authorEl?.textContent) || undefined;

      const coverEl =
        doc.querySelector("img.lazyload_book_cover") ??
        doc.querySelector(".pic img") ??
        doc.querySelector('meta[property="og:image"]');
      const rawCover =
        coverEl?.getAttribute("src") || coverEl?.getAttribute("content");
      if (rawCover) coverImage = new URL(rawCover, base).href;

      const rawDesc = cleanText(doc.querySelector(".jianjie p")?.textContent);
      if (rawDesc) description = rawDesc;

      if (listHtml) {
        const listDoc = new DOMParser().parseFromString(listHtml, "text/html");
        chapters = parseChapterListHtml(listDoc, origin);
      } else {
        chapters = [
          ...doc.querySelectorAll(".book_newchap .con li a[href]"),
        ].map((a, i) => ({
          title: cleanText(a.textContent) || `Chương ${i + 1}`,
          url: new URL(a.getAttribute("href") ?? "", base).href,
          order: i,
        }));
      }
    }

    return { title, author, description, coverImage, chapters };
  },

  getChapterContent(html, _url, contentText) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const chapterTitle =
      cleanText(doc.querySelector("h3.j_chapterName")?.textContent) ||
      extractChapterTitleFromHead(html) ||
      "";

    let text = (contentText ?? "").trim();
    if (!text) {
      text = doc.querySelector(".j_readContent")?.textContent?.trim() ?? "";
    }

    text = cleanChapterText(text);
    return { title: chapterTitle, content: text };
  },
};

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function cleanText(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function extractChapterTitleFromHead(html: string): string {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  if (!match) return "";
  return match[1].split("_")[0]?.trim() ?? "";
}

function parseChapterListHtml(doc: Document, origin: string): ChapterLink[] {
  return [...doc.querySelectorAll("ul.mulu_list li a[href]")]
    .map((a, i) => {
      const href = a.getAttribute("href")?.trim();
      if (!href) return null;
      return {
        title: cleanText(a.textContent) || `Chương ${i + 1}`,
        url: new URL(href, origin).href,
        order: i,
      };
    })
    .filter((c): c is ChapterLink => c !== null);
}

function cleanChapterText(s: string): string {
  return s
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^[-—＿_]{3,}$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
