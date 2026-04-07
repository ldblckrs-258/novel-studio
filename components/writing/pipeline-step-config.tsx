"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { LineEditor } from "@/components/ui/line-editor";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { StepModelConfig, WritingAgentRole } from "@/lib/db";
import {
  getOrCreateWritingSettings,
  updateWritingSettings,
  useAIModels,
  useApiInferenceProviders,
  useClearWebGpuStepModel,
  useWritingSettings,
} from "@/lib/hooks";
import { useDebouncedCallback } from "@/lib/hooks/use-debounce";
import { useWritingPipelineStore } from "@/lib/stores/writing-pipeline";
import { getDefaultPrompt } from "@/lib/writing/prompts";
import { ChevronDownIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function PipelineStepModelPicker({
  novelId,
  role,
}: {
  novelId: string;
  role: WritingAgentRole;
}) {
  const settings = useWritingSettings(novelId);
  const modelKey = `${role}Model` as const;
  const value = settings?.[modelKey] as StepModelConfig | undefined;
  const providers = useApiInferenceProviders();
  const selectedProviderId = value?.providerId ?? "";
  const models = useAIModels(selectedProviderId || undefined);

  const ensureAndUpdate = async (data: Record<string, unknown>) => {
    await getOrCreateWritingSettings(novelId);
    await updateWritingSettings(novelId, data);
  };

  const clearWebGpu = useCallback(() => {
    void (async () => {
      await getOrCreateWritingSettings(novelId);
      await updateWritingSettings(novelId, { [modelKey]: undefined });
    })();
  }, [novelId, modelKey]);
  useClearWebGpuStepModel(value?.providerId, clearWebGpu);

  return (
    <div className="grid gap-2 grid-cols-2">
      <NativeSelect
        className="w-full text-xs"
        value={selectedProviderId}
        onChange={(e) => {
          const pid = e.target.value;
          ensureAndUpdate({
            [modelKey]: pid ? { providerId: pid, modelId: "" } : undefined,
          });
        }}
      >
        <NativeSelectOption value="">Mặc định</NativeSelectOption>
        {providers?.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        className="w-full text-xs"
        value={value?.modelId ?? ""}
        disabled={!selectedProviderId}
        onChange={(e) => {
          if (!selectedProviderId) return;
          ensureAndUpdate({
            [modelKey]: {
              providerId: selectedProviderId,
              modelId: e.target.value,
            },
          });
        }}
      >
        <NativeSelectOption value="">
          {selectedProviderId ? "Chọn model" : "—"}
        </NativeSelectOption>
        {models?.map((m) => (
          <NativeSelectOption key={m.id} value={m.modelId}>
            {m.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export function PipelineStepConfig({
  novelId,
  role,
  instructionKey,
  title,
  description,
  runLabel,
  onRun,
  disabled,
  promptKeyOverride,
  defaultPromptOverride,
}: {
  novelId: string;
  role: WritingAgentRole;
  instructionKey: string;
  title: string;
  description?: string;
  runLabel: string;
  onRun: () => void;
  disabled?: boolean;
  /** Override the WritingSettings field key for the system prompt (e.g. "worldBuildingPrompt") */
  promptKeyOverride?: string;
  /** Override the default prompt instead of using getDefaultPrompt(role) */
  defaultPromptOverride?: string;
}) {
  const settings = useWritingSettings(novelId);
  const promptKey = (promptKeyOverride ?? `${role}Prompt`) as keyof typeof settings & string;
  const defaultPrompt = defaultPromptOverride ?? getDefaultPrompt(role);
  const isCustom = !!(settings?.[promptKey] as string | undefined);

  const debouncedPromptChange = useDebouncedCallback(async (value: string) => {
    await getOrCreateWritingSettings(novelId);
    await updateWritingSettings(novelId, {
      [promptKey]: value === defaultPrompt ? undefined : value,
    });
  }, 500);

  const instruction = useWritingPipelineStore(
    (s) => s.stepUserInstructions[instructionKey] ?? "",
  );
  const setStepUserInstruction = useWritingPipelineStore(
    (s) => s.setStepUserInstruction,
  );

  const [systemOpen, setSystemOpen] = useState(false);

  const displayPrompt =
    (settings?.[promptKey] as string | undefined) ?? defaultPrompt;

  const [promptText, setPromptText] = useState(displayPrompt);
  useEffect(() => {
    setPromptText(displayPrompt);
  }, [displayPrompt]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Mô hình AI</Label>
        <PipelineStepModelPicker novelId={novelId} role={role} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Yêu cầu của bạn</Label>
        <LineEditor
          className="h-[200px]"
          value={instruction}
          onChange={(v) => setStepUserInstruction(instructionKey, v)}
          placeholder="Ghi chú ý tưởng, hạn chế, hoặc yêu cầu cụ thể cho AI (không lưu vào DB)..."
          contentFont="text-sm leading-5"
          gutterFont="text-xs leading-5"
        />
      </div>

      <Collapsible open={systemOpen} onOpenChange={setSystemOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium hover:bg-muted/50">
          <span>System prompt (quy tắc toàn cục)</span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 transition-transform ${systemOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="flex items-center justify-end">
            {isCustom && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  updateWritingSettings(novelId, { [promptKey]: undefined })
                }
              >
                <RotateCcwIcon className="h-3 w-3 mr-1" />
                Khôi phục mặc định
              </Button>
            )}
          </div>
          <LineEditor
            value={promptText}
            onChange={(v) => {
              setPromptText(v);
              debouncedPromptChange.run(v);
            }}
            className="h-[200px]"
            contentFont="text-xs leading-5"
            gutterFont="text-xs leading-5"
            xmlColors
          />
          <p className="text-[10px] text-muted-foreground">
            Lưu tự động sau khi ngừng gõ (debounce).
          </p>
        </CollapsibleContent>
      </Collapsible>

      <Button
        type="button"
        className="w-full"
        onClick={onRun}
        disabled={disabled}
      >
        {runLabel}
      </Button>
    </div>
  );
}
