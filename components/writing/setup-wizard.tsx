"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/novel/editable-text";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getOrCreateWritingSettings,
  updateNovel,
  useChapterPlans,
  useCharacters,
  useNovel,
  usePlotArcs,
} from "@/lib/hooks";
import type { WritingAgentRole, WritingSettings } from "@/lib/db";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  generateChapterPlans,
  generateCharacters,
  generatePlotArcs,
  generateWorldBuilding,
  saveChapterPlans,
  saveCharacters,
  savePlotArcs,
  saveWorldBuilding,
} from "@/lib/writing/auto-generate";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  GlobeIcon,
  MapIcon,
  MapPinIcon,
  RefreshCwIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PipelineStepConfig } from "./pipeline-step-config";
import type { IdeaFormData } from "./idea-form";
import { useWritingPipelineStore } from "@/lib/stores/writing-pipeline";
import {
  getDefaultSetupPrompt,
  SETUP_PROMPT_KEYS,
  type SetupStep,
} from "@/lib/writing/auto-generate-prompts";

/** Model configs still reuse pipeline roles for model selection */
const SETUP_MODEL_ROLES: Record<SetupStep, WritingAgentRole> = {
  world: "context",
  characters: "direction",
  arcs: "outline",
  plans: "writer",
};

const STEPS: {
  key: SetupStep;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "world",
    label: "Thế giới quan",
    description: "Xây dựng bối cảnh, thế lực, địa danh và quy tắc",
    icon: GlobeIcon,
  },
  {
    key: "characters",
    label: "Nhân vật",
    description: "Tạo nhân vật với tính cách, động lực và mục tiêu",
    icon: UsersIcon,
  },
  {
    key: "arcs",
    label: "Mạch truyện",
    description: "Thiết lập mạch chính, phụ và các điểm mốc",
    icon: MapIcon,
  },
  {
    key: "plans",
    label: "Kế hoạch chương",
    description: "Lên kế hoạch cho các chương đầu tiên",
    icon: BookOpenIcon,
  },
];

// ─── Main Component ─────────────────────────────────────────

