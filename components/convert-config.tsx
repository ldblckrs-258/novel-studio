"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  useConvertSettings,
  updateConvertSettings,
} from "@/lib/hooks/use-convert-settings";
import type {
  ConvertOptions,
  NameVsPriority,
  ScopePriority,
  VpLengthPriority,
  LuatNhanMode,
  SplitMode,
} from "@/lib/workers/qt-engine.types";

// ─── Option Button Group ──────────────────────────────────────

function OptionGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              value === opt.value
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function ConvertConfig() {
  const settings = useConvertSettings();

  // Memoize slider value arrays to prevent Radix Slider infinite re-render loop
  // (new array reference on every render triggers onValueChange → Dexie write → re-render)
  // Memoize slider value arrays to prevent Radix Slider infinite re-render loop
  // (new array reference on every render triggers onValueChange → Dexie write → re-render)
  const maxPhraseLengthValue = useMemo(
    () => [settings.maxPhraseLength],
    [settings.maxPhraseLength],
  );
  const nameDetectMinFreqValue = useMemo(
    () => [settings.nameDetectMinFrequency],
    [settings.nameDetectMinFrequency],
  );

  const update = (patch: Partial<ConvertOptions>) => {
    void updateConvertSettings(patch);
  };

  return (
    <div className="space-y-3">
      <OptionGroup<NameVsPriority>
        label="Ưu tiên từ điển"
        value={settings.nameVsPriority}
        onChange={(v) => update({ nameVsPriority: v })}
        options={[
          { value: "name-first", label: "Name > VP" },
          { value: "vp-first", label: "VP > Name" },
        ]}
      />

      <OptionGroup<ScopePriority>
        label="Ưu tiên phạm vi"
        value={settings.scopePriority}
        onChange={(v) => update({ scopePriority: v })}
        options={[
          { value: "novel-first", label: "Riêng > Chung" },
          { value: "global-first", label: "Chung > Riêng" },
        ]}
      />

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Cụm từ dài nhất: {settings.maxPhraseLength}
        </Label>
        <Slider
          value={maxPhraseLengthValue}
          onValueChange={([v]) => update({ maxPhraseLength: v })}
          min={4}
          max={20}
          step={1}
          className="w-full"
        />
      </div>

      <OptionGroup<VpLengthPriority>
        label="Ưu tiên độ dài VP"
        value={settings.vpLengthPriority}
        onChange={(v) => update({ vpLengthPriority: v })}
        options={[
          { value: "none", label: "Không" },
          { value: "long-first", label: "Dài > Ngắn" },
          { value: "vp-gt-3", label: "VP > 3 tự" },
          { value: "vp-gt-4", label: "VP > 4 tự" },
        ]}
      />

      <OptionGroup<LuatNhanMode>
        label="Luật nhân"
        value={settings.luatNhanMode}
        onChange={(v) => update({ luatNhanMode: v })}
        options={[
          { value: "off", label: "Không nhân" },
          { value: "name-only", label: "Nhân name" },
          { value: "name-and-pronouns", label: "Name + đại từ" },
        ]}
      />

      <OptionGroup<SplitMode>
        label="Phân tách đoạn dịch"
        value={settings.splitMode}
        onChange={(v) => update({ splitMode: v })}
        options={[
          { value: "paragraph", label: "Theo đoạn" },
          { value: "sentence", label: "Theo câu" },
        ]}
      />

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="capitalize-brackets" className="text-xs font-medium">
          Viết hoa trong 《》«»
        </Label>
        <Switch
          id="capitalize-brackets"
          checked={settings.capitalizeBrackets}
          onCheckedChange={(v) => update({ capitalizeBrackets: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="auto-detect-names" className="text-xs font-medium">
          Tự nhận diện tên
        </Label>
        <Switch
          id="auto-detect-names"
          checked={settings.autoDetectNames}
          onCheckedChange={(v) => update({ autoDetectNames: v })}
        />
      </div>

      {settings.autoDetectNames && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Tần suất tối thiểu: {settings.nameDetectMinFrequency}
          </Label>
          <Slider
            value={nameDetectMinFreqValue}
            onValueChange={([v]) => update({ nameDetectMinFrequency: v })}
            min={1}
            max={5}
            step={1}
            className="w-full"
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="pos-tagging" className="text-xs font-medium">
          POS tagging (jieba)
        </Label>
        <Switch
          id="pos-tagging"
          checked={settings.posTaggingEnabled}
          onCheckedChange={(v) => update({ posTaggingEnabled: v })}
        />
      </div>
    </div>
  );
}
