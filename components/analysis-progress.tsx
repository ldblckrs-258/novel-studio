"use client";

import {
  XIcon,
  LoaderIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  MinusCircleIcon,
  CircleDotDashedIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAnalysisStore } from "@/lib/stores/analysis";
import type { PhaseResult } from "@/lib/stores/analysis";
import type { IncrementalResultSummary } from "@/lib/analysis/incremental-analyzer";
import { useMemo } from "react";

const PHASE_STEP_LABELS: Record<string, string> = {
  chapters: "Phân tích chương",
  aggregation: "Tổng hợp tiểu thuyết",
  characters: "Hồ sơ nhân vật",
};

const PHASE_DESCRIPTIONS: Record<string, string> = {
  chapters: "Tóm tắt nội dung và nhận diện nhân vật trong từng chương",
  aggregation: "Tổng hợp thể loại, tóm tắt, thế giới quan từ các chương",
  characters: "Xây dựng hồ sơ chi tiết cho các nhân vật",
};

function PhaseResultIcon({
  result,
  className = "size-4",
}: {
  result: PhaseResult;
  className?: string;
}) {
  switch (result) {
    case "done":
      return <CheckCircleIcon className={`${className} text-emerald-500`} />;
    case "error":
      return <AlertTriangleIcon className={`${className} text-destructive`} />;
    case "skipped":
      return <MinusCircleIcon className={`${className} text-muted-foreground`} />;
    case "running":
      return <LoaderIcon className={`${className} animate-spin text-primary`} />;
    default:
      return (
        <CircleDotDashedIcon
          className={`${className} text-muted-foreground/40`}
        />
      );
  }
}

function phaseStatusText(
  result: PhaseResult,
  phase: string,
  chaptersCompleted: number,
  totalChapters: number,
  errorCount: number,
): string {
  switch (result) {
    case "done":
      if (phase === "chapters" && totalChapters > 0)
        return `${totalChapters}/${totalChapters} hoàn tất`;
      return "Hoàn tất";
    case "error":
      if (phase === "chapters" && errorCount > 0) {
        const succeeded = totalChapters - errorCount;
        return `${succeeded}/${totalChapters} (${errorCount} lỗi)`;
      }
      return "Thất bại";
    case "skipped":
      return "Bỏ qua";
    case "running":
      if (phase === "chapters" && totalChapters > 0)
        return `${chaptersCompleted}/${totalChapters}`;
      return "Đang xử lý...";
    default:
      return "Chờ xử lý";
  }
}

export function AnalysisProgress() {
  const {
    phase,
    chaptersCompleted,
    totalChapters,
    errors,
    resultSummary,
    phaseResults,
    cancel,
  } = useAnalysisStore();

  const hasErrors = errors.length > 0;
  const isDone =
    phase === "complete" ||
    phase === "completed_with_errors" ||
    phase === "error";
  const isRunning =
    phase === "chapters" || phase === "aggregation" || phase === "characters";

  const progressPercent =
    totalChapters > 0
      ? phase === "chapters"
        ? (chaptersCompleted / totalChapters) * 70
        : phase === "aggregation"
          ? 80
          : phase === "characters"
            ? 90
            : isDone
              ? 100
              : 0
      : 0;

  const chapterErrorCount = useMemo(
    () => errors.filter((e) => e.phase === "chapters").length,
    [errors],
  );

  return (
    <div className="space-y-4">
      {/* Global progress bar + cancel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">
            {isDone
              ? hasErrors
                ? "Hoàn tất với lỗi"
                : "Phân tích hoàn tất"
              : "Đang phân tích..."}
          </p>
          {isRunning && (
            <Button
              variant="ghost"
              size="sm"
              onClick={cancel}
              className="h-6 px-2 text-xs text-muted-foreground"
            >
              <XIcon className="mr-1 size-3" />
              Hủy
            </Button>
          )}
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Per-phase pipeline steps */}
      <div className="space-y-1">
        {(["chapters", "aggregation", "characters"] as const).map(
          (phaseKey) => {
            const result = phaseResults[phaseKey];

            return (
              <div
                key={phaseKey}
                className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                  result === "running"
                    ? "bg-primary/5"
                    : result === "error"
                      ? "bg-destructive/5"
                      : ""
                }`}
              >
                <PhaseResultIcon result={result} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-medium ${
                      result === "pending"
                        ? "text-muted-foreground/60"
                        : result === "error"
                          ? "text-destructive"
                          : ""
                    }`}
                  >
                    {PHASE_STEP_LABELS[phaseKey]}
                  </p>
                  {result === "running" && (
                    <p className="text-xs text-muted-foreground">
                      {PHASE_DESCRIPTIONS[phaseKey]}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 text-xs ${
                    result === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {phaseStatusText(
                    result,
                    phaseKey,
                    chaptersCompleted,
                    totalChapters,
                    chapterErrorCount,
                  )}
                </span>
              </div>
            );
          },
        )}
      </div>

      {/* Error list */}
      {hasErrors && (
        <ScrollArea className="max-h-28">
          <div className="space-y-1">
            {errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 rounded px-2 py-1 text-xs text-destructive"
              >
                <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                <span>
                  {err.chapterTitle ? (
                    <span className="font-medium">{err.chapterTitle}: </span>
                  ) : (
                    <span className="font-medium capitalize">
                      {err.phase}:{" "}
                    </span>
                  )}
                  {err.message}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Result summary */}
      {resultSummary && isDone && <ResultSummaryView summary={resultSummary} />}
    </div>
  );
}

function ResultSummaryView({
  summary,
}: {
  summary: IncrementalResultSummary;
}) {
  const items: string[] = [];

  if (summary.chaptersAnalyzed > 0)
    items.push(`${summary.chaptersAnalyzed} chương đã phân tích`);
  if (summary.charactersAdded > 0)
    items.push(`${summary.charactersAdded} nhân vật mới`);
  if (summary.charactersUpdated > 0)
    items.push(`${summary.charactersUpdated} nhân vật cập nhật`);
  if (summary.relationshipsAdded > 0)
    items.push(`${summary.relationshipsAdded} mối quan hệ mới`);
  if (summary.factionsAdded > 0)
    items.push(`${summary.factionsAdded} phe phái mới`);
  if (summary.factionsUpdated > 0)
    items.push(`${summary.factionsUpdated} phe phái cập nhật`);
  if (summary.locationsAdded > 0)
    items.push(`${summary.locationsAdded} địa điểm mới`);
  if (summary.locationsUpdated > 0)
    items.push(`${summary.locationsUpdated} địa điểm cập nhật`);
  if (summary.updatedFields.length > 0)
    items.push(`Cập nhật: ${summary.updatedFields.join(", ")}`);

  if (items.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <CheckCircleIcon className="size-3.5 text-emerald-500" />
        Kết quả
      </p>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