export function SetupWizard({
  novelId,
  ideaData,
  onCompleteAction,
  startAtStep,
}: {
  novelId: string;
  ideaData: IdeaFormData;
  onCompleteAction: () => void;
  startAtStep?: SetupStep;
}) {
  const [currentStep, setCurrentStep] = useState<SetupStep>(
    startAtStep ?? "world",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [wantsRegenerate, setWantsRegenerate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const setStepUserInstruction = useWritingPipelineStore(
    (s) => s.setStepUserInstruction,
  );

  const novel = useNovel(novelId);
  const characters = useCharacters(novelId);
  const plotArcs = usePlotArcs(novelId);
  const chapterPlans = useChapterPlans(novelId);

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const stepDef = STEPS[currentStepIndex];

  useEffect(() => {
    void getOrCreateWritingSettings(novelId);
  }, [novelId]);

  const wizardInstructionKey = `wizard:${currentStep}`;

  const isStepDone = useCallback(
    (step: SetupStep) => {
      switch (step) {
        case "world":
          return !!(novel?.worldOverview || novel?.factions?.length);
        case "characters":
          return (characters?.length ?? 0) > 0;
        case "arcs":
          return (plotArcs?.length ?? 0) > 0;
        case "plans":
          return (chapterPlans?.length ?? 0) > 0;
      }
    },
    [novel, characters, plotArcs, chapterPlans],
  );

  const stepDone = isStepDone(currentStep);

  const buildContext = useCallback(() => {
    const parts: string[] = [];
    if (novel?.worldOverview) parts.push(`Thế giới: ${novel.worldOverview}`);
    if (novel?.factions?.length)
      parts.push(`Thế lực: ${novel.factions.map((f) => f.name).join(", ")}`);
    if (characters?.length)
      parts.push(
        `Nhân vật: ${characters.map((c) => `${c.name} (${c.role}): ${c.description}`).join("\n")}`,
      );
    if (plotArcs?.length)
      parts.push(
        `Mạch truyện: ${plotArcs.map((a) => `${a.title} (${a.type}): ${a.description}`).join("\n")}`,
      );
    return parts.join("\n\n");
  }, [novel, characters, plotArcs]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const ws = await getOrCreateWritingSettings(novelId);
    const promptKey = SETUP_PROMPT_KEYS[currentStep] as keyof WritingSettings;
    // Only pass systemPrompt if user has customized it; otherwise let auto-generate use its own defaults
    const systemPrompt = (ws[promptKey] as string | undefined) ?? undefined;
    const userInstruction =
      useWritingPipelineStore.getState().stepUserInstructions[
        wizardInstructionKey
      ] ?? "";

    const options = {
      novelId,
      genre: ideaData.genre,
      setting: ideaData.setting,
      idea: ideaData.idea,
      style: ideaData.style,
      systemPrompt,
      userInstruction: userInstruction.trim() || undefined,
      abortSignal: controller.signal,
    };

    try {
      switch (currentStep) {
        case "world": {
          const result = await generateWorldBuilding(options);
          await saveWorldBuilding(novelId, result);
          break;
        }
        case "characters": {
          const result = await generateCharacters(options, buildContext());
          await saveCharacters(novelId, result);
          break;
        }
        case "arcs": {
          const result = await generatePlotArcs(options, buildContext());
          await savePlotArcs(novelId, result);
          break;
        }
        case "plans": {
          const result = await generateChapterPlans(options, buildContext());
          await saveChapterPlans(novelId, result);
          break;
        }
      }
      setStepUserInstruction(wizardInstructionKey, "");
      setWantsRegenerate(false);
      toast.success(`Đã tạo ${stepDef.label}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setIsGenerating(false);
    }
  }, [
    currentStep,
    novelId,
    ideaData,
    buildContext,
    stepDef,
    wizardInstructionKey,
    setStepUserInstruction,
  ]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].key);
      setWantsRegenerate(false);
    } else {
      onCompleteAction();
    }
  }, [currentStepIndex, onCompleteAction]);

  // ── Render step results ───────────────────────────────────

  const sectionCard = (
    icon: React.ComponentType<{ className?: string }>,
    color: string,
    label: string,
    value: string,
    onSave: (v: string) => void,
    multi = true,
  ) => {
    const Icon = icon;
    return (
      <div className="rounded-xl border p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className={cn("inline-flex size-7 items-center justify-center rounded-lg bg-muted", color)}>
            <Icon className="size-3.5" />
          </span>
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{label}</p>
        </div>
        <EditableText
          value={value}
          onSave={onSave}
          placeholder={`Chưa có ${label.toLowerCase()}...`}
          multiline={multi}
          displayClassName="text-sm leading-relaxed"
        />
      </div>
    );
  };

  const itemList = (
    items: { name: string; description: string }[],
    icon: React.ComponentType<{ className?: string }>,
    color: string,
    label: string,
    onUpdate: (items: { name: string; description: string }[]) => void,
  ) => {
    const Icon = icon;
    return (
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("inline-flex size-7 items-center justify-center rounded-lg bg-muted", color)}>
            <Icon className="size-3.5" />
          </span>
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{label}</p>
          {items.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="py-2 text-center text-xs italic text-muted-foreground/60">Chưa có {label.toLowerCase()} nào</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={`${item.name}-${i}`} className="group flex items-start gap-3 rounded-lg border border-border/50 bg-background/60 p-3 transition-colors hover:bg-background">
                <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold bg-muted", color)}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <EditableText
                    value={item.name}
                    onSave={(v) => { const next = [...items]; next[i] = { ...next[i], name: v }; onUpdate(next); }}
                    displayClassName="text-sm font-medium"
                  />
                  <EditableText
                    value={item.description}
                    onSave={(v) => { const next = [...items]; next[i] = { ...next[i], description: v }; onUpdate(next); }}
                    placeholder="Thêm mô tả..."
                    multiline
                    displayClassName="text-xs leading-relaxed text-muted-foreground"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStepResult = () => {
    switch (currentStep) {
      case "world":
        return novel?.worldOverview ? (
          <div className="grid gap-3">
            <div className="col-span-1">
              {sectionCard(GlobeIcon, "text-blue-600 dark:text-blue-400", "Tổng quan thế giới", novel.worldOverview ?? "", (v) => updateNovel(novelId, { worldOverview: v }))}
            </div>
            {sectionCard(MapIcon, "text-emerald-600 dark:text-emerald-400", "Bối cảnh", novel.storySetting ?? "", (v) => updateNovel(novelId, { storySetting: v }))}
            {sectionCard(BookOpenIcon, "text-amber-600 dark:text-amber-400", "Thời kỳ", novel.timePeriod ?? "", (v) => updateNovel(novelId, { timePeriod: v }), false)}
            <div className="col-span-1">
              {sectionCard(SparklesIcon, "text-red-600 dark:text-red-400", "Hệ thống sức mạnh", novel.powerSystem ?? "", (v) => updateNovel(novelId, { powerSystem: v }))}
            </div>
            <div className="col-span-1">
              {itemList(novel.factions ?? [], ShieldIcon, "text-violet-600 dark:text-violet-400", "Thế lực", (v) => updateNovel(novelId, { factions: v }))}
            </div>
            <div className="col-span-1">
              {itemList(novel.keyLocations ?? [], MapPinIcon, "text-cyan-600 dark:text-cyan-400", "Địa danh", (v) => updateNovel(novelId, { keyLocations: v }))}
            </div>
          </div>
        ) : null;

      case "characters":
        return characters && characters.length > 0 ? (
          <div className="space-y-2">
            {characters.map((c, i) => (
              <div key={c.id} className="group flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/30">
                <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold bg-muted", "text-violet-600 dark:text-violet-400")}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <EditableText value={c.name} onSave={(v) => db.characters.update(c.id, { name: v, updatedAt: new Date() })} displayClassName="text-sm font-semibold" />
                    <Badge variant="secondary" className="text-[10px] font-normal shrink-0">{c.role}</Badge>
                  </div>
                  <EditableText value={c.description} multiline onSave={(v) => db.characters.update(c.id, { description: v, updatedAt: new Date() })} placeholder="Thêm mô tả..." displayClassName="text-xs leading-relaxed text-muted-foreground" />
                  <div className="grid gap-1 pt-1">
                    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">Tính cách</p>
                      <EditableText value={c.personality ?? ""} onSave={(v) => db.characters.update(c.id, { personality: v, updatedAt: new Date() })} placeholder="Chưa có..." displayClassName="text-xs" />
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">Động lực</p>
                      <EditableText value={c.motivations ?? ""} onSave={(v) => db.characters.update(c.id, { motivations: v, updatedAt: new Date() })} placeholder="Chưa có..." displayClassName="text-xs" />
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">Mục tiêu</p>
                      <EditableText value={c.goals ?? ""} onSave={(v) => db.characters.update(c.id, { goals: v, updatedAt: new Date() })} placeholder="Chưa có..." displayClassName="text-xs" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null;

      case "arcs":
        return plotArcs && plotArcs.length > 0 ? (
          <div className="space-y-2">
            {plotArcs.map((a) => {
              const arcColor = a.type === "main" ? "text-red-600 dark:text-red-400" : a.type === "character" ? "text-violet-600 dark:text-violet-400" : "text-amber-600 dark:text-amber-400";
              return (
                <div key={a.id} className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("inline-flex size-7 items-center justify-center rounded-lg bg-muted", arcColor)}>
                      <MapIcon className="size-3.5" />
                    </span>
                    <EditableText value={a.title} onSave={(v) => db.plotArcs.update(a.id, { title: v, updatedAt: new Date() })} displayClassName="text-sm font-semibold" />
                    <Badge variant="secondary" className="text-[10px] font-normal shrink-0">{a.type}</Badge>
                  </div>
                  <EditableText value={a.description} multiline onSave={(v) => db.plotArcs.update(a.id, { description: v, updatedAt: new Date() })} placeholder="Thêm mô tả..." displayClassName="text-sm leading-relaxed text-muted-foreground" />
                  {a.plotPoints.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Điểm mốc</p>
                      {a.plotPoints.map((p, pi) => (
                        <div key={p.id} className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                          <span className={cn("mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-[9px] font-bold bg-muted", arcColor)}>
                            {pi + 1}
                          </span>
                          <EditableText value={p.title} onSave={(v) => { const pts = [...a.plotPoints]; pts[pi] = { ...pts[pi], title: v }; db.plotArcs.update(a.id, { plotPoints: pts, updatedAt: new Date() }); }} displayClassName="text-xs" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null;

      case "plans":
        return chapterPlans && chapterPlans.length > 0 ? (
          <div className="space-y-2">
            {chapterPlans.map((p) => (
              <div key={p.id} className="group flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/30">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold bg-muted text-emerald-600 dark:text-emerald-400">
                  {p.chapterOrder}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <EditableText value={p.title ?? ""} onSave={(v) => db.chapterPlans.update(p.id, { title: v, updatedAt: new Date() })} placeholder="Chưa đặt tên..." displayClassName="text-sm font-semibold" />
                  <EditableText
                    value={p.directions.join("\n")}
                    multiline
                    onSave={(v) => db.chapterPlans.update(p.id, { directions: v.split("\n").map((d) => d.trim()).filter(Boolean), updatedAt: new Date() })}
                    placeholder="Thêm hướng đi..."
                    displayClassName="text-xs leading-relaxed text-muted-foreground"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null;
    }
  };

  // ── Empty state with inline config ────────────────────────

  const renderEmptyState = () => {
    const Icon = stepDef.icon;
    return (
      <div className="flex flex-col items-center max-w-lg mx-auto gap-4 w-full">
        <Empty className="border-0">
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{stepDef.label}</EmptyTitle>
            <EmptyDescription>{stepDef.description}</EmptyDescription>
          </EmptyHeader>
        </Empty>

        <PipelineStepConfig
          novelId={novelId}
          role={SETUP_MODEL_ROLES[currentStep]}
          instructionKey={wizardInstructionKey}
          title={`Cấu hình: ${stepDef.label}`}
          description="Điều chỉnh mô hình, yêu cầu của bạn và system prompt (mở rộng) trước khi tạo."
          runLabel={
            isGenerating
              ? `Đang tạo ${stepDef.label.toLowerCase()}...`
              : `Tạo ${stepDef.label.toLowerCase()}`
          }
          onRun={handleGenerate}
          disabled={isGenerating}
          promptKeyOverride={SETUP_PROMPT_KEYS[currentStep]}
          defaultPromptOverride={getDefaultSetupPrompt(currentStep)}
        />

        {isGenerating && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              abortRef.current?.abort();
              setIsGenerating(false);
            }}
          >
            <XIcon className="h-3 w-3 mr-1" />
            Hủy
          </Button>
        )}
      </div>
    );
  };

  const showFooter = stepDone && !isGenerating && !wantsRegenerate;

  // ── Layout ────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header: step pills + progress */}
      <div className="flex items-center justify-center border-b px-4 py-3">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const done = isStepDone(step.key);
            const active = step.key === currentStep;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-1 sm:gap-2">
                {i > 0 && (
                  <div
                    className={`h-px w-2 sm:w-4 ${i <= currentStepIndex ? "bg-primary" : "bg-border"}`}
                  />
                )}
                <button
                  key={step.key}
                  onClick={() => {
                    setCurrentStep(step.key);
                    setWantsRegenerate(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : done
                        ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80",
                  )}
                >
                  {done ? (
                    <CheckCircle2Icon className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <ScrollArea
        className={
          showFooter ? `h-[calc(100dvh-208px)]` : `h-[calc(100dvh-148px)]`
        }
      >
        <div className="p-4 max-w-2xl mx-auto">
          {wantsRegenerate || isGenerating || !stepDone
            ? renderEmptyState()
            : renderStepResult()}
        </div>
      </ScrollArea>

      {/* Footer: actions when step is done */}
      {showFooter && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWantsRegenerate(true)}
                disabled={isGenerating}
              >
                <RefreshCwIcon className="h-3.5 w-3.5 mr-1" />
                Tạo lại
              </Button>
            </div>

            <div className="flex-1" />

            <Button onClick={handleNext}>
              {currentStepIndex < STEPS.length - 1 ? (
                <>
                  Tiếp theo
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </>
              ) : (
                "Hoàn thành → Viết truyện"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
