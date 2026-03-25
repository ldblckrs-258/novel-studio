"use client";

import type { Change } from "@/lib/chapter-tools/diff-utils";

interface DiffHighlightProps {
  changes: Change[];
}

export function DiffHighlight({ changes }: DiffHighlightProps) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {changes.map((change, i) => {
        if (change.added) {
          return (
            <span
              key={i}
              className="rounded-sm bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            >
              {change.value}
            </span>
          );
        }
        if (change.removed) {
          return (
            <span
              key={i}
              className="rounded-sm bg-red-100 text-red-800 line-through dark:bg-red-900/40 dark:text-red-300"
            >
              {change.value}
            </span>
          );
        }
        return <span key={i}>{change.value}</span>;
      })}
    </div>
  );
}
