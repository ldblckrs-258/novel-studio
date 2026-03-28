"use client";

import { cn } from "@/lib/utils";
import { diffWords } from "diff";
import { memo, useEffect, useRef, useState } from "react";
import { ScrollbarMarks } from "./scrollbar-marks";
import { Skeleton } from "./skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InlineDiffViewerProps {
  /** Original (before) text */
  original: string;
  /** Modified (after) text */
  modified: string;
  /** Additional class names merged onto the root container */
  className?: string;
  /** Font-size Tailwind classes for content (default: "text-sm leading-5") */
  contentFont?: string;
  /** Font-size Tailwind classes for gutter (default: "text-xs leading-5") */
  gutterFont?: string;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const LINE_CLS = "flex";
const GUTTER_BASE =
  "w-8 shrink-0 self-stretch border-r bg-muted/30 pr-1.5 text-right font-mono text-muted-foreground/60 select-none";
const CONTENT_BASE =
  "min-w-0 flex-1 whitespace-pre-wrap break-words px-3 font-mono";

/* ------------------------------------------------------------------ */
/*  Diff computation                                                   */
/* ------------------------------------------------------------------ */

interface DiffLine {
  oldNum: number | null;
  newNum: number | null;
  type: "unchanged" | "removed" | "added" | "modified";
  content: React.ReactNode;
}

function computeInlineDiffLines(
  original: string,
  modified: string,
): DiffLine[] {
  const changes = diffWords(original, modified);
  const result: DiffLine[] = [];

  let currentOldLine = 1;
  let currentNewLine = 1;
  let fragments: React.ReactNode[] = [];
  let lineHasRemoved = false;
  let lineHasAdded = false;
  let fragIndex = 0;

  function flushLine() {
    const type: DiffLine["type"] =
      lineHasRemoved && lineHasAdded
        ? "modified"
        : lineHasRemoved
          ? "removed"
          : lineHasAdded
            ? "added"
            : "unchanged";

    result.push({
      oldNum: type === "added" ? null : currentOldLine,
      newNum: type === "removed" ? null : currentNewLine,
      type,
      content: fragments.length > 0 ? fragments : "\u00A0",
    });

    if (type !== "added") currentOldLine++;
    if (type !== "removed") currentNewLine++;
    fragments = [];
    lineHasRemoved = false;
    lineHasAdded = false;
  }

  for (const change of changes) {
    const lines = change.value.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const text = lines[li];

      if (li > 0) flushLine();

      // Trailing empty string from split — already handled by flush
      if (!text && li === lines.length - 1 && lines.length > 1) continue;

      if (change.added) {
        lineHasAdded = true;
        if (text) {
          fragments.push(
            <span
              key={`a${fragIndex++}`}
              className="rounded-sm bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            >
              {text}
            </span>,
          );
        }
      } else if (change.removed) {
        lineHasRemoved = true;
        if (text) {
          fragments.push(
            <span
              key={`r${fragIndex++}`}
              className="rounded-sm bg-red-100 text-red-800 line-through dark:bg-red-900/40 dark:text-red-300"
            >
              {text}
            </span>,
          );
        }
      } else {
        if (text) {
          fragments.push(<span key={`u${fragIndex++}`}>{text}</span>);
        }
      }
    }
  }

  if (fragments.length > 0) flushLine();

  return result;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DiffLines = memo(function DiffLines({
  diffLines,
  gutterFont,
  contentFont,
}: {
  diffLines: DiffLine[];
  gutterFont: string;
  contentFont: string;
}) {
  const gutterCls = cn(GUTTER_BASE, gutterFont);
  const contentCls = cn(CONTENT_BASE, contentFont);

  return (
    <>
      {diffLines.map((line, i) => (
        <div
          key={i}
          className={cn(
            LINE_CLS,
            line.type === "removed" && "bg-red-50 dark:bg-red-950/30",
            line.type === "added" && "bg-green-50 dark:bg-green-950/30",
            line.type === "modified" && "bg-amber-50 dark:bg-amber-950/20",
          )}
          {...(line.type !== "unchanged"
            ? { "data-mark": true, "data-mark-color": DIFF_TYPE_COLORS[line.type] ?? undefined }
            : {})}
        >
          {/* Line number (new line, hidden for removed lines) */}
          <span
            className={cn(gutterCls, line.type === "removed" && "opacity-0")}
          >
            {line.newNum}
          </span>
          {/* Change indicator */}
          <span className="w-5 shrink-0 text-center font-mono text-xs leading-5 select-none">
            {line.type === "removed" && (
              <span className="text-red-500">−</span>
            )}
            {line.type === "added" && (
              <span className="text-green-500">+</span>
            )}
            {line.type === "modified" && (
              <span className="text-amber-500">~</span>
            )}
          </span>
          {/* Content */}
          <span className={contentCls}>{line.content}</span>
        </div>
      ))}
    </>
  );
});

const DIFF_TYPE_COLORS: Record<DiffLine["type"], string | null> = {
  unchanged: null,
  removed: "bg-red-400 dark:bg-red-500",
  added: "bg-green-400 dark:bg-green-500",
  modified: "bg-amber-400 dark:bg-amber-500",
};

export function InlineDiffViewer({
  original,
  modified,
  className,
  contentFont = "text-sm leading-5",
  gutterFont = "text-xs leading-5",
}: InlineDiffViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [diffLines, setDiffLines] = useState<DiffLine[] | null>(null);

  // Compute diff off the main thread via requestIdleCallback with debounce.
  // Keeps stale result visible until new one is ready (avoids skeleton flash for small texts).
  useEffect(() => {
    let cancelled = false;
    const debounce = setTimeout(() => {
      const idleId = requestIdleCallback(
        () => {
          if (!cancelled) {
            setDiffLines(computeInlineDiffLines(original, modified));
          }
        },
        { timeout: 500 },
      );
      cleanupIdle = () => cancelIdleCallback(idleId);
    }, 150);
    let cleanupIdle: (() => void) | undefined;
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      cleanupIdle?.();
    };
  }, [original, modified]);

  return (
    <div className={cn("relative rounded-md border", className)}>
      <div ref={scrollRef} className="h-full overflow-y-auto">
        {diffLines ? (
          <DiffLines
            diffLines={diffLines}
            gutterFont={gutterFont}
            contentFont={contentFont}
          />
        ) : (
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
      </div>
      <ScrollbarMarks scrollRef={scrollRef} selector="[data-mark]" />
    </div>
  );
}
