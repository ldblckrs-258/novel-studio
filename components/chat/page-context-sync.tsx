"use client";

import { db } from "@/lib/db";
import { useChatPanel } from "@/lib/stores/chat-panel";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";

/**
 * Syncs the chat panel's page context (novelId + chapterId) with the current URL.
 * Handles both:
 *   - /novels/:id/chapters/:chapterId  → chapterId is a UUID from pathname
 *   - /novels/:id/read/:order          → order is 1-based; resolved to chapter UUID via DB
 *
 * Does NOT use useSearchParams, so no Suspense boundary is required.
 */
export function PageContextSync({
  novelId,
  pathnameChapterId,
  readerChapterOrder,
}: {
  novelId: string | null;
  pathnameChapterId: string | null;
  /** 1-based chapter order from /read/:order URL, or null when not on reader page */
  readerChapterOrder: number | null;
}) {
  const setPageContext = useChatPanel((s) => s.setPageContext);

  // Resolve 1-based order → chapter UUID for reader pages
  const readerChapter = useLiveQuery(
    async () => {
      if (!novelId || readerChapterOrder === null) return null;
      const chapters = await db.chapters
        .where("novelId")
        .equals(novelId)
        .sortBy("order");
      return chapters[readerChapterOrder - 1] ?? null;
    },
    [novelId, readerChapterOrder],
  );

  useEffect(() => {
    // Still loading the reader chapter — wait before setting context
    if (readerChapterOrder !== null && readerChapter === undefined) return;

    const chapterId =
      pathnameChapterId ?? (readerChapterOrder !== null ? (readerChapter?.id ?? null) : null);

    setPageContext(novelId, chapterId);
  }, [
    novelId,
    pathnameChapterId,
    readerChapterOrder,
    readerChapter,
    setPageContext,
  ]);

  return null;
}
