"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InlineDiffViewer } from "@/components/ui/inline-diff-viewer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStepResult } from "@/lib/hooks";
import type { ReviewAgentOutput } from "@/lib/writing/types";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DiffIcon,
  InfoIcon,
  ListIcon,
  Loader2Icon,
  PenLineIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

const SEVERITY_CONFIG = {
  critical: {
    icon: XCircleIcon,
    color: "text-red-500",
    label: "Nghiêm trọng",
  },
  minor: {
    icon: AlertTriangleIcon,
    color: "text-yellow-500",
    label: "Nhỏ",
  },
  suggestion: {
    icon: InfoIcon,
    color: "text-blue-500",
    label: "Gợi ý",
  },
};

const TYPE_LABELS = {
  character: "Nhân vật",
  plot: "Cốt truyện",
  tone: "Giọng văn",
  "world-rules": "Quy tắc thế giới",
};

export function ReviewPanel({
  sessionId,
  onRewriteAction,
  onSaveAction,
  onRegenerateReviewAction,
  isRewriting,
}: {
  sessionId: string | undefined;
  onRewriteAction?: () => void;
  onSaveAction?: () => void;
  onRegenerateReviewAction?: () => void;
  isRewriting?: boolean;
}) {
  const reviewResult = useStepResult(sessionId, "review");
  const writerResult = useStepResult(sessionId, "writer");
  const rewriteResult = useStepResult(sessionId, "rewrite");
  const [viewMode, setViewMode] = useState<"issues" | "diff">("issues");

  const review = useMemo((): ReviewAgentOutput | null => {
    if (!reviewResult?.output) return null;
    try {
      return JSON.parse(reviewResult.output) as ReviewAgentOutput;
    } catch {
      return null;
    }
  }, [reviewResult]);

  const originalContent = writerResult?.output ?? "";
  const rewrittenContent =
    rewriteResult?.status === "completed" ? rewriteResult.output : null;
  const hasRewrite = !!rewrittenContent;
  const rewriteFailed = rewriteResult?.status === "error";
  const rewriteRunning = rewriteResult?.status === "running";

  if (!review) {
    return (
      <Empty className="h-[60vh]">
        <EmptyMedia variant="icon">
          <SearchCheckIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Đánh giá chương</EmptyTitle>
          <EmptyDescription>
            AI sẽ đánh giá chương theo 4 tiêu chí: nhân vật, cốt truyện, giọng
            văn và quy tắc thế giới. Kết quả hiển thị sau bước Viết.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const hasCritical = review.issues.some((i) => i.severity === "critical");
  const hasIssues = review.issues.length > 0;
  const scoreColor =
    review.overallScore >= 8
      ? "text-green-500"
      : review.overallScore >= 6
        ? "text-yellow-500"
        : "text-red-500";

  return (
    <div className="flex h-full flex-col pb-1">
      {/* Score header + view toggle */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Đánh giá chương</span>
          {hasRewrite && (
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button
                onClick={() => setViewMode("issues")}
                className={`flex items-center gap-1 px-2 py-1 transition-colors ${
                  viewMode === "issues"
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/50"
                }`}
              >
                <ListIcon className="h-3 w-3" />
                Vấn đề
              </button>
              <button
                onClick={() => setViewMode("diff")}
                className={`flex items-center gap-1 px-2 py-1 transition-colors border-l ${
                  viewMode === "diff"
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/50"
                }`}
              >
                <DiffIcon className="h-3 w-3" />
                So sánh
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRegenerateReviewAction && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRegenerateReviewAction}
              title="Đánh giá lại"
            >
              <RefreshCwIcon className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
              {review.overallScore}
            </span>
            <span className="text-xs text-muted-foreground">/10</span>
          </div>
        </div>
      </div>

      {/* Content: issues list or diff view */}
      {viewMode === "diff" && hasRewrite ? (
        <div className="flex-1 min-h-0 p-4">
          <InlineDiffViewer
            original={originalContent}
            modified={rewrittenContent!}
            className="h-full"
          />
        </div>
      ) : (
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 pb-1">
            <p className="text-sm leading-relaxed">{review.summary}</p>

            {hasIssues ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  Vấn đề ({review.issues.length})
                </h4>
                {review.issues.map((issue, i) => {
                  const severityConf =
                    SEVERITY_CONFIG[
                      issue.severity as keyof typeof SEVERITY_CONFIG
                    ] ?? SEVERITY_CONFIG.suggestion;
                  const Icon = severityConf.icon;
                  return (
                    <Card key={i} className="gap-0 mx-1">
                      <CardHeader className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${severityConf.color}`}
                          />
                          <CardTitle className="text-xs flex-1">
                            {issue.description}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {TYPE_LABELS[
                              issue.type as keyof typeof TYPE_LABELS
                            ] ?? issue.type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 pb-2 pt-0">
                        <p className="text-xs text-muted-foreground">
                          Vị trí: {issue.location}
                        </p>
                        <p className="text-xs mt-1">
                          Gợi ý: {issue.suggestion}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <CheckCircle2Icon className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  Không tìm thấy vấn đề — chương đạt chất lượng tốt!
                </span>
              </div>
            )}

            {rewriteFailed && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <XCircleIcon className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {rewriteResult?.error
                    ? `Viết lại thất bại: ${rewriteResult.error}`
                    : "Viết lại thất bại — nhấn \"Viết lại\" để thử lại"}
                </span>
              </div>
            )}

            {hasRewrite && !rewriteFailed && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <CheckCircle2Icon className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Đã viết lại — xem tab &quot;So sánh&quot; để xem thay đổi
                </span>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Action buttons */}
      <div className="border-t p-3 flex gap-2">
        {hasIssues && (
          <Button
            onClick={onRewriteAction}
            disabled={isRewriting || rewriteRunning}
            className="flex-1"
            variant={hasRewrite ? "outline" : hasCritical ? "default" : "outline"}
          >
            {isRewriting || rewriteRunning ? (
              <>
                <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
                Đang viết lại...
              </>
            ) : hasRewrite ? (
              <>
                <RefreshCwIcon className="h-4 w-4 mr-1" />
                Viết lại khác
              </>
            ) : (
              <>
                <PenLineIcon className="h-4 w-4 mr-1" />
                Viết lại
              </>
            )}
          </Button>
        )}
        <Button onClick={onSaveAction} className="flex-1">
          <SaveIcon className="h-4 w-4 mr-1" />
          {hasRewrite ? "Lưu bản viết lại" : "Lưu chương"}
        </Button>
      </div>
    </div>
  );
}
