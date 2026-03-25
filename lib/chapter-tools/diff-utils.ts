import { diffWords, type Change } from "diff";

export type { Change };

export interface DiffStats {
  wordDiff: number;
  lineDiff: number;
  origWords: number;
  editWords: number;
  origLines: number;
  editLines: number;
}

export interface DiffResult {
  changes: Change[];
  stats: DiffStats;
}

/**
 * Compute word-level diff between original and edited text.
 * Uses jsdiff's diffWords for prose-optimized comparison.
 */
export function computeDiff(original: string, edited: string): DiffResult {
  const changes = diffWords(original, edited);

  const origWords = original.trim().split(/\s+/).filter(Boolean).length;
  const editWords = edited.trim().split(/\s+/).filter(Boolean).length;
  const origLines = original.split("\n").length;
  const editLines = edited.split("\n").length;

  return {
    changes,
    stats: {
      wordDiff: editWords - origWords,
      lineDiff: editLines - origLines,
      origWords,
      editWords,
      origLines,
      editLines,
    },
  };
}

/**
 * Format stats as display string: "+120 từ (+5.2%) | +3 dòng"
 */
export function formatStats(stats: DiffStats): string {
  const wordSign = stats.wordDiff >= 0 ? "+" : "";
  const pct =
    stats.origWords > 0
      ? ((stats.wordDiff / stats.origWords) * 100).toFixed(1)
      : "0";
  const lineSign = stats.lineDiff >= 0 ? "+" : "";
  return `${wordSign}${stats.wordDiff} từ (${wordSign}${pct}%) | ${lineSign}${stats.lineDiff} dòng`;
}
