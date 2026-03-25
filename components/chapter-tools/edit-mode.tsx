"use client";

import { useCallback } from "react";
import { PenLineIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useChapterTools } from "@/lib/stores/chapter-tools";
import { useAnalysisSettings, useChatSettings, useAIProvider } from "@/lib/hooks";
import { resolveChapterToolPrompts, DEFAULT_EDIT_SYSTEM } from "@/lib/chapter-tools/prompts";
import { buildMinimalContext } from "@/lib/chapter-tools/context";
import { resolveChapterToolModel, runChapterToolStream } from "@/lib/chapter-tools/stream-runner";
import { ToolConfig } from "./tool-config";
import { StreamingDisplay } from "./streaming-display";

export function EditMode({
  content,
  novelId,
  chapterId,
}: {
  content: string;
  novelId: string;
  chapterId: string;
}) {
  const isStreaming = useChapterTools((s) => s.isStreaming);
  const streamingContent = useChapterTools((s) => s.streamingContent);
  const completedResult = useChapterTools((s) => s.completedResult);
  const rawReviewResult = useChapterTools((s) => s.reviewResult);
  const reviewChapterId = useChapterTools((s) => s.reviewChapterId);
  const reviewResult = reviewChapterId === chapterId ? rawReviewResult : null;
  const cancelStreaming = useChapterTools((s) => s.cancelStreaming);

  const settings = useAnalysisSettings();
  const chatSettings = useChatSettings();
  const provider = useAIProvider(chatSettings?.providerId);

  const handleEdit = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Không có nội dung để chỉnh sửa");
      return;
    }

    const [model, minContext] = await Promise.all([
      resolveChapterToolModel(settings.editModel, provider, chatSettings),
      buildMinimalContext(novelId),
    ]);

    if (!model) {
      toast.error("Vui lòng cấu hình nhà cung cấp AI trong Cài đặt.");
      return;
    }

    const prompts = resolveChapterToolPrompts(settings);
    let userPrompt = content;
    if (reviewResult) {
      userPrompt = `## Nội dung chương:\n${content}\n\n## Đánh giá cần sửa:\n${reviewResult}`;
    }

    const systemPrompt = minContext
      ? `${prompts.edit}\n\n## Ngữ cảnh truyện:\n${minContext}`
      : prompts.edit;

    await runChapterToolStream({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      cancelMessage: "Đã hủy chỉnh sửa.",
      errorPrefix: "Chỉnh sửa thất bại",
    });
  }, [content, novelId, settings, provider, chatSettings, reviewResult]);

  return (
    <div className="space-y-4">
      <ToolConfig
        modelKey="editModel"
        promptKey="editPrompt"
        defaultPrompt={DEFAULT_EDIT_SYSTEM}
        modelLabel="Mô hình chỉnh sửa"
        promptLabel="Prompt chỉnh sửa"
      />

      {reviewResult && !isStreaming && !completedResult && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-2.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          <CheckIcon className="size-4 shrink-0" />
          <span>Đánh giá có sẵn — sẽ được sử dụng làm tham chiếu khi chỉnh sửa.</span>
        </div>
      )}

      {isStreaming && (
        <StreamingDisplay
          content={streamingContent}
          isStreaming
          onCancel={cancelStreaming}
        />
      )}

      {completedResult && !isStreaming && (
        <p className="text-xs text-muted-foreground">
          Kết quả hiển thị bên trái. Chỉnh sửa và nhấn &ldquo;Áp dụng&rdquo; để thay thế nội dung.
        </p>
      )}

      {!isStreaming && !completedResult && (
        <Button onClick={handleEdit} className="w-full">
          <PenLineIcon className="mr-1.5 size-3.5" />
          Chỉnh sửa chương
        </Button>
      )}
    </div>
  );
}
