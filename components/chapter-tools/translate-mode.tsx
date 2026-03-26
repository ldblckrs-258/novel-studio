"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  GaugeIcon,
  LanguagesIcon,
  TelescopeIcon,
  ZapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useChapterTools } from "@/lib/stores/chapter-tools";
import { useAnalysisSettings, useChatSettings, useAIProvider } from "@/lib/hooks";
import { resolveChapterToolPrompts, DEFAULT_TRANSLATE_SYSTEM } from "@/lib/chapter-tools/prompts";
import { buildTranslateContext, type ContextDepth } from "@/lib/chapter-tools/context";
import { resolveChapterToolModel, runChapterToolStream } from "@/lib/chapter-tools/stream-runner";
import { TITLE_SEPARATOR, parseTranslateResult } from "@/lib/chapter-tools/bulk-translate";
import { getMergedNameDict } from "@/lib/hooks/use-name-entries";
import { ToolConfig } from "./tool-config";
import { StreamingDisplay } from "./streaming-display";

const DEPTH_OPTIONS: {
  value: ContextDepth;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: "quick",
    label: "Nhanh",
    description: "3 chương trước, không metadata",
    icon: ZapIcon,
  },
  {
    value: "standard",
    label: "Tiêu chuẩn",
    description: "8 chương + tên nhân vật, địa danh",
    icon: GaugeIcon,
  },
  {
    value: "deep",
    label: "Chi tiết",
    description: "20 chương + thế giới quan đầy đủ",
    icon: TelescopeIcon,
  },
];

interface TranslateSummary {
  originalLines: number;
  translatedLines: number;
  oldTitle: string | null;
  newTitle: string | null;
}

export interface TranslateResult {
  content: string;
  title?: string;
}

