"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WritingAgentRole } from "@/lib/db";
import { db } from "@/lib/db";
import {
  createWritingSession,
  updateChapterPlan,
  updateWritingSession,
  useActiveSession,
  useChapterPlans,
  useCharacters,
  useNovel,
  usePlotArcs,
  useSessionByPlan,
  useStepResults,
} from "@/lib/hooks";
import { useWritingPipelineStore } from "@/lib/stores/writing-pipeline";
import { runWritingPipeline } from "@/lib/writing";
import type {
  DirectionAgentOutput,
  OutlineAgentOutput,
} from "@/lib/writing/types";
import {
  ArrowLeftIcon,
  CompassIcon,
  ListTreeIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ChapterPreview } from "@/components/writing/chapter-preview";
import { DirectionSelector } from "@/components/writing/direction-selector";
import { IdeaForm, type IdeaFormData } from "@/components/writing/idea-form";
import { NovelSetup } from "@/components/writing/novel-setup";
import { OutlineEditor } from "@/components/writing/outline-editor";
import { PipelineProgress } from "@/components/writing/pipeline-progress";
import { ReviewPanel } from "@/components/writing/review-panel";
import { SetupWizard } from "@/components/writing/setup-wizard";
import { WritingSettingsDialog } from "@/components/writing/writing-settings-dialog";

// ─── State Detection ────────────────────────────────────────

type PageMode = "empty" | "wizard" | "dashboard" | "pipeline";

const StatusLabelMap: Record<
  "planned" | "writing" | "written" | "reviewed" | "saved",
  { text: string; color: string }
> = {
  planned: { text: "Dự định", color: "bg-secondary text-muted-foreground" },
  writing: { text: "Đang viết", color: "bg-blue-500/10 text-blue-600" },
  written: { text: "Viết xong", color: "bg-amber-500/10 text-amber-600" },
  reviewed: { text: "Đã review", color: "bg-orange-500/10 text-orange-600" },
  saved: { text: "Đã lưu", color: "bg-green-500/10 text-green-600" },
};

