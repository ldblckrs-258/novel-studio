"use client";

import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { StepModelConfig } from "@/lib/db";
import {
  useAIModels,
  useApiInferenceProviders,
  useClearWebGpuStepModel,
} from "@/lib/hooks";
import { useCallback } from "react";

interface StepModelPickerProps {
  value: StepModelConfig | undefined;
  onChange: (value: StepModelConfig | undefined) => void;
  fallbackLabel?: string;
}

export function StepModelPicker({
  value,
  onChange,
  fallbackLabel = "Mặc định (Chat)",
}: StepModelPickerProps) {
  const providers = useApiInferenceProviders();
  const selectedProviderId = value?.providerId ?? "";
  const models = useAIModels(selectedProviderId || undefined);

  const clearWebGpu = useCallback(() => {
    onChange(undefined);
  }, [onChange]);
  useClearWebGpuStepModel(value?.providerId, clearWebGpu);

  const handleProviderChange = (providerId: string) => {
    if (!providerId) {
      onChange(undefined);
      return;
    }
    onChange({ providerId, modelId: "" });
  };

  const handleModelChange = (modelId: string) => {
    if (!selectedProviderId) return;
    onChange({ providerId: selectedProviderId, modelId });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nhà cung cấp</Label>
        <NativeSelect
          className="w-full"
          value={selectedProviderId}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          <NativeSelectOption value="">{fallbackLabel}</NativeSelectOption>
          {providers?.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Mô hình</Label>
        <NativeSelect
          className="w-full"
          value={value?.modelId ?? ""}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={!selectedProviderId}
        >
          <NativeSelectOption value="">
            {selectedProviderId ? "Chọn mô hình" : "—"}
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
