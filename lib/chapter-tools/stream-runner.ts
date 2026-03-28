import { streamText } from "ai";
import type { LanguageModel } from "ai";
import { toast } from "sonner";
import { getModel } from "@/lib/ai/provider";
import { resolveStep } from "@/lib/ai/resolve-step";
import type { StepModelConfig, AIProvider, ChatSettings } from "@/lib/db";
import { useChapterTools } from "@/lib/stores/chapter-tools";

/**
 * Resolve a per-mode model or fall back to the default chat model.
 */
export async function resolveChapterToolModel(
  stepConfig: StepModelConfig | undefined,
  provider: AIProvider | undefined,
  chatSettings: ChatSettings | undefined,
): Promise<LanguageModel | null> {
  const stepModel = await resolveStep(stepConfig);
  if (stepModel) return stepModel;
  if (provider && chatSettings?.modelId) {
    return await getModel(provider, chatSettings.modelId);
  }
  return null;
}

/**
 * Run a streaming AI call with RAF-throttled store updates.
 * Returns the accumulated result string, or null if cancelled/failed.
 */
export async function runChapterToolStream(opts: {
  model: LanguageModel;
  system: string;
  prompt: string;
  cancelMessage: string;
  errorPrefix: string;
  onComplete?: (result: string) => void;
}): Promise<string | null> {
  const store = useChapterTools.getState();
  store.startStreaming();
  const controller = useChapterTools.getState().abortController;

  let accumulated = "";
  let rafId = 0;
  const flush = () => {
    // Guard: only flush if still streaming (prevents stale RAF after cancel)
    if (useChapterTools.getState().isStreaming) {
      useChapterTools.getState().setStreamingContent(accumulated);
    }
    rafId = 0;
  };

  try {
    const result = streamText({
      model: opts.model,
      system: opts.system,
      prompt: opts.prompt,
      abortSignal: controller?.signal,
    });

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        accumulated += part.text;
        if (!rafId) rafId = requestAnimationFrame(flush);
      }
    }
    cancelAnimationFrame(rafId);

    // If user cancelled while buffered chunks were still being consumed,
    // the loop may exit normally without throwing AbortError. Bail out.
    if (controller?.signal.aborted) {
      return null;
    }

    // Empty response = content likely filtered/prohibited by provider
    if (!accumulated.trim()) {
      const msg = "Nhà cung cấp AI trả về nội dung trống — có thể nội dung đã bị chặn bởi bộ lọc an toàn. Hãy thử chỉnh sửa prompt tùy chỉnh, Chỉ thị chung, hoặc đổi mô hình AI khác.";
      toast.error(msg);
      useChapterTools.getState().cancelStreaming();
      return null;
    }

    useChapterTools.getState().setStreamingContent(accumulated);
    useChapterTools.getState().finishStreaming(accumulated);
    opts.onComplete?.(accumulated);
    return accumulated;
  } catch (err) {
    // Cancel any pending RAF to prevent stale content flush after abort
    cancelAnimationFrame(rafId);
    if (err instanceof Error && err.name === "AbortError") {
      toast.info(opts.cancelMessage);
      return null;
    }
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    toast.error(`${opts.errorPrefix}: ${msg}`);
    useChapterTools.getState().cancelStreaming();
    return null;
  }
}
