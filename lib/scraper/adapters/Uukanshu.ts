import type { ChapterLink, SiteAdapter } from "../types";

/**
 * UU看書 (uukanshu.cc)
 * - Chapter index: #list-chapterAll inside dl.book.chapterlist (legacy was #chapterList)
 * - Chapter body: .read > .readcontent (site also uses typo class .readcotent on some pages)
 * - Legacy: #contentbox (older templates)
 * - Metadata: og:* + p.booktag when jieshao block is absent
 */
const UUKANSHU_CHAPTER_BODY =
  ".read .readcontent, .read .readcotent, #contentbox";

export const UukanshuAdapter: SiteAdapter = {
  name: "UU看書(Uukanshu)",
  urlPattern: /uukanshu\.cc/i,
  chapterWaitSelector: UUKANSHU_CHAPTER_BODY,

  getNovelInfo(html, url) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const base = new URL(url);
    const bookId = url.match(/\/book\/(\d+)/)?.[1] ?? "";

    const title =
      cleanBookTitle(
        doc
          .querySelector('meta[property="og:novel:book_name"]')
          ?.getAttribute("content") ??
          doc
            .querySelector('meta[property="og:title"]')
            ?.getAttribute("content") ??
          doc.querySelector("dd.jieshao_content > h1 > a")?.textContent ??
          doc.querySelector("title")?.textContent ??
          "",
      ) ||
      doc.querySelector("title")?.textContent?.split(/[,，]/)[0]?.trim() ||
      "";

    const author =
      doc
        .querySelector('meta[property="og:novel:author"]')
        ?.getAttribute("content")
        ?.trim() ||
      doc.querySelector("dd.jieshao_content > h2 > a")?.textContent?.trim() ||
      doc
        .querySelector('p.booktag a[href*="authorarticle"]')
        ?.textContent?.trim() ||
      doc.querySelector("p.booktag a.red")?.textContent?.trim() ||
      undefined;

    const rawDesc =
      doc
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content")
        ?.trim() ??
      doc.querySelector("dd.jieshao_content > h3")?.textContent?.trim();
    const description = rawDesc
      ? cleanIntro(stripMetaHtml(rawDesc))
      : undefined;

    const rawCover =
      doc
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content")
        ?.trim() ||
      doc.querySelector("a.bookImg img")?.getAttribute("src") ||
      "";
    const coverImage = rawCover ? new URL(rawCover, base).href : undefined;

    const chapters = bookId ? extractChapterLinks(doc, base, bookId) : [];

    return { title, author, description, coverImage, chapters };
  },

  getChapterContent(html, _url, contentText) {
    const chapterTitle = extractChapterTitle(html);

    let text = (contentText ?? "").trim();
    if (!text) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      text = pickChapterBodyEl(doc)?.textContent?.trim() ?? "";
    }

    text = cleanChapterText(text);
    return { title: chapterTitle, content: text };
  },
};

function pickChapterBodyEl(doc: Document): Element | null {
  return (
    doc.querySelector(".read .readcontent") ??
    doc.querySelector(".read .readcotent") ??
    doc.querySelector("#contentbox")
  );
}

function cleanBookTitle(raw: string): string {
  return raw
    .replace(/最新章[節节]/g, "")
    .replace(/^[,，\s]+/, "")
    .replace(/[,，].*UU看[書书].*$/i, "")
    .replace(/最新章节/g, "")
    .trim();
}

function stripMetaHtml(s: string): string {
  return (
    new DOMParser().parseFromString(s, "text/html").body.textContent?.trim() ??
    s
  );
}

function extractChapterLinks(
  doc: Document,
  base: URL,
  bookId: string,
): ChapterLink[] {
  const root =
    doc.querySelector("#list-chapterAll") ??
    doc.querySelector("dl.book.chapterlist") ??
    doc.querySelector(".book.chapterlist");

  const anchors = root
    ? [...root.querySelectorAll("a[href]")]
    : [...doc.querySelectorAll(".chapterlist a[href]")];

  const pathRe = new RegExp(`^/book/${bookId}/(\\d+)\\.html$`);
  const seen = new Set<string>();
  const rows: { sortKey: number; title: string; url: string }[] = [];

  for (const el of anchors) {
    const href = el.getAttribute("href")?.trim();
    if (!href || href.includes("?")) continue;
    let pathname: string;
    try {
      pathname = new URL(href, base).pathname;
    } catch {
      continue;
    }
    const m = pathname.match(pathRe);
    if (!m) continue;
    const sortKey = parseInt(m[1], 10);
    const abs = new URL(href, base).href.replace(/\?.*$/, "");
    if (seen.has(abs)) continue;
    seen.add(abs);
    rows.push({
      sortKey,
      title: el.textContent?.trim() || `Chapter ${sortKey}`,
      url: abs,
    });
  }

  rows.sort((a, b) => a.sortKey - b.sortKey);
  return rows.map((r, i) => ({ title: r.title, url: r.url, order: i }));
}

function extractChapterTitle(html: string): string {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  if (!match) return "";
  const full = match[1].trim();
  const parts = full.split(/\s+-\s+/);
  return parts[0]?.trim() || "";
}

function cleanIntro(s: string): string {
  return s
    .replace(/^.+简介：\s+www\.uukanshu\.com\s+/i, "")
    .replace(/\s+https:\/\/www\.uukanshu\.com/gi, "")
    .replace(/－+/g, "")
    .trim();
}

function cleanChapterText(s: string): string {
  let t = s;
  const patterns: RegExp[] = [
    /[ＵｕUu]+看书\s*[wｗ]+\.[ＵｕUu]+[kｋ][aａ][nｎ][ｓs][hｈ][ＵｕUu]\.[nｎ][eｅ][tｔ]/g,
    /[ＵｕUu]+看书\s*[wｗ]+\.[ＵｕUu]+[kｋ][aａ][nｎ][ｓs][hｈ][ＵｕUu]\.[cＣｃ][oＯｏ][mＭｍ]/g,
    /[UＵ]*看书[（(].*?[）)]文字首发。/g,
    /请记住本书首发域名：。?/g,
    /[溫温]馨提示[：:][\s\S]*$/m,
    /按\s*回车\[Enter\]鍵[\s\S]*$/m,
    /Copyright ©[\s\S]*$/m,
    /TOP↑/g,
  ];
  for (const re of patterns) {
    t = t.replace(re, "");
  }
  return t.replace(/\n{3,}/g, "\n\n").trim();
}
