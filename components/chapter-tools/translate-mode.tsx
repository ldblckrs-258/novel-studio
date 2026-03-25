"use client";

import { useCallback, useState } from "react";
import { AlertTriangleIcon, LanguagesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useChapterTools } from "@/lib/stores/chapter-tools";
import { useAnalysisSettings, useChatSettings, useAIProvider } from "@/lib/hooks";
import { resolveChapterToolPrompts, DEFAULT_TRANSLATE_SYSTEM } from "@/lib/chapter-tools/prompts";
import { buildTranslateContext } from "@/lib/chapter-tools/context";
import { resolveChapterToolModel, runChapterToolStream } from "@/lib/chapter-tools/stream-runner";
import { ToolConfig } from "./tool-config";
import { StreamingDisplay } from "./streaming-display";

export function TranslateMode({
  content,
  novelId,
  chapterOrder,
}: {
  content: string;
  novelId: string;
  chapterOrder: number;
}) {
  const isStreaming = useChapterTools((s) => s.isStreaming);
  const streamingContent = useChapterTools((s) => s.streamingContent);
  const completedResult = useChapterTools((s) => s.completedResult);
  const cancelStreaming = useChapterTools((s) => s.cancelStreaming);

  const settings = useAnalysisSettings();
  const chatSettings = useChatSettings();
  const provider = useAIProvider(chatSettings?.providerId);
  const [hasContext, setHasContext] = useState<boolean | null>(null);

  const handleTranslate = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Không có nội dung để dịch");
      return;
    }

    const [model, context] = await Promise.all([
      resolveChapterToolModel(settings.translateModel, provider, chatSettings),
      buildTranslateContext(novelId, chapterOrder),
    ]);
    setHasContext(context !== null);

    if (!model) {
      toast.error("Vui lòng cấu hình nhà cung cấp AI trong Cài đặt.");
      return;
    }

    const prompts = resolveChapterToolPrompts(settings);
    const systemPrompt = context
      ? `${prompts.translate}\n\n## Ngữ cảnh các chương trước:\n${context}`
      : prompts.translate;

    await runChapterToolStream({
      model,
      system: systemPrompt,
      prompt: content,
      cancelMessage: "Đã hủy dịch.",
      errorPrefix: "Dịch thất bại",
    });
  }, [content, novelId, chapterOrder, settings, provider, chatSettings]);

  return (
    <div className="space-y-4">
      <ToolConfig
        modelKey="translateModel"
        promptKey="translatePrompt"
        defaultPrompt={DEFAULT_TRANSLATE_SYSTEM}
        modelLabel="Mô hình dịch"
        promptLabel="Prompt dịch thuật"
      />

      {hasContext === false && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          <AlertTriangleIcon className="size-4 shrink-0" />
          <span>
            Chưa có context chương trước. Hãy phân tích truyện trước để có chất
            lượng dịch tốt hơn.
          </span>
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
        <Button onClick={handleTranslate} className="w-full">
          <LanguagesIcon className="mr-1.5 size-3.5" />
          Dịch chương
        </Button>
      )}
    </div>
  );
}
