"use client";

import { DiffHighlight } from "@/components/chapter-tools/diff-highlight";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextCompareEditor } from "@/components/ui/text-compare-editor";
import {
  computeDiff,
  formatStats,
  type DiffResult,
} from "@/lib/chapter-tools/diff-utils";
import { ColumnsIcon, RowsIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface VersionDiffViewProps {
  versionContent: string;
  currentContent: string;
}

/**
 * Async diff computation hook.
 * Yields to the browser via requestIdleCallback before running the expensive diff.
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
      { timeout: 100 },
    );

    return () => {
      cancelled = true;
      cancelIdleCallback(id);
      setResult(null);
    };
  }, [a, b]);

  return result;
}

export function VersionDiffView({
  versionContent,
  currentContent,
}: VersionDiffViewProps) {
  const [mode, setMode] = useState<"inline" | "side-by-side">("inline");
  const diff = useAsyncDiff(versionContent, currentContent);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Stats bar + mode toggle */}
      <div className="flex shrink-0 items-center gap-2">
        {mode === "inline" && (
          <span className="text-xs text-muted-foreground">
            {diff ? formatStats(diff.stats) : "Đang so sánh..."}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={mode === "inline" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setMode("inline")}
          >
            <RowsIcon className="mr-1 size-3" />
            Nội tuyến
          </Button>
          <Button
            variant={mode === "side-by-side" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setMode("side-by-side")}
          >
            <ColumnsIcon className="mr-1 size-3" />
            Cạnh nhau
          </Button>
        </div>
      </div>

      {mode === "inline" ? (
        diff ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-3">
            <DiffHighlight changes={diff.changes} />
          </div>
        ) : (
          <div className="space-y-3 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )
      ) : (
        <TextCompareEditor
          leftValue={versionContent}
          rightValue={currentContent}
          showDiff
          storageKey="version-diff"
          leftLabel="Phiên bản cũ"
          rightLabel="Hiện tại"
          className="min-h-0 flex-1"
          panelWrapperClassName="min-h-0 h-[50vh]"
        />
      )}
    </div>
  );
}
