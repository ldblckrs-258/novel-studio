"use client";

import { AnalysisProgress } from "@/components/analysis-progress";
import {
  AnalysisStepConfig,
  type StepDef,
} from "@/components/analysis-step-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmInterruptDialog } from "@/components/ui/confirm-interrupt-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getModel } from "@/lib/ai/provider";
import {
  analyzeNovel,
  analyzeNovelIncremental,
  type AnalysisDepth,
  type AnalysisProgress as AnalysisProgressData,
  type SkipPhases,
  DEFAULT_CHAPTER_ANALYSIS_SYSTEM,
  DEFAULT_NOVEL_AGGREGATION_SYSTEM,
  DEFAULT_CHARACTER_PROFILING_SYSTEM,
} from "@/lib/analysis";
import { db } from "@/lib/db";
import {
  useAIProvider,
  useAnalysisSettings,
  useConfirmInterrupt,
  useChatSettings,
  useHasAnalyzedChapters,
} from "@/lib/hooks";
import { useAnalysisStore } from "@/lib/stores/analysis";
import {
  BookOpenIcon,
  GaugeIcon,
  GlobeIcon,
  SettingsIcon,
  TelescopeIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

type AnalysisMode = "full" | "incremental" | "selected";

const DEPTH_OPTIONS: {
  value: AnalysisDepth;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: "quick",
    label: "Nhanh",
    description: "Ít token, kết quả sơ bộ",
    icon: ZapIcon,
  },
  {
    value: "standard",
    label: "Tiêu chuẩn",
    description: "Cân bằng chất lượng/chi phí",
    icon: GaugeIcon,
  },
  {
    value: "deep",
    label: "Chi tiết",
    description: "Nhiều token, kết quả sâu",
    icon: TelescopeIcon,
  },
];

const STEP_DEFS: StepDef[] = [
  {
    key: "chapters",
    label: "Phân tích chương",
    description: "Tóm tắt, phân cảnh chính, nhận diện nhân vật",
    modelKey: "chapterModel",
    promptKey: "chapterAnalysisPrompt",
    promptLabel: "Phân tích chương",
    defaultPrompt: DEFAULT_CHAPTER_ANALYSIS_SYSTEM,
    icon: BookOpenIcon,
  },
  {
    key: "aggregation",
    label: "Tổng hợp tiểu thuyết",
    description: "Thể loại, tóm tắt, thế giới quan, phe phái",
    modelKey: "aggregationModel",
    promptKey: "novelAggregationPrompt",
    promptLabel: "Tổng quan tiểu thuyết",
    defaultPrompt: DEFAULT_NOVEL_AGGREGATION_SYSTEM,
    icon: GlobeIcon,
  },
  {
    key: "characters",
    label: "Hồ sơ nhân vật",
    description: "Ngoại hình, tính cách, mối quan hệ, cung nhân vật",
    modelKey: "characterModel",
    promptKey: "characterProfilingPrompt",
    promptLabel: "Lập hồ sơ nhân vật",
    defaultPrompt: DEFAULT_CHARACTER_PROFILING_SYSTEM,
    icon: UsersIcon,
  },
];

