"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChapterTools, type ChapterToolMode } from "@/lib/stores/chapter-tools";
import { TranslateMode } from "./translate-mode";
import { ReviewMode } from "./review-mode";
import { EditMode } from "./edit-mode";

const MODE_TITLES: Record<ChapterToolMode, string> = {
  translate: "Dịch chương",
  review: "Đánh giá chương",
  edit: "Chỉnh sửa chương",
};

export function ChapterToolsPanel({
  content,
  novelId,
  chapterId,
  chapterOrder,
}: {
  content: string;
  novelId: string;
  chapterId: string;
  chapterOrder: number;
}) {
  const activeMode = useChapterTools((s) => s.activeMode);
  const setActiveMode = useChapterTools((s) => s.setActiveMode);

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-l bg-background transition-[width] duration-200",
        activeMode ? "w-[400px]" : "w-0 overflow-hidden",
      )}
    >
      {activeMode && (
        <>
          <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <h3 className="text-sm font-medium">
              {MODE_TITLES[activeMode]}
            </h3>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setActiveMode(null)}
            >
              <XIcon className="size-4" />
            </Button>
          </header>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              {activeMode === "translate" && (
                <TranslateMode
                  content={content}
                  novelId={novelId}
                  chapterOrder={chapterOrder}
                />
              )}
              {activeMode === "review" && (
                <ReviewMode content={content} novelId={novelId} chapterId={chapterId} />
              )}
              {activeMode === "edit" && (
                <EditMode content={content} novelId={novelId} chapterId={chapterId} />
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