export function TranslateMode({
  content,
  novelId,
  chapterOrder,
  chapterTitle,
  onTranslated,
  onRevert,
  renderFooter,
}: {
  content: string;
  novelId: string;
  chapterOrder: number;
  chapterTitle: string;
  onTranslated: (result: TranslateResult) => void;
  onRevert: () => void;
  renderFooter: (node: React.ReactNode) => void;
}) {
  const isStreaming = useChapterTools((s) => s.isStreaming);
  const streamingContent = useChapterTools((s) => s.streamingContent);
  const clearResult = useChapterTools((s) => s.clearResult);

  const settings = useAnalysisSettings();
  const chatSettings = useChatSettings();
  const provider = useAIProvider(chatSettings?.providerId);
  const [hasContext, setHasContext] = useState<boolean | null>(null);
  const [depth, setDepth] = useState<ContextDepth>("standard");
  const [translateTitle, setTranslateTitle] = useState(true);
  const [useNameDict, setUseNameDict] = useState(false);
  const [summary, setSummary] = useState<TranslateSummary | null>(null);

  const handleTranslate = useCallback(async () => {
    setSummary(null);

    if (!content.trim()) {
      toast.error("Không có nội dung để dịch");
      return;
    }

    const nameDict = useNameDict
      ? await getMergedNameDict(novelId)
      : undefined;
    const [model, context] = await Promise.all([
      resolveChapterToolModel(settings.translateModel, provider, chatSettings),
      buildTranslateContext(novelId, chapterOrder, depth, nameDict),
    ]);
    setHasContext(context !== null);

    if (!model) {
      toast.error("Vui lòng cấu hình nhà cung cấp AI trong Cài đặt.");
      return;
    }

    const prompts = resolveChapterToolPrompts(settings);
    let systemPrompt = prompts.translate;
    if (translateTitle) {
      systemPrompt += `\n\nNgoài nội dung chương, bạn cũng cần dịch tiêu đề chương. Định dạng kết quả:\n<tiêu đề đã dịch>\n${TITLE_SEPARATOR}\n<nội dung đã dịch>`;
    }
    if (context) {
      systemPrompt += `\n\n${context}`;
    }

    const userPrompt = translateTitle
      ? `Tiêu đề: ${chapterTitle}\n${TITLE_SEPARATOR}\n${content}`
      : content;

    const result = await runChapterToolStream({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      cancelMessage: "Đã hủy dịch.",
      errorPrefix: "Dịch thất bại",
    });

    if (!result) return;

    const parsed = parseTranslateResult(result, translateTitle);
    const originalLines = content.split("\n").length;
    const translatedLines = parsed.content.split("\n").length;

    onTranslated({
      content: parsed.content,
      title: parsed.title ?? undefined,
    });
    clearResult();

    setSummary({
      originalLines,
      translatedLines,
      oldTitle: translateTitle ? chapterTitle : null,
      newTitle: parsed.title,
    });

    toast.success("Đã áp dụng bản dịch");
  }, [content, novelId, chapterOrder, chapterTitle, depth, translateTitle, settings, provider, chatSettings, onTranslated, clearResult]);

  const showConfig = !isStreaming && !summary;

  // Push footer actions to the panel's fixed footer via effect
  const handleReTranslate = useCallback(() => {
    onRevert();
    setSummary(null);
  }, [onRevert]);

  useEffect(() => {
    if (isStreaming) {
      renderFooter(null);
      return;
    }
    if (summary) {
      renderFooter(
        <Button onClick={handleReTranslate} variant="outline" className="w-full">
          <LanguagesIcon className="mr-1.5 size-3.5" />
          Dịch lại
        </Button>,
      );
      return;
    }
    renderFooter(
      <Button onClick={handleTranslate} className="w-full">
        <LanguagesIcon className="mr-1.5 size-3.5" />
        Dịch chương
      </Button>,
    );
    return () => renderFooter(null);
  }, [isStreaming, summary, handleTranslate, handleReTranslate, renderFooter]);

  return (
    <div className="space-y-4">
      <ToolConfig
        modelKey="translateModel"
        promptKey="translatePrompt"
        defaultPrompt={DEFAULT_TRANSLATE_SYSTEM}
        modelLabel="Mô hình dịch"
        promptLabel="Prompt dịch thuật"
      />

      {/* Translate title toggle + name dict toggle */}
      {showConfig && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="translate-title"
              checked={translateTitle}
              onCheckedChange={(v) => setTranslateTitle(v === true)}
            />
            <Label htmlFor="translate-title" className="text-xs cursor-pointer">
              Dịch tiêu đề chương
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="use-name-dict"
              checked={useNameDict}
              onCheckedChange={(v) => setUseNameDict(v === true)}
            />
            <Label htmlFor="use-name-dict" className="text-xs cursor-pointer">
              Sử dụng từ điển tên
            </Label>
          </div>
        </div>
      )}

      {/* Context depth selector */}
      {showConfig && (
        <div>
          <p className="mb-2 text-xs font-medium">Ngữ cảnh</p>
          <div className="flex gap-2">
            {DEPTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDepth(opt.value)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 text-center transition-colors ${
                  depth === opt.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <opt.icon className="size-3.5" />
                <span className="text-xs font-medium">{opt.label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasContext === false && !summary && (
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
        />
      )}

      {/* Translation summary */}
      {summary && !isStreaming && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2Icon className="size-4 shrink-0" />
            <span className="text-xs font-medium">Đã dịch và áp dụng thành công</span>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-xs">
            {summary.newTitle && (
              <div>
                <span className="text-muted-foreground">Tiêu đề: </span>
                <span className="line-through text-muted-foreground/60">{summary.oldTitle}</span>
                {" → "}
                <span className="font-medium">{summary.newTitle}</span>
              </div>
            )}
            <div className="text-muted-foreground">
              {summary.originalLines} dòng gốc → {summary.translatedLines} dòng dịch
              {summary.translatedLines !== summary.originalLines && (
                <span className={summary.translatedLines > summary.originalLines ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                  {" "}({summary.translatedLines > summary.originalLines ? "+" : ""}{summary.translatedLines - summary.originalLines})
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
