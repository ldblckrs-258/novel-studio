"use client";

import { useState, useCallback } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useAnalysisSettings,
  updateAnalysisSettings,
  useAIProviders,
  useAIModels,
} from "@/lib/hooks";
import { useDebouncedCallback } from "@/lib/hooks/use-debounce";
import type { StepModelConfig } from "@/lib/db";
import { toast } from "sonner";

export interface StepDef {
  key: "chapters" | "aggregation" | "characters";
  label: string;
  description: string;
  modelKey: "chapterModel" | "aggregationModel" | "characterModel";
  promptKey:
    | "chapterAnalysisPrompt"
    | "novelAggregationPrompt"
    | "characterProfilingPrompt";
  promptLabel: string;
  defaultPrompt: string;
  icon: React.ElementType;
}

function InlineModelPicker({
  modelKey,
}: {
  modelKey: StepDef["modelKey"];
}) {
  const settings = useAnalysisSettings();
  const value = settings[modelKey] as StepModelConfig | undefined;
  const providers = useAIProviders();
  const selectedProviderId = value?.providerId ?? "";
  const models = useAIModels(selectedProviderId || undefined);

  const handleProviderChange = (providerId: string) => {
    if (!providerId) {
      updateAnalysisSettings({ [modelKey]: undefined });
      return;
    }
    updateAnalysisSettings({ [modelKey]: { providerId, modelId: "" } });
  };

  const handleModelChange = (modelId: string) => {
    if (!selectedProviderId) return;
    updateAnalysisSettings({
      [modelKey]: { providerId: selectedProviderId, modelId },
    });
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <Label className="text-xs text-muted-foreground">Nhà cung cấp</Label>
        <NativeSelect
          className="mt-1 w-full"
          value={selectedProviderId}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          <NativeSelectOption value="">Kế thừa mặc định</NativeSelectOption>
          {providers?.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Mô hình</Label>
        <NativeSelect
          className="mt-1 w-full"
          value={value?.modelId ?? ""}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={!selectedProviderId}
        >
          <NativeSelectOption value="">
            {selectedProviderId ? "Chọn mô hình" : "Chọn nhà cung cấp trước"}
          </NativeSelectOption>
          {models?.map((m) => (
            <NativeSelectOption key={m.id} value={m.modelId}>
              {m.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

function InlinePromptEditor({
  promptKey,
  defaultPrompt,
}: {
  promptKey: StepDef["promptKey"];
  defaultPrompt: string;
}) {
  const settings = useAnalysisSettings();
  const value = settings[promptKey] ?? "";
  const isCustomized = value.trim() !== "";

  const debouncedSave = useDebouncedCallback(
    (val: string) =>
      updateAnalysisSettings({ [promptKey]: val.trim() || undefined }),
    800,
  );

  const handleReset = useCallback(() => {
    updateAnalysisSettings({ [promptKey]: undefined });
    toast.success("Đã đặt lại prompt về mặc định");
  }, [promptKey]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Prompt hệ thống</Label>
        {isCustomized && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-6 px-1.5 text-xs"
          >
            <RotateCcwIcon className="mr-1 size-3" />
            Mặc định
          </Button>
        )}
      </div>
      <Textarea
        key={value || defaultPrompt}
        defaultValue={value || defaultPrompt}
        onChange={(e) => debouncedSave.run(e.target.value)}
        className="min-h-[100px] font-mono text-xs leading-relaxed"
      />
    </div>
  );
}

export function AnalysisStepConfig({
  step,
  enabled,
  onToggle,
  disableToggle,
  number,
}: {
  step: StepDef;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  disableToggle?: boolean;
  number: number;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const Icon = step.icon;
  const settings = useAnalysisSettings();
  const hasCustomModel = !!settings[step.modelKey];
  const hasCustomPrompt = !!(settings[step.promptKey] as string | undefined)?.trim();

  return (
    <div
      className={`rounded-lg border transition-colors ${
        enabled
          ? "border-border bg-card"
          : "border-border/50 bg-muted/30"
      }`}
    >
      {/* Step header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            enabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {number}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icon
            className={`size-4 shrink-0 ${enabled ? "text-foreground" : "text-muted-foreground"}`}
          />
          <div className="min-w-0">
            <p
              className={`text-sm font-medium leading-tight ${
                !enabled && "text-muted-foreground"
              }`}
            >
              {step.label}
            </p>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </div>
        </div>

        <Switch
          size="sm"
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={disableToggle}
        />
      </div>

      {/* Expandable config detail */}
      {enabled && (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-1.5 border-t px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
              {detailsOpen ? (
                <ChevronDownIcon className="size-3" />
              ) : (
                <ChevronRightIcon className="size-3" />
              )}
              <span>Mô hình & Prompt</span>
              {(hasCustomModel || hasCustomPrompt) && (
                <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                  Tùy chỉnh
                </span>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 border-t px-3 py-3">
              <InlineModelPicker modelKey={step.modelKey} />
              <InlinePromptEditor
                promptKey={step.promptKey}
                defaultPrompt={step.defaultPrompt}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