export function AnalysisDialog({
  open,
  onOpenChange,
  novelId,
  mode,
  selectedChapterIds,
  totalChapters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  mode: AnalysisMode;
  selectedChapterIds?: string[];
  totalChapters: number;
}) {
  const chatSettings = useChatSettings();
  const provider = useAIProvider(chatSettings?.providerId);
  const analysisSettings = useAnalysisSettings();
  const hasAnalyzedChapters = useHasAnalyzedChapters(novelId);
  const {
    isAnalyzing,
    phase,
    errors,
    enabledSteps,
    start,
    updateProgress,
    setPhase,
    addError,
    setError,
    setResultSummary,
    setPhaseResult,
    addFailedChapterIds,
    setEnabledSteps,
    reset,
    resetForRetry,
  } = useAnalysisStore();
  const isDone =
    phase === "complete" ||
    phase === "completed_with_errors" ||
    phase === "error";

  const { showConfirm, guard, confirm, dismiss } = useConfirmInterrupt(
    isAnalyzing && !isDone,
  );
  const [depth, setDepth] = useState<AnalysisDepth>("standard");
  const [showConfigOnError, setShowConfigOnError] = useState(false);

  const modeLabel =
    mode === "full"
      ? "Phân tích toàn bộ"
      : mode === "incremental"
        ? "Phân tích còn lại"
        : `Phân tích đã chọn (${selectedChapterIds?.length ?? 0})`;

  const resolveStep = useCallback(
    async (cfg: { providerId: string; modelId: string } | undefined) => {
      if (!cfg?.providerId || !cfg?.modelId) return undefined;
      const p = await db.aiProviders.get(cfg.providerId);
      if (!p) return undefined;
      return await getModel(p, cfg.modelId);
    },
    [],
  );

  const runPipeline = useCallback(
    async (skipPhases?: SkipPhases, retryChapterIds?: string[]) => {
      if (!provider || !chatSettings?.modelId) return;

      const [chapterStepModel, aggregationStepModel, characterStepModel] =
        await Promise.all([
          resolveStep(analysisSettings.chapterModel),
          resolveStep(analysisSettings.aggregationModel),
          resolveStep(analysisSettings.characterModel),
        ]);

      const onProgress = (progress: AnalysisProgressData) => {
        updateProgress(progress.chaptersCompleted, progress.totalChapters);
        setPhase(progress.phase as never);
        if (progress.error) {
          addError(progress.error);
          if (progress.error.chapterIds) {
            addFailedChapterIds(progress.error.chapterIds);
          }
        }
        if (progress.phaseResult) {
          setPhaseResult(
            progress.phaseResult.phase as
              | "chapters"
              | "aggregation"
              | "characters",
            progress.phaseResult.result,
          );
        }
      };

      const commonOpts = {
        novelId,
        defaultModel: await getModel(provider, chatSettings.modelId),
        signal: useAnalysisStore.getState().abortController?.signal,
        depth,
        customPrompts: {
          chapterAnalysis: analysisSettings.chapterAnalysisPrompt,
          novelAggregation: analysisSettings.novelAggregationPrompt,
          characterProfiling: analysisSettings.characterProfilingPrompt,
        },
        stepModels: {
          chapters: chapterStepModel,
          aggregation: aggregationStepModel,
          characters: characterStepModel,
        },
        globalSystemInstruction: chatSettings.globalSystemInstruction,
        skipPhases,
        selectedChapterIds:
          retryChapterIds ??
          (mode === "selected" ? selectedChapterIds : undefined),
        onProgress,
      };

      try {
        if (mode === "full") {
          await analyzeNovel(commonOpts);
        } else {
          const result = await analyzeNovelIncremental(commonOpts);
          setResultSummary(result);
        }
        const storeErrors = useAnalysisStore.getState().errors;
        if (storeErrors.length > 0) {
          setPhase("completed_with_errors" as never);
        } else {
          setPhase("complete" as never);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          toast.info("Đã hủy phân tích.");
          reset();
        } else {
          const msg =
            error instanceof Error ? error.message : "Unknown error";
          setError(msg);
          toast.error(`Phân tích thất bại: ${msg}`);
        }
      }
    },
    [
      provider,
      chatSettings,
      novelId,
      mode,
      selectedChapterIds,
      depth,
      analysisSettings,
      updateProgress,
      setPhase,
      addError,
      setResultSummary,
      setPhaseResult,
      addFailedChapterIds,
      resolveStep,
      reset,
      setError,
    ],
  );

  const handleRun = useCallback(async () => {
    if (!provider || !chatSettings?.modelId) {
      toast.error("Vui lòng cấu hình nhà cung cấp AI trong Cài đặt trước.");
      return;
    }

    const count =
      mode === "selected"
        ? (selectedChapterIds?.length ?? 0)
        : totalChapters;
    start(novelId, count);
    setShowConfigOnError(false);

    const skipPhases: SkipPhases = {
      chapters: !enabledSteps.chapters,
      aggregation: !enabledSteps.aggregation,
      characters: !enabledSteps.characters,
    };

    await runPipeline(skipPhases);
  }, [
    provider,
    chatSettings,
    novelId,
    mode,
    selectedChapterIds,
    totalChapters,
    enabledSteps,
    start,
    runPipeline,
  ]);

  const handleRetry = useCallback(async () => {
    if (!provider || !chatSettings?.modelId) return;

    const currentPhaseResults = useAnalysisStore.getState().phaseResults;
    const currentFailedIds = useAnalysisStore.getState().failedChapterIds;

    const skipPhases: SkipPhases = {
      chapters:
        currentPhaseResults.chapters === "done" ||
        currentPhaseResults.chapters === "skipped",
      aggregation:
        currentPhaseResults.aggregation === "done" ||
        currentPhaseResults.aggregation === "skipped",
      characters:
        currentPhaseResults.characters === "done" ||
        currentPhaseResults.characters === "skipped",
    };

    const retryChapterIds =
      currentPhaseResults.chapters === "error" && currentFailedIds.length > 0
        ? [...new Set(currentFailedIds)]
        : undefined;

    setShowConfigOnError(false);
    resetForRetry();
    await runPipeline(skipPhases, retryChapterIds);
  }, [provider, chatSettings, resetForRetry, runPipeline]);

  const handleStepToggle = useCallback(
    (step: "chapters" | "aggregation" | "characters", checked: boolean) => {
      if (step === "chapters" && !checked && !hasAnalyzedChapters) {
        toast.warning("Cần phân tích chương trước khi bỏ qua bước này.");
        return;
      }

      const next = { ...enabledSteps, [step]: checked };
      if (!next.chapters && !next.aggregation && !next.characters) {
        toast.warning("Cần bật ít nhất một bước phân tích.");
        return;
      }

      setEnabledSteps({ [step]: checked });
    },
    [enabledSteps, hasAnalyzedChapters, setEnabledSteps],
  );

  const showConfig = !isAnalyzing && !isDone;
  const showErrorConfig = isDone && errors.length > 0 && showConfigOnError;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          guard(() => {
            useAnalysisStore.getState().cancel();
            reset();
            onOpenChange(false);
          });
        } else {
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <ConfirmInterruptDialog
          open={showConfirm}
          onConfirm={confirm}
          onCancel={dismiss}
        />
        <DialogHeader>
          <DialogTitle>{modeLabel}</DialogTitle>
          <DialogDescription>
            {mode === "full"
              ? "Phân tích tất cả chương từ đầu."
              : mode === "incremental"
                ? "Chỉ phân tích các chương mới hoặc đã sửa đổi."
                : `Phân tích ${selectedChapterIds?.length ?? 0} chương đã chọn.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-4 p-1 pr-4">
            {/* Running state */}
            {isAnalyzing && !isDone && <AnalysisProgress />}

            {/* Done state */}
            {isDone && <AnalysisProgress />}

            {/* Config: initial or error-retry config */}
            {(showConfig || showErrorConfig) && (
              <div className="space-y-4">
                {showErrorConfig && (
                  <p className="text-xs text-muted-foreground">
                    Điều chỉnh cấu hình bên dưới rồi nhấn &ldquo;Chạy lại&rdquo;.
                  </p>
                )}

                {/* Depth selector */}
                <div>
                  <p className="mb-2 text-xs font-medium">Độ sâu phân tích</p>
                  <div className="grid grid-cols-3 gap-2">
                    {DEPTH_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDepth(opt.value)}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-center transition-colors ${
                          depth === opt.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <opt.icon className="size-4" />
                        <span className="text-xs font-medium">{opt.label}</span>
                        <span className="text-[10px] leading-tight text-muted-foreground">
                          {opt.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step-based config cards */}
                <div>
                  <p className="mb-2 text-xs font-medium">Các bước</p>
                  <div className="space-y-2">
                    {STEP_DEFS.map((step, i) => (
                      <AnalysisStepConfig
                        key={step.key}
                        step={step}
                        number={i + 1}
                        enabled={enabledSteps[step.key]}
                        onToggle={(checked) =>
                          handleStepToggle(step.key, checked)
                        }
                        disableToggle={
                          step.key === "chapters" && !hasAnalyzedChapters
                        }
                      />
                    ))}
                  </div>
                </div>

                {!provider && (
                  <p className="text-xs text-amber-500">
                    Chưa cấu hình nhà cung cấp AI.{" "}
                    <a href="/settings/providers" className="underline">
                      Thêm ngay
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer: initial config */}
        {showConfig && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleRun} disabled={!provider}>
              Bắt đầu phân tích
            </Button>
          </div>
        )}

        {/* Footer: done with errors — show config toggle + retry */}
        {isDone && errors.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfigOnError((v) => !v)}
              className="text-xs text-muted-foreground"
            >
              <SettingsIcon className="mr-1.5 size-3.5" />
              {showConfigOnError ? "Ẩn cấu hình" : "Sửa cấu hình"}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={!provider}
              >
                Chạy lại phần thất bại
              </Button>
              <Button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}

        {/* Footer: done without errors */}
        {isDone && errors.length === 0 && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Đóng
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
