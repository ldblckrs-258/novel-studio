"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useStepResult } from "@/lib/hooks";
import { useWritingPipelineStore } from "@/lib/stores/writing-pipeline";
import { countWords } from "@/lib/utils";
import { ArrowDownIcon, Loader2Icon, PenLineIcon, RefreshCwIcon } from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

function ScrollToBottomButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <button
      onClick={() => scrollToBottom()}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-md backdrop-blur-sm hover:bg-background transition-colors"
    >
      <ArrowDownIcon className="h-3 w-3" />
      Cuộn xuống
    </button>
  );
}

export function ChapterPreview({
  sessionId,
  onRegenerateAction,
}: {
  sessionId: string | undefined;
  onRegenerateAction?: () => void;
}) {
  const stepResult = useStepResult(sessionId, "writer");
  const streamingContent = useWritingPipelineStore((s) => s.streamingContent);
  const isRunning = useWritingPipelineStore((s) => s.isRunning);

  const content =
    isRunning && streamingContent
      ? streamingContent
      : (stepResult?.output ?? "");

  const wordCount = countWords(content);
  const isStreaming = isRunning && stepResult?.status === "running";

  if (!content && !isStreaming) {
    return (
      <Empty className="h-[60vh]">
        <EmptyMedia variant="icon">
          <PenLineIcon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Nội dung chương</EmptyTitle>
          <EmptyDescription>
            Nội dung sẽ được viết sau khi bạn duyệt giàn ý. AI sẽ viết từng
            phân cảnh và hiển thị real-time tại đây.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {isStreaming && (
            <Loader2Icon className="h-4 w-4 animate-spin text-primary" />
          )}
          <span className="text-sm font-medium">
            {isStreaming ? "Đang viết..." : "Nội dung chương"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {wordCount.toLocaleString()} từ
          </span>
          {isStreaming ? (
            <div className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
          ) : (
            onRegenerateAction && (
              <button
                onClick={onRegenerateAction}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Viết lại nội dung"
              >
                <RefreshCwIcon className="h-3 w-3" />
                Viết lại
              </button>
            )
          )}
        </div>
      </div>

      <StickToBottom className="relative flex-1 overflow-hidden" resize="smooth" initial="smooth">
        <StickToBottom.Content className="p-6">
          <div className="mx-auto max-w-2xl">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert font-serif leading-relaxed">
              {content}
              {isStreaming && (
                <span className="inline-block h-4 w-0.5 bg-foreground animate-pulse ml-0.5" />
              )}
            </div>
          </div>
        </StickToBottom.Content>
        <ScrollToBottomButton />
      </StickToBottom>
    </div>
  );
}
