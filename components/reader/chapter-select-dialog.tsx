"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookOpenIcon, CheckIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface Chapter {
  id: string;
  title: string;
  order: number;
  wordCount?: number;
}

const ITEM_HEIGHT = 60;

/** Inner list — only mounted while the dialog is open so parentRef is always a live DOM node. */
function VirtualChapterList({
  chapters,
  currentIndex,
  onSelect,
  totalCount,
  query,
  onQueryChange,
  searchRef,
}: {
  chapters: (Chapter & { originalIndex: number })[];
  currentIndex: number;
  onSelect: (originalIndex: number) => void;
  totalCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: chapters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  // Auto-focus search and scroll to current chapter on mount
  useEffect(() => {
    searchRef.current?.focus();

    const idx = chapters.findIndex((ch) => ch.originalIndex === currentIndex);
    if (idx >= 0) {
      // Give the virtualizer one frame to measure the container
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(idx, { align: "center", behavior: "auto" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-scroll to current chapter when search is cleared
  useEffect(() => {
    if (!query.trim()) {
      const idx = chapters.findIndex((ch) => ch.originalIndex === currentIndex);
      if (idx >= 0) {
        virtualizer.scrollToIndex(idx, { align: "center", behavior: "auto" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <>
      {/* Search */}
      <div className="shrink-0 border-b px-3 py-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Tìm chương..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Virtual list */}
      <div
        ref={parentRef}
        className="h-[60vh] overflow-y-auto overscroll-contain"
      >
        {chapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <SearchIcon className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Không tìm thấy chương nào
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const ch = chapters[virtualItem.index];
              const isActive = ch.originalIndex === currentIndex;

              return (
                <div
                  key={ch.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <button
                    className={`flex h-full w-full cursor-pointer items-center gap-3 px-4 text-left transition-colors ${
                      isActive
                        ? "bg-primary/8 text-foreground"
                        : "text-foreground hover:bg-accent"
                    }`}
                    onClick={() => onSelect(ch.originalIndex)}
                  >
                    <span
                      className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ch.originalIndex + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`line-clamp-2 text-sm leading-tight ${
                          isActive ? "font-medium" : "font-normal"
                        }`}
                      >
                        {ch.title}
                      </p>
                      {ch.wordCount !== undefined && ch.wordCount > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {ch.wordCount.toLocaleString("vi-VN")} từ
                        </p>
                      )}
                    </div>

                    {isActive && (
                      <CheckIcon className="size-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t px-4 py-2 text-center text-[11px] text-muted-foreground">
        {query.trim()
          ? `${chapters.length} / ${totalCount} kết quả`
          : `${totalCount} chương`}
      </div>
    </>
  );
}

export function ChapterSelectDialog({
  chapters,
  currentIndex,
  onSelect,
}: {
  chapters: Chapter[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim())
      return chapters.map((ch, i) => ({ ...ch, originalIndex: i }));
    const q = query.toLowerCase();
    return chapters
      .map((ch, i) => ({ ...ch, originalIndex: i }))
      .filter(
        (ch) =>
          ch.title.toLowerCase().includes(q) ||
          String(ch.originalIndex + 1).includes(q),
      );
  }, [chapters, query]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const handleSelect = (originalIndex: number) => {
    onSelect(originalIndex);
    setOpen(false);
  };

  const currentChapter = chapters[currentIndex];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-8 max-w-[160px] cursor-pointer justify-between gap-2 overflow-hidden px-3 font-normal md:max-w-[320px]"
          title="Chọn chương"
        >
          <BookOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs">
            {currentChapter
              ? `${currentIndex + 1}. ${currentChapter.title}`
              : "Chọn chương"}
          </span>
          <span className="hidden shrink-0 tabular-nums text-[10px] text-muted-foreground md:inline">
            {currentIndex + 1}/{chapters.length}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent
        className="flex flex-col gap-0 p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="text-sm">Danh sách chương</DialogTitle>
        </DialogHeader>

        {/* Only mount the virtualizer when the dialog is open */}
        {open && (
          <VirtualChapterList
            chapters={filtered}
            totalCount={chapters.length}
            currentIndex={currentIndex}
            onSelect={handleSelect}
            query={query}
            onQueryChange={setQuery}
            searchRef={searchRef}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
