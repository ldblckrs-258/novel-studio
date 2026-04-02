"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTTSSettings } from "@/lib/hooks/use-tts-settings";
import { useReaderPanel } from "@/lib/stores/reader-panel";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ReaderControls } from "./reader-controls";
import { ReaderSentenceList } from "./reader-sentence-list";
import { ReaderSettings } from "./reader-settings";

function PanelResizeHandle() {
  const isDragging = useRef(false);
  const rafId = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    cancelAnimationFrame(rafId.current);
    const x = e.clientX;
    rafId.current = requestAnimationFrame(() => {
      useReaderPanel.getState().setPanelWidth(window.innerWidth - x);
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    cancelAnimationFrame(rafId.current);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        "absolute inset-y-0 left-0 z-20 w-1 cursor-col-resize",
        "after:absolute after:inset-y-0 after:-left-1 after:w-3",
        "hover:bg-ring/50 active:bg-ring",
      )}
    />
  );
}

export function ReaderPanel() {
  const isOpen = useReaderPanel((s) => s.isOpen);
  const panelWidth = useReaderPanel((s) => s.panelWidth);
  const setOpen = useReaderPanel((s) => s.setOpen);
  const syncSettings = useReaderPanel((s) => s.syncSettings);
  const novelId = useReaderPanel((s) => s.novelId);
  const novelTitle = useReaderPanel((s) => s.novelTitle);
  const chapterTitle = useReaderPanel((s) => s.chapterTitle);
  const chapterIndex = useReaderPanel((s) => s.chapterIndex);
  const totalChapters = useReaderPanel((s) => s.totalChapters);
  const freeformTitle = useReaderPanel((s) => s.freeformTitle);
  const dexieSettings = useTTSSettings();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const isReaderPage = /^\/novels\/[^/]+\/read\/\d+/.test(pathname);

  // Keep the store in sync with Dexie-backed settings
  useEffect(() => {
    syncSettings(dexieSettings);
  }, [dexieSettings, syncSettings]);

  const hasPrev = chapterIndex > 0;
  const hasNext = totalChapters > 0 && chapterIndex < totalChapters - 1;

  const handlePrev = useCallback(() => {
    const { novelId, chapterIndex } = useReaderPanel.getState();
    if (!novelId || chapterIndex <= 0) return;
    const newIndex = chapterIndex - 1;
    useReaderPanel.getState().prevChapter();
    if (isReaderPage) router.push(`/novels/${novelId}/read/${newIndex + 1}`);
  }, [router, isReaderPage]);

  const handleNext = useCallback(() => {
    const { novelId, chapterIndex, totalChapters } = useReaderPanel.getState();
    if (!novelId || chapterIndex >= totalChapters - 1) return;
    const newIndex = chapterIndex + 1;
    useReaderPanel.getState().nextChapter();
    if (isReaderPage) router.push(`/novels/${novelId}/read/${newIndex + 1}`);
  }, [router, isReaderPage]);

  const panelContent = (
    <>
      {/* Title bar */}
      <header className="shrink-0 border-b">
        <div className="flex h-12 items-center justify-between px-4">
          <h3 className="text-sm font-medium">Đọc truyện</h3>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
            <XIcon className="size-4" />
          </Button>
        </div>

        {/* Chapter context: novel · chapter with prev/next */}
        {novelId ? (
          <div className="flex items-center gap-1 border-t px-2 py-1.5">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={!hasPrev}
              onClick={handlePrev}
              title="Chương trước"
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[11px] text-muted-foreground leading-tight">
                {novelTitle}
              </p>
              <p className="truncate text-xs font-medium leading-tight">
                {chapterIndex + 1}. {chapterTitle}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={!hasNext}
              onClick={handleNext}
              title="Chương tiếp"
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        ) : freeformTitle ? (
          <div className="border-t px-4 py-2">
            <p className="truncate text-xs font-bold text-center text-muted-foreground">
              {freeformTitle}
            </p>
          </div>
        ) : null}
      </header>

      {/* Settings (top, collapsible) */}
      <div className="shrink-0 border-b">
        <ReaderSettings />
      </div>

      {/* Sentence list (middle, scrollable) */}
      <ReaderSentenceList />

      {/* Controls (bottom, pinned) */}
      <div className="shrink-0 border-t bg-background px-4 py-3">
        <ReaderControls />
      </div>
    </>
  );

  // Mobile: Sheet drawer
  if (isMobile) {
    return (
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) setOpen(false);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-screen! max-w-[100vw] bg-card p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Đọc truyện</SheetTitle>
            <SheetDescription>Bảng đọc truyện TTS</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{panelContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: fixed panel sliding in from right + spacer to push layout
  return (
    <div className="hidden md:block">
      {/* Spacer that reserves space so the main layout doesn't get covered */}
      <div
        className="relative bg-transparent transition-[width] duration-200 ease-linear"
        style={{ width: isOpen ? panelWidth : 0 }}
      />
      {/* Fixed full-height panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-10 hidden h-svh flex-col border-l bg-card transition-[right] duration-200 ease-linear md:flex",
          !isOpen && "pointer-events-none",
        )}
        style={{
          width: panelWidth,
          right: isOpen ? 0 : -panelWidth,
        }}
      >
        <PanelResizeHandle />
        {panelContent}
      </div>
    </div>
  );
}
