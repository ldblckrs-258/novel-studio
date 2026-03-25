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
    return getModel(provider, chatSettings.modelId);
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
    useChapterTools.getState().setStreamingContent(accumulated);
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
    useChapterTools.getState().setStreamingContent(accumulated);
    useChapterTools.getState().finishStreaming(accumulated);
    opts.onComplete?.(accumulated);
    return accumulated;
  } catch (err) {
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
