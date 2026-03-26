"use client";

import { useEffect, useState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  computeDiff,
  formatStats,
  type DiffResult,
} from "@/lib/chapter-tools/diff-utils";
import { DiffHighlight } from "./diff-highlight";

/**
 * Async diff computation — defers expensive diffWords to idle time
 * to prevent freezing the tab on large chapters.
 */
function useAsyncDiff(a: string, b: string): DiffResult | null {
  const [result, setResult] = useState<DiffResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const id = requestIdleCallback(
      () => {
        const diff = computeDiff(a, b);
        if (!cancelled) setResult(diff);
      },
      { timeout: 200 },
    );

    return () => {
      cancelled = true;
      cancelIdleCallback(id);
      setResult(null);
    };
  }, [a, b]);

  return result;
}

interface SideBySideDiffProps {
  original: string;
  result: string;
  onResultChange: (text: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}

export function SideBySideDiff({
  original,
  result,
  onResultChange,
  onAccept,
  onReject,
  onRegenerate,
}: SideBySideDiffProps) {
  const diff = useAsyncDiff(original, result);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex gap-6 text-xs font-medium text-muted-foreground">
          <span>Thay đổi</span>
          <span>Kết quả (có thể chỉnh sửa)</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {diff ? formatStats(diff.stats) : "Đang so sánh..."}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <ScrollArea className="flex-1 border-r">
          <div className="p-4">
            {diff ? (
              <DiffHighlight changes={diff.changes} />
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex flex-1">
          <textarea
            className="flex-1 resize-none border-0 bg-transparent p-4 text-sm leading-relaxed outline-none"
            value={result}
            onChange={(e) => onResultChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          <RotateCcwIcon className="mr-1.5 size-3" />
          Tạo lại
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReject}>
            Hủy
          </Button>
          <Button size="sm" onClick={onAccept}>
            Áp dụng
          </Button>
        </div>
      </div>
    </div>
  );
}
