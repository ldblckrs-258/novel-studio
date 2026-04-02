"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useReaderPanel } from "@/lib/stores/reader-panel";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ReaderSentenceList() {
  const sentences = useReaderPanel((s) => s.sentences);
  const currentSentenceIndex = useReaderPanel((s) => s.currentSentenceIndex);
  const isPlaying = useReaderPanel((s) => s.isPlaying);
  const isPaused = useReaderPanel((s) => s.isPaused);
  const jumpTo = useReaderPanel((s) => s.jumpTo);

  const [jumpInput, setJumpInput] = useState("");
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const total = sentences.length;
  const isActiveSession = isPlaying || isPaused;

  // Auto-scroll active sentence into view
  useEffect(() => {
    if (isActiveSession && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentSentenceIndex, isActiveSession]);

  const handleJump = () => {
    const idx = parseInt(jumpInput, 10);
    if (!Number.isNaN(idx) && idx >= 1 && idx <= total) {
      jumpTo(idx - 1);
      setJumpInput("");
    }
  };

  const handleJumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleJump();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Câu ({total})
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Input
            type="number"
            min={1}
            max={total}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={handleJumpKeyDown}
            placeholder="Nhảy đến..."
            className="h-6 w-26 text-xs placeholder:text-xs"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleJump}
            disabled={!jumpInput}
          >
            <ArrowRightIcon className="size-3" />
          </Button>
        </div>
      </div>

      {/* Sentence list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 px-2 pb-2">
          {sentences.map((sentence, i) => {
            const isActive = isActiveSession && i === currentSentenceIndex;
            return (
              <button
                key={i}
                ref={isActive ? activeItemRef : undefined}
                onClick={() => jumpTo(i)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  isActive
                    ? "border-l-2 border-primary bg-blue-50 dark:bg-blue-950/30"
                    : "hover:bg-muted/50",
                )}
              >
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className="mt-0.5 shrink-0 tabular-nums text-[10px] px-0.75"
                >
                  {i + 1}
                </Badge>
                <span className="line-clamp-2 text-muted-foreground">
                  {sentence.text}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