export default function AutoWritePage() {
  const { id: novelId } = useParams<{ id: string }>();
  const novel = useNovel(novelId);
  const chapterPlans = useChapterPlans(novelId);
  const characters = useCharacters(novelId);
  const plotArcs = usePlotArcs(novelId);
  const latestSession = useActiveSession(novelId);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Auto-select plan on first load: use latest session's plan, or first unwritten plan
  const autoSelectedPlanId = useMemo(() => {
    if (selectedPlanId) return selectedPlanId;
    if (latestSession?.chapterPlanId) return latestSession.chapterPlanId;
    const nextUnwritten = chapterPlans?.find((p) => p.status === "planned");
    return nextUnwritten?.id ?? chapterPlans?.[0]?.id ?? null;
  }, [selectedPlanId, latestSession?.chapterPlanId, chapterPlans]);

  const effectivePlanId = autoSelectedPlanId;
  const planSession = useSessionByPlan(effectivePlanId ?? undefined);
  const activeSession = effectivePlanId ? planSession : latestSession;
  const stepResults = useStepResults(activeSession?.id);

  const {
    isRunning,
    activePanel,
    setActivePanel,
    startPipeline,
    pausePipeline,
    cancelPipeline,
    appendStreamingContent,
    clearStreamingContent,
  } = useWritingPipelineStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [staleWarning, setStaleWarning] = useState(false);
  const [ideaData, setIdeaData] = useState<IdeaFormData | null>(null);
  const [modeOverride, setModeOverride] = useState<PageMode | null>(null);
  const [isGeneratingPlans, setIsGeneratingPlans] = useState(false);

  // ── 3-State Routing ───────────────────────────────────────

  const hasWorld = !!(novel?.worldOverview || novel?.factions?.length);
  const hasCharacters = (characters?.length ?? 0) > 0;
  const hasPlotArcs = (plotArcs?.length ?? 0) > 0;
  const hasChapterPlans = (chapterPlans?.length ?? 0) > 0;
  const hasPartialData = hasWorld || hasCharacters;

  const autoMode = useMemo((): PageMode => {
    if (hasChapterPlans && hasPlotArcs) return "pipeline";
    if (hasPartialData) return "dashboard";
    return "empty";
  }, [hasChapterPlans, hasPlotArcs, hasPartialData]);

  const mode = modeOverride ?? autoMode;

  // Reset override when data changes enough to move to pipeline
  useEffect(() => {
    if (hasChapterPlans && hasPlotArcs && modeOverride !== "pipeline") {
      setModeOverride(null);
    }
  }, [hasChapterPlans, hasPlotArcs, modeOverride]);

  // ── Pipeline Data ─────────────────────────────────────────

  const nextPlan = useMemo(
    () => chapterPlans?.find((p) => p.status === "planned") ?? null,
    [chapterPlans],
  );

  const resultMap = useMemo(
    () => new Map(stepResults?.map((r) => [r.role, r]) ?? []),
    [stepResults],
  );

  const directionOutput = useMemo(() => {
    const raw = resultMap.get("direction")?.output;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DirectionAgentOutput;
    } catch {
      return null;
    }
  }, [resultMap]);

  const outlineOutput = useMemo(() => {
    const raw = resultMap.get("outline")?.output;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OutlineAgentOutput;
    } catch {
      return null;
    }
  }, [resultMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPipeline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pipeline Control ──────────────────────────────────────

  const handleStartPipeline = useCallback(
    async (planId?: string) => {
      const targetPlanId = planId ?? effectivePlanId ?? nextPlan?.id;
      if (!targetPlanId) return;

      let sessionId = activeSession?.id;
      if (!sessionId) {
        sessionId = await createWritingSession({
          novelId,
          chapterPlanId: targetPlanId,
          currentStep: "context",
          status: "active",
        });
      }

      const controller = startPipeline(sessionId);
      clearStreamingContent();

      const result = await runWritingPipeline({
        novelId,
        sessionId,
        abortSignal: controller.signal,
        onStepStart: (role) => {
          if (role === "writer") setActivePanel("content");
        },
        onStepComplete: (role) => {
          switch (role) {
            case "context":
              // context done → direction is next, stay on pipeline tab
              setActivePanel("pipeline");
              break;
            case "direction":
              // direction done → show direction selector on pipeline tab
              setActivePanel("pipeline");
              break;
            case "outline":
              // outline done → show outline editor
              setActivePanel("outline");
              break;
            case "writer":
              // writer done → review is next, switch to review
              setActivePanel("review");
              break;
            case "review":
              setActivePanel("review");
              break;
          }
        },
        onWriterChunk: (chunk) => {
          appendStreamingContent(chunk);
        },
      });

      // Pipeline returned — stop the running state
      useWritingPipelineStore.getState().abortController = null;
      useWritingPipelineStore.setState({ isRunning: false });

      if (result === "awaiting-input") {
        const session = await db.writingSessions.get(sessionId!);
        if (session?.currentStep === "direction") setActivePanel("pipeline");
        else if (session?.currentStep === "outline") setActivePanel("outline");
      } else if (result === "stale-context") {
        setStaleWarning(true);
      } else if (result === "completed") {
        setActivePanel("review");
      }
    },
    [
      novelId,
      activeSession,
      effectivePlanId,
      nextPlan,
      startPipeline,
      clearStreamingContent,
      appendStreamingContent,
      setActivePanel,
    ],
  );

  const handleDirectionConfirm = useCallback(
    async (directions: string[]) => {
      if (!activeSession) return;
      const plan = await db.chapterPlans.get(activeSession.chapterPlanId);
      if (!plan) return;
      await updateChapterPlan(plan.id, { directions });
      await updateWritingSession(activeSession.id, { currentStep: "outline" });
      handleStartPipeline();
    },
    [activeSession, handleStartPipeline],
  );

  const handleOutlineApprove = useCallback(
    async (scenes: import("@/lib/writing/types").OutlineScene[]) => {
      if (!activeSession || !outlineOutput) return;
      const plan = await db.chapterPlans.get(activeSession.chapterPlanId);
      if (!plan) return;
      await updateChapterPlan(plan.id, {
        outline: outlineOutput.synopsis,
        scenes: scenes.map((s) => ({
          title: s.title,
          summary: s.summary,
          characters: s.characters,
          location: s.location,
          mood: s.mood,
        })),
        title: outlineOutput.chapterTitle,
      });
      await updateWritingSession(activeSession.id, { currentStep: "writer" });
      handleStartPipeline();
    },
    [activeSession, outlineOutput, handleStartPipeline],
  );

  const selectNextPlan = useCallback(() => {
    if (!chapterPlans || !effectivePlanId) return;
    const currentIdx = chapterPlans.findIndex((p) => p.id === effectivePlanId);
    const next = chapterPlans.find(
      (p, i) => i > currentIdx && p.status === "planned",
    );
    if (next) {
      setSelectedPlanId(next.id);
      setActivePanel("pipeline");
    } else {
      setActivePanel("pipeline");
    }
  }, [chapterPlans, effectivePlanId, setActivePanel]);

  const handleGenerateMorePlans = useCallback(async () => {
    if (!chapterPlans) return;
    const total = chapterPlans.length;
    const saved = chapterPlans.filter((p) => p.status === "saved").length;
    const completionPct = total > 0 ? (saved / total) * 100 : 0;

    if (completionPct < 70) {
      toast.warning(
        `Mới lưu ${saved}/${total} chương (${Math.round(completionPct)}%). Nên lưu ít nhất 70% trước khi tạo thêm.`,
      );
      return;
    }

    setIsGeneratingPlans(true);
    try {
      const { generateFromExisting } =
        await import("@/lib/writing/auto-generate");
      await generateFromExisting(novelId);
      toast.success("Đã tạo thêm kế hoạch chương mới");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setIsGeneratingPlans(false);
    }
  }, [chapterPlans, novelId]);

  const [isRewriting, setIsRewriting] = useState(false);

  const handleRewrite = useCallback(async () => {
    if (!activeSession) return;
    setIsRewriting(true);
    clearStreamingContent();
    try {
      const { runRewriteStep } = await import("@/lib/writing/orchestrator");
      await runRewriteStep({
        novelId,
        sessionId: activeSession.id,
        onChunk: (chunk) => appendStreamingContent(chunk),
      });
      toast.success("Đã viết lại chương");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error(err.message);
      }
    } finally {
      setIsRewriting(false);
    }
  }, [activeSession, novelId, clearStreamingContent, appendStreamingContent]);

  const handleSaveChapter = useCallback(async () => {
    if (!activeSession) return;
    const outlineJson = await db.writingStepResults
      .where("[sessionId+role]")
      .equals([activeSession.id, "outline"])
      .first();
    if (!outlineJson?.output) {
      toast.error("Không tìm thấy giàn ý. Vui lòng kiểm tra lại pipeline.");
      return;
    }
    try {
      const { saveGeneratedChapter } = await import("@/lib/writing/save-chapter");
      const outline = JSON.parse(outlineJson.output);
      await saveGeneratedChapter({
        novelId,
        sessionId: activeSession.id,
        chapterPlanId: activeSession.chapterPlanId,
        outline,
      });
      toast.success("Đã lưu chương");
      selectNextPlan();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi lưu chương");
    }
  }, [activeSession, novelId, selectNextPlan]);

  const handleStaleRerun = useCallback(async () => {
    if (!activeSession) return;
    await updateWritingSession(activeSession.id, {
      currentStep: "context",
      contextHash: undefined,
    });
    setStaleWarning(false);
    handleStartPipeline();
  }, [activeSession, handleStartPipeline]);

  // ── Step Re-run Handlers ───────────────────────────────────

  /** Delete step results from `fromStep` onwards and re-run pipeline from that step */
  const resetAndRerun = useCallback(
    async (
      fromStep: WritingAgentRole,
      opts?: { clearDirections?: boolean; clearOutline?: boolean },
    ) => {
      if (!activeSession) return;
      const stepsToDelete: WritingAgentRole[] = [
        "context",
        "direction",
        "outline",
        "writer",
        "review",
        "rewrite",
      ];
      const fromIdx = stepsToDelete.indexOf(fromStep);
      for (const role of stepsToDelete.slice(fromIdx)) {
        const result = await db.writingStepResults
          .where("[sessionId+role]")
          .equals([activeSession.id, role])
          .first();
        if (result) await db.writingStepResults.delete(result.id);
      }
      if (opts?.clearDirections || opts?.clearOutline) {
        await db.chapterPlans.update(activeSession.chapterPlanId, {
          ...(opts.clearDirections ? { directions: [] } : {}),
          ...(opts.clearOutline ? { outline: undefined, scenes: [] } : {}),
          status: "writing",
          updatedAt: new Date(),
        });
      }
      await updateWritingSession(activeSession.id, { currentStep: fromStep });
      if (fromStep === "writer") clearStreamingContent();
      handleStartPipeline();
    },
    [activeSession, clearStreamingContent, handleStartPipeline],
  );

  const handleRerunDirection = useCallback(
    () => resetAndRerun("direction", { clearDirections: true, clearOutline: true }),
    [resetAndRerun],
  );

  const handleRerunOutline = useCallback(
    () => resetAndRerun("outline", { clearOutline: true }),
    [resetAndRerun],
  );

  const handleRerunWriter = useCallback(
    () => resetAndRerun("writer"),
    [resetAndRerun],
  );

  const handleRerunReview = useCallback(
    () => resetAndRerun("review"),
    [resetAndRerun],
  );

  // ── Dashboard Actions ─────────────────────────────────────

  const handleDashboardAction = useCallback(
    (action: "auto-generate" | "chat" | "skip") => {
      switch (action) {
        case "skip":
          setModeOverride("pipeline");
          break;
        case "chat":
          // Open wizard at the first missing step
          setIdeaData({
            genre: novel?.genre ?? "",
            setting: novel?.storySetting ?? "",
            idea: novel?.synopsis ?? novel?.description ?? "",
            style: "",
          });
          setModeOverride("wizard");
          break;
        // auto-generate is handled inside NovelSetup itself
      }
    },
    [novel],
  );

  // ── Render ────────────────────────────────────────────────

  if (!novel) return <Skeleton className="h-screen w-full" />;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href={`/novels/${novelId}`}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-sm font-semibold">
            {novel.title} — Auto-Write
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {mode === "pipeline" && (
            <>
              {isRunning ? (
                <Button variant="ghost" size="sm" onClick={pausePipeline}>
                  <PauseIcon className="h-4 w-4 mr-1" />
                  Tạm dừng
                </Button>
              ) : activeSession ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStartPipeline()}
                >
                  <PlayIcon className="h-4 w-4 mr-1" />
                  Tiếp tục
                </Button>
              ) : nextPlan ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleStartPipeline(nextPlan.id)}
                >
                  <PlayIcon className="h-4 w-4 mr-1" />
                  Viết chương {nextPlan.chapterOrder}
                </Button>
              ) : null}
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content by mode */}
      {mode === "empty" && (
        <div className="flex-1 overflow-auto">
          <IdeaForm
            onSubmitAction={(data) => {
              setIdeaData(data);
              setModeOverride("wizard");
            }}
          />
        </div>
      )}

      {mode === "wizard" && ideaData && (
        <div className="flex-1">
          <SetupWizard
            novelId={novelId}
            ideaData={ideaData}
            startAtStep={
              hasWorld
                ? hasCharacters
                  ? hasPlotArcs
                    ? "plans"
                    : "arcs"
                  : "characters"
                : "world"
            }
            onCompleteAction={() => setModeOverride("pipeline")}
          />
        </div>
      )}

      {mode === "dashboard" && (
        <div className="flex-1 overflow-hidden">
          <NovelSetup
            novelId={novelId}
            onActionAction={handleDashboardAction}
          />
        </div>
      )}

      {mode === "pipeline" && (
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel defaultSize="320px" minSize="260px" maxSize="400px">
            <div className="flex h-full flex-col border-r">
              <div className="p-3">
                <PipelineProgress
                  sessionId={activeSession?.id}
                  currentStep={activeSession?.currentStep}
                  onRetryAction={() => handleStartPipeline()}
                  onStepClick={(role) => {
                    const panelMap: Record<
                      WritingAgentRole,
                      typeof activePanel
                    > = {
                      context: "pipeline",
                      direction: "pipeline",
                      outline: "outline",
                      writer: "content",
                      review: "review",
                      rewrite: "content",
                    };
                    setActivePanel(panelMap[role]);
                  }}
                />
              </div>
              <ScrollArea className="flex-1 border-t p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Kế hoạch chương
                  </h3>
                  {chapterPlans && chapterPlans.length > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {
                        chapterPlans.filter((p) => p.status === "saved")
                          .length
                      }
                      /{chapterPlans.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {chapterPlans?.map((plan, idx) => {
                    const prevPlan = idx > 0 ? chapterPlans[idx - 1] : null;
                    const prevDone =
                      !prevPlan ||
                      prevPlan.status === "saved";
                    const isLocked = !prevDone && plan.status === "planned";
                    return (
                      <button
                        key={plan.id}
                        onClick={() => !isLocked && setSelectedPlanId(plan.id)}
                        disabled={isLocked}
                        className={`w-full text-left rounded-md px-3 py-1 text-xs transition-colors flex ${
                          isLocked
                            ? "opacity-40 cursor-not-allowed"
                            : effectivePlanId === plan.id
                              ? "bg-accent"
                              : "hover:bg-accent/50"
                        }`}
                      >
                        <span className="font-medium">
                          {plan.chapterOrder}.
                        </span>
                        {plan.title && (
                          <span className="text-muted-foreground ml-1 line-clamp-1 flex-1">
                            {plan.title}
                          </span>
                        )}
                        <span
                          className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] ${
                            plan.status === "saved"
                              ? "bg-green-500/10 text-green-600"
                              : plan.status === "reviewed"
                                ? "bg-orange-500/10 text-orange-600"
                                : plan.status === "written"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : plan.status === "writing"
                                    ? "bg-blue-500/10 text-blue-600"
                                    : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {StatusLabelMap[plan.status]?.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* Generate more chapter plans button */}
              </ScrollArea>
              {chapterPlans && chapterPlans.length > 0 && (
                <button
                  onClick={handleGenerateMorePlans}
                  disabled={isGeneratingPlans}
                  className="my-2 mx-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isGeneratingPlans
                    ? "Đang tạo..."
                    : "+ Tạo thêm kế hoạch chương"}
                </button>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel minSize="300px" className="h-full">
            <Tabs
              value={activePanel}
              onValueChange={(v) => setActivePanel(v as typeof activePanel)}
              className="flex h-full flex-col"
            >
              <TabsList className="mx-auto mt-2 w-fit [&_button]:text-xs [&_button]:min-w-24">
                <TabsTrigger value="pipeline">Hướng đi</TabsTrigger>
                <TabsTrigger value="outline">Giàn ý</TabsTrigger>
                <TabsTrigger value="content">Nội dung</TabsTrigger>
                <TabsTrigger value="review">Đánh giá</TabsTrigger>
              </TabsList>
              <ScrollArea className="h-[calc(100dvh-144px)]">
                <TabsContent value="pipeline" className="p-4">
                  {directionOutput ? (
                    <DirectionSelector
                      options={directionOutput.options}
                      onConfirm={handleDirectionConfirm}
                      onRegenerateAction={handleRerunDirection}
                      isLoading={isRunning}
                    />
                  ) : isRunning &&
                    (activeSession?.currentStep === "context" ||
                      activeSession?.currentStep === "direction") ? (
                    <Empty className="h-[60vh]">
                      <EmptyMedia>
                        <Loader2Icon className="h-10 w-10 animate-spin text-primary" />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>
                          {activeSession?.currentStep === "context"
                            ? "Đang phân tích bối cảnh"
                            : "Đang đề xuất hướng đi"}
                        </EmptyTitle>
                        <EmptyDescription>
                          {activeSession?.currentStep === "context"
                            ? "AI đang tổng hợp bối cảnh từ nhân vật, thế giới quan và các chương trước..."
                            : "AI đang sáng tạo các hướng đi cho chương mới..."}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <Empty className="h-[60vh]">
                      <EmptyMedia variant="icon">
                        <CompassIcon />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>Chọn hướng đi</EmptyTitle>
                        <EmptyDescription>
                          Chọn một kế hoạch chương ở sidebar bên trái, sau đó
                          nhấn &quot;Viết chương&quot; để bắt đầu pipeline.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </TabsContent>

                <TabsContent value="outline" className="p-4">
                  {outlineOutput ? (
                    <OutlineEditor
                      chapterTitle={outlineOutput.chapterTitle}
                      synopsis={outlineOutput.synopsis}
                      scenes={outlineOutput.scenes}
                      onApprove={handleOutlineApprove}
                      onRegenerateAction={handleRerunOutline}
                      isLoading={isRunning}
                    />
                  ) : isRunning && activeSession?.currentStep === "outline" ? (
                    <Empty className="h-[60vh]">
                      <EmptyMedia>
                        <Loader2Icon className="h-10 w-10 animate-spin text-primary" />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>Đang tạo giàn ý</EmptyTitle>
                        <EmptyDescription>
                          AI đang xây dựng cấu trúc phân cảnh chi tiết...
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <Empty className="h-[60vh]">
                      <EmptyMedia variant="icon">
                        <ListTreeIcon />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>Giàn ý chương</EmptyTitle>
                        <EmptyDescription>
                          Giàn ý sẽ hiển thị sau khi bạn chọn hướng đi ở bước
                          trước.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </TabsContent>

                <TabsContent value="content">
                  <ChapterPreview
                    sessionId={activeSession?.id}
                    onRegenerateAction={
                      activeSession && !isRunning
                        ? handleRerunWriter
                        : undefined
                    }
                  />
                </TabsContent>

                <TabsContent value="review">
                  <ReviewPanel
                    sessionId={activeSession?.id}
                    onRewriteAction={handleRewrite}
                    onSaveAction={handleSaveChapter}
                    onRegenerateReviewAction={
                      activeSession && !isRunning
                        ? handleRerunReview
                        : undefined
                    }
                    isRewriting={isRewriting}
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/* Settings Dialog */}
      <WritingSettingsDialog
        novelId={novelId}
        open={settingsOpen}
        onOpenChangeAction={setSettingsOpen}
      />

      {/* Stale Context Warning */}
      <AlertDialog open={staleWarning} onOpenChange={setStaleWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dữ liệu đã thay đổi</AlertDialogTitle>
            <AlertDialogDescription>
              Dữ liệu tiểu thuyết đã thay đổi kể từ khi bối cảnh được tạo. Bạn
              muốn chạy lại bước Bối cảnh hay tiếp tục với bối cảnh cũ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setStaleWarning(false);
                handleStartPipeline();
              }}
            >
              Tiếp tục với bối cảnh cũ
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleStaleRerun}>
              Chạy lại bước Bối cảnh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
