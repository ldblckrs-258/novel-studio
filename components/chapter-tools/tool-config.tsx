"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { toast } from "sonner";
import {
  useAnalysisSettings,
  updateAnalysisSettings,
  useAIProviders,
  useAIModels,
} from "@/lib/hooks";
import type { StepModelConfig, AnalysisSettings } from "@/lib/db";

type ModelKey = "translateModel" | "reviewModel" | "editModel";
type PromptKey = "translatePrompt" | "reviewPrompt" | "editPrompt";

interface ToolConfigProps {
  modelKey: ModelKey;
  promptKey: PromptKey;
  defaultPrompt: string;
  modelLabel: string;
  promptLabel: string;
}

export function ToolConfig({
  modelKey,
  promptKey,
  defaultPrompt,
  modelLabel,
  promptLabel,
}: ToolConfigProps) {
  const settings = useAnalysisSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [modelDraft, setModelDraft] = useState<StepModelConfig | undefined | null>(null);
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const providers = useAIProviders();
  const currentModel: StepModelConfig | undefined =
    modelDraft !== null ? (modelDraft ?? undefined) : (settings[modelKey] as StepModelConfig | undefined);
  const selectedProviderId = currentModel?.providerId ?? "";
  const models = useAIModels(selectedProviderId || undefined);

  const storedPrompt = (settings[promptKey] as string | undefined) ?? "";
  const currentPrompt =
    promptDraft !== null ? promptDraft : (storedPrompt || defaultPrompt);

  const hasModelDraft = modelDraft !== null;
  const hasPromptDraft = promptDraft !== null && promptDraft !== (storedPrompt || defaultPrompt);
  const hasDraft = hasModelDraft || hasPromptDraft;

  const handleProviderChange = (providerId: string) => {
    if (!providerId) {
      setModelDraft(undefined);
      return;
    }
    setModelDraft({ providerId, modelId: "" });
  };

  const handleModelChange = (modelId: string) => {
    if (!selectedProviderId) return;
    setModelDraft({ providerId: selectedProviderId, modelId });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<AnalysisSettings> = {};
      if (modelDraft !== null) {
        (updates as Record<string, unknown>)[modelKey] = modelDraft ?? undefined;
      }
      if (promptDraft !== null) {
        const trimmed = promptDraft.trim();
        // Don't persist if it matches the default
        (updates as Record<string, unknown>)[promptKey] =
          !trimmed || trimmed === defaultPrompt.trim() ? undefined : trimmed;
      }
      await updateAnalysisSettings(updates);
      setModelDraft(null);
      setPromptDraft(null);
      toast.success("Đã lưu cài đặt");
    } catch {
      toast.error("Lưu cài đặt thất bại");
    } finally {
      setSaving(false);
    }
  };

  const hasCustomModel = !!settings[modelKey];
  const hasCustomPrompt = !!storedPrompt.trim() && storedPrompt.trim() !== defaultPrompt.trim();

  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3.5 text-muted-foreground" />
        )}
        <span className="text-xs font-medium">Cài đặt</span>
        {!isOpen && (hasCustomModel || hasCustomPrompt) && (
          <span className="text-xs text-muted-foreground">(đã tùy chỉnh)</span>
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          {/* Model selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{modelLabel}</Label>
              {currentModel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModelDraft(undefined)}
                  className="h-6 text-xs"
                >
                  <RotateCcwIcon className="mr-1 size-3" />
                  Mặc định
                </Button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <NativeSelect
                className="w-full"
                value={selectedProviderId}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                <NativeSelectOption value="">Mặc định</NativeSelectOption>
                {providers?.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                className="w-full"
                value={currentModel?.modelId ?? ""}
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

          {/* Custom prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{promptLabel}</Label>
              {(hasCustomPrompt || (promptDraft !== null && promptDraft.trim() !== defaultPrompt.trim())) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await updateAnalysisSettings({ [promptKey]: undefined } as Partial<AnalysisSettings>);
                    setPromptDraft(defaultPrompt);
                    toast.success("Đã đặt lại prompt");
                  }}
                  className="h-6 text-xs"
                >
                  <RotateCcwIcon className="mr-1 size-3" />
                  Đặt lại
                </Button>
              )}
            </div>
            <Textarea
              value={currentPrompt}
              onChange={(e) => setPromptDraft(e.target.value)}
              className="min-h-[80px] font-mono text-xs leading-relaxed"
            />
          </div>

          {hasDraft && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Mặc định kế thừa từ cài đặt trò chuyện chung.
          </p>
        </div>
      )}
    </div>
  );
}
