"use client";

import {
  LanguagesIcon,
  ClipboardCheckIcon,
  PenLineIcon,
  LoaderIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useChapterTools, type ChapterToolMode } from "@/lib/stores/chapter-tools";

const TOOLS: {
  mode: ChapterToolMode;
  icon: React.ElementType;
  label: string;
}[] = [
  { mode: "translate", icon: LanguagesIcon, label: "Dịch chương" },
  { mode: "review", icon: ClipboardCheckIcon, label: "Đánh giá chương" },
  { mode: "edit", icon: PenLineIcon, label: "Chỉnh sửa chương" },
];

export function ChapterToolsBar({ chapterId }: { chapterId: string }) {
  const activeMode = useChapterTools((s) => s.activeMode);
  const isStreaming = useChapterTools((s) => s.isStreaming);
  const reviewResult = useChapterTools((s) => s.reviewResult);
  const reviewChapterId = useChapterTools((s) => s.reviewChapterId);
  const toggleMode = useChapterTools((s) => s.toggleMode);

  return (
    <TooltipProvider>
      <div className="flex shrink-0 flex-col items-center gap-1 border-l bg-background px-1 py-2">
        {TOOLS.map((tool) => {
          const isActive = activeMode === tool.mode;
          const showSpinner = isActive && isStreaming;
          const showDot = tool.mode === "edit" && !!reviewResult && reviewChapterId === chapterId;

          return (
            <Tooltip key={tool.mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => toggleMode(tool.mode)}
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {showSpinner ? (
                    <LoaderIcon className="size-4 animate-spin" />
                  ) : (
                    <tool.icon className="size-4" />
                  )}
                  {showDot && (
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-green-500" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{tool.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
