"use client";

import { ScrollToBottom } from "@/components/chat/scroll-to-bottom";
import { Button } from "@/components/ui/button";
import {
  useChapterTools,
  type ChapterToolMode,
} from "@/lib/stores/chapter-tools";
import { cn } from "@/lib/utils";
import { StopCircleIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { ConvertMode } from "./convert-mode";
import { EditMode } from "./edit-mode";
import { ReviewMode } from "./review-mode";
import { TranslateMode, type TranslateResult } from "./translate-mode";

const MODE_TITLES: Record<ChapterToolMode, string> = {
  translate: "Dịch chương",
  review: "Đánh giá chương",
  edit: "Chỉnh sửa chương",
  convert: "Convert chương",
};

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
      useChapterTools.getState().setPanelWidth(window.innerWidth - x);
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

export function ChapterToolsPanel({
  content,
  novelId,
  chapterId,
  chapterOrder,
  chapterTitle,
  onTranslated,
  onRevertTranslation,
  onClose,
}: {
  content: string;
  novelId: string;
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  onTranslated: (result: TranslateResult) => void;
  onRevertTranslation: () => void;
  onClose: () => void;
}) {
  const activeMode = useChapterTools((s) => s.activeMode);
  const panelWidth = useChapterTools((s) => s.panelWidth);
  const isStreaming = useChapterTools((s) => s.isStreaming);
  const cancelStreaming = useChapterTools((s) => s.cancelStreaming);

  // Footer content provided by mode components via renderFooter callback
  const [footerContent, setFooterContent] = useState<React.ReactNode>(null);

  const renderFooter = useCallback((node: React.ReactNode) => {
    setFooterContent(node);
  }, []);

  const hasFooter = isStreaming || footerContent;

  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden border-l bg-background transition-[width] duration-200",
        !activeMode && "w-0",
      )}
      style={activeMode ? { width: panelWidth } : undefined}
    >
      {activeMode && (
        <>
          <PanelResizeHandle />
          <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <h3 className="text-sm font-medium">{MODE_TITLES[activeMode]}</h3>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <XIcon className="size-4" />
            </Button>
          </header>
          <StickToBottom
            className="relative min-h-0 flex-1"
            resize="smooth"
            initial="instant"
          >
            <StickToBottom.Content className="p-4">
              {activeMode === "translate" && (
                <TranslateMode
                  content={content}
                  novelId={novelId}
                  chapterOrder={chapterOrder}
                  chapterTitle={chapterTitle}
                  onTranslated={onTranslated}
                  onRevert={onRevertTranslation}
                  renderFooter={renderFooter}
                />
              )}
              {activeMode === "review" && (
                <ReviewMode
                  content={content}
                  novelId={novelId}
                  chapterId={chapterId}
                  renderFooter={renderFooter}
                />
              )}
              {activeMode === "edit" && (
                <EditMode
                  content={content}
                  novelId={novelId}
                  chapterId={chapterId}
                  renderFooter={renderFooter}
                />
              )}
              {activeMode === "convert" && (
                <ConvertMode
                  content={content}
                  novelId={novelId}
                  chapterId={chapterId}
                  chapterTitle={chapterTitle}
                  onTranslated={onTranslated}
                  onRevert={onRevertTranslation}
                  renderFooter={renderFooter}
                />
              )}
            </StickToBottom.Content>
            <ScrollToBottom />
          </StickToBottom>

          {/* Fixed footer: stop button during streaming, mode actions otherwise */}
          {hasFooter && (
            <div className="shrink-0 border-t bg-background px-4 py-3">
              {isStreaming ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={cancelStreaming}
                  className="w-full"
                >
                  <StopCircleIcon className="mr-1.5 size-3.5" />
                  Dừng
                </Button>
              ) : (
                footerContent
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
