"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_CHAPTER_ANALYSIS_SYSTEM,
  DEFAULT_CHARACTER_PROFILING_SYSTEM,
  DEFAULT_NOVEL_AGGREGATION_SYSTEM,
} from "@/lib/analysis/prompts";
import {
  DEFAULT_EDIT_SYSTEM,
  DEFAULT_REVIEW_SYSTEM,
  DEFAULT_TRANSLATE_SYSTEM,
} from "@/lib/chapter-tools/prompts";
import type { StepModelConfig, WritingAgentRole } from "@/lib/db";
import {
  getOrCreateWritingSettings,
  updateAnalysisSettings,
  updateChatSettings,
  updateWritingSettings,
  useAIModels,
  useAnalysisSettings,
  useApiInferenceProviders,
  useChatSettings,
  useClearWebGpuStepModel,
  useWritingSettings,
} from "@/lib/hooks";
import { useDebouncedCallback } from "@/lib/hooks/use-debounce";
import { cn } from "@/lib/utils";
import {
  getDefaultSetupPrompt,
  SETUP_MODEL_KEYS,
  SETUP_PROMPT_KEYS,
  type SetupStep,
} from "@/lib/writing/auto-generate-prompts";
import { getDefaultPrompt } from "@/lib/writing/prompts";
import { useCallback, useEffect, useState } from "react";
import { PromptEditor } from "./prompt-editor";
import { StepModelPicker } from "./step-model-picker";
import type { ConfigItemId } from "./types";

const GLOBAL_DEFAULT_ID = "global-default";

async function upsertGlobalWritingSettings(
  data: Parameters<typeof updateWritingSettings>[1],
) {
  await getOrCreateWritingSettings(GLOBAL_DEFAULT_ID);
  await updateWritingSettings(GLOBAL_DEFAULT_ID, data);
}

// ─── Save indicator ──────────────────────────────────────────

function useSaveIndicator() {
  const [saved, setSaved] = useState(false);
  const show = useCallback(() => {
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, []);
  return { saved, show };
}

// ─── Section header ──────────────────────────────────────────

function SectionHeader({
  title,
  description,
  saved,
}: {
  title: string;
  description: string;
  saved: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <span
        className={cn(
          "mt-1 shrink-0 text-xs text-muted-foreground transition-opacity duration-300",
          saved ? "opacity-100" : "opacity-0",
        )}
      >
        Đã lưu
      </span>
    </div>
  );
}

// ─── Chat model picker (reads/writes ChatSettings directly) ──

function ChatModelPicker() {
  const settings = useChatSettings();
  const providers = useApiInferenceProviders();
  const selectedProviderId = settings.providerId ?? "";
  const models = useAIModels(selectedProviderId || undefined);

  const clearWebGpu = useCallback(() => {
    void updateChatSettings({ providerId: "", modelId: "" });
  }, []);
  useClearWebGpuStepModel(settings.providerId, clearWebGpu);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nhà cung cấp</Label>
        <NativeSelect
          className="w-full"
          value={selectedProviderId}
          onChange={(e) =>
            void updateChatSettings({ providerId: e.target.value, modelId: "" })
          }
        >
          <NativeSelectOption value="">Chưa chọn</NativeSelectOption>
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
          value={settings.modelId ?? ""}
          onChange={(e) => void updateChatSettings({ modelId: e.target.value })}
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

// ─── Editors ─────────────────────────────────────────────────

function GlobalInstructionEditor() {
  const settings = useChatSettings();
  const { saved, show } = useSaveIndicator();
  const [value, setValue] = useState(settings.globalSystemInstruction ?? "");

  useEffect(() => {
    const next = settings.globalSystemInstruction ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(next);
  }, [settings.globalSystemInstruction]);

  const save = useDebouncedCallback((v: string) => {
    const next = v.trim() || undefined;
    void updateChatSettings({ globalSystemInstruction: next })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  }, 600);

  useEffect(() => {
    return () => save.flush();
  }, [save]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Chỉ thị chung"
        description="Được thêm vào đầu mọi system prompt — cả trò chuyện lẫn phân tích. Dùng cho tùy chọn ngôn ngữ, giọng điệu, hoặc ràng buộc toàn cục."
        saved={saved}
      />
      <PromptEditor
        className="h-[max(calc(100svh-320px),500px)]"
        value={value}
        onChange={(v) => {
          setValue(v);
          save.run(v);
        }}
        placeholder="VD: Luôn trả lời bằng Tiếng Việt. Sử dụng giọng văn trang trọng."
      />
    </div>
  );
}

function ChatPanelEditor() {
  const settings = useChatSettings();
  const { saved, show } = useSaveIndicator();
  const [promptValue, setPromptValue] = useState(settings.systemPrompt);

  useEffect(() => {
    const next = settings.systemPrompt;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPromptValue(next);
  }, [settings.systemPrompt]);

  const savePrompt = useDebouncedCallback((v: string) => {
    void updateChatSettings({ systemPrompt: v })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  }, 600);

  useEffect(() => {
    return () => savePrompt.flush();
  }, [savePrompt]);

  const isCustom = settings.systemPrompt !== "";

  const handleResetPrompt = () => {
    setPromptValue("");
    void updateChatSettings({ systemPrompt: "" })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Chat panel"
        description="Cài đặt mô hình và system prompt cho trò chuyện AI."
        saved={saved}
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Mô hình AI</Label>
        <ChatModelPicker />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Temperature</Label>
          <span className="min-w-[2ch] text-right text-xs font-medium tabular-nums">
            {(settings.temperature ?? 0.7).toFixed(1)}
          </span>
        </div>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={[settings.temperature ?? 0.7]}
          onValueChange={(v) => {
            const val = v[0];
            if (val != null) {
              void updateChatSettings({ temperature: val });
              show();
            }
          }}
          aria-label="Temperature"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">System Prompt</Label>
        <PromptEditor
          value={promptValue}
          onChange={(v) => {
            setPromptValue(v);
            savePrompt.run(v);
          }}
          onReset={handleResetPrompt}
          isCustom={isCustom}
          className="h-[max(calc(100svh-460px),240px)]"
        />
      </div>
    </div>
  );
}

// ─── Generic analysis/chapter-tool editor ────────────────────

type FieldConfig = {
  title: string;
  description: string;
  modelKey: string;
  promptKey: string;
  defaultPrompt: string;
};

const ANALYSIS_CONFIG: Record<string, FieldConfig> = {
  "analysis-chapter": {
    title: "Phân tích chương",
    description:
      "Đọc từng chương và trích xuất tóm tắt, nhân vật, cảnh quan trọng.",
    modelKey: "chapterModel",
    promptKey: "chapterAnalysisPrompt",
    defaultPrompt: DEFAULT_CHAPTER_ANALYSIS_SYSTEM,
  },
  "analysis-aggregation": {
    title: "Tổng hợp tiểu thuyết",
    description:
      "Tổng hợp tất cả chương để xây dựng hồ sơ tác phẩm hoàn chỉnh.",
    modelKey: "aggregationModel",
    promptKey: "novelAggregationPrompt",
    defaultPrompt: DEFAULT_NOVEL_AGGREGATION_SYSTEM,
  },
  "analysis-character": {
    title: "Hồ sơ nhân vật",
    description: "Xây dựng hồ sơ chi tiết cho từng nhân vật từ ghi chú chương.",
    modelKey: "characterModel",
    promptKey: "characterProfilingPrompt",
    defaultPrompt: DEFAULT_CHARACTER_PROFILING_SYSTEM,
  },
};

const CHAPTER_TOOL_CONFIG: Record<string, FieldConfig> = {
  "chapter-translate": {
    title: "Dịch thuật",
    description: "Dịch chương từ tiếng Trung sang tiếng Việt.",
    modelKey: "translateModel",
    promptKey: "translatePrompt",
    defaultPrompt: DEFAULT_TRANSLATE_SYSTEM,
  },
  "chapter-review": {
    title: "Đánh giá",
    description:
      "Đánh giá chất lượng bản dịch theo ngữ pháp, văn phong và nhất quán.",
    modelKey: "reviewModel",
    promptKey: "reviewPrompt",
    defaultPrompt: DEFAULT_REVIEW_SYSTEM,
  },
  "chapter-rewrite": {
    title: "Viết lại",
    description:
      "Viết lại chương dựa trên kết quả đánh giá để cải thiện chất lượng.",
    modelKey: "editModel",
    promptKey: "editPrompt",
    defaultPrompt: DEFAULT_EDIT_SYSTEM,
  },
};

function AnalysisPhaseEditor({ item }: { item: ConfigItemId }) {
  const settings = useAnalysisSettings();
  const { saved, show } = useSaveIndicator();

  const config = ANALYSIS_CONFIG[item];
  const defaultPrompt = config?.defaultPrompt ?? "";
  const customPrompt = config
    ? (settings[config.promptKey as keyof typeof settings] as
        | string
        | undefined)
    : undefined;
  const modelValue = config
    ? (settings[config.modelKey as keyof typeof settings] as
        | StepModelConfig
        | undefined)
    : undefined;
  const isCustom = !!customPrompt?.trim();
  const [localPrompt, setLocalPrompt] = useState(
    customPrompt?.trim() || defaultPrompt,
  );

  useEffect(() => {
    const next = customPrompt?.trim() || defaultPrompt;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalPrompt(next);
  }, [customPrompt, defaultPrompt, item]);

  const savePrompt = useDebouncedCallback((v: string) => {
    if (!config) return;
    const trimmed = v.trim();
    const next = trimmed === defaultPrompt ? undefined : trimmed || undefined;
    void updateAnalysisSettings({
      [config.promptKey]: next,
    })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  }, 600);

  useEffect(() => {
    return () => savePrompt.flush();
  }, [savePrompt]);

  if (!config) return null;

  const handleModelChange = (value: StepModelConfig | undefined) => {
    void updateAnalysisSettings({ [config.modelKey]: value })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  const handleResetPrompt = () => {
    setLocalPrompt(defaultPrompt);
    void updateAnalysisSettings({ [config.promptKey]: undefined })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={config.title}
        description={config.description}
        saved={saved}
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Mô hình AI</Label>
        <StepModelPicker value={modelValue} onChange={handleModelChange} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">System Prompt</Label>
        <PromptEditor
          value={localPrompt}
          onChange={(v) => {
            setLocalPrompt(v);
            savePrompt.run(v);
          }}
          onReset={handleResetPrompt}
          isCustom={isCustom}
        />
      </div>
    </div>
  );
}

function ChapterToolEditor({ item }: { item: ConfigItemId }) {
  const settings = useAnalysisSettings();
  const { saved, show } = useSaveIndicator();

  const config = CHAPTER_TOOL_CONFIG[item];
  const defaultPrompt = config?.defaultPrompt ?? "";
  const customPrompt = config
    ? (settings[config.promptKey as keyof typeof settings] as
        | string
        | undefined)
    : undefined;
  const modelValue = config
    ? (settings[config.modelKey as keyof typeof settings] as
        | StepModelConfig
        | undefined)
    : undefined;
  const isCustom = !!customPrompt?.trim();
  const [localPrompt, setLocalPrompt] = useState(
    customPrompt?.trim() || defaultPrompt,
  );

  useEffect(() => {
    const next = customPrompt?.trim() || defaultPrompt;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalPrompt(next);
  }, [customPrompt, defaultPrompt, item]);

  const savePrompt = useDebouncedCallback((v: string) => {
    if (!config) return;
    const trimmed = v.trim();
    const next = trimmed === defaultPrompt ? undefined : trimmed || undefined;
    void updateAnalysisSettings({
      [config.promptKey]: next,
    })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  }, 600);

  useEffect(() => {
    return () => savePrompt.flush();
  }, [savePrompt]);

  if (!config) return null;

  const handleModelChange = (value: StepModelConfig | undefined) => {
    void updateAnalysisSettings({ [config.modelKey]: value })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  const handleResetPrompt = () => {
    setLocalPrompt(defaultPrompt);
    void updateAnalysisSettings({ [config.promptKey]: undefined })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={config.title}
        description={config.description}
        saved={saved}
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Mô hình AI</Label>
        <StepModelPicker value={modelValue} onChange={handleModelChange} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">System Prompt</Label>
        <PromptEditor
          value={localPrompt}
          onChange={(v) => {
            setLocalPrompt(v);
            savePrompt.run(v);
          }}
          onReset={handleResetPrompt}
          isCustom={isCustom}
        />
      </div>
    </div>
  );
}

// ─── Auto-write setup ─────────────────────────────────────────

const SMART_WRITER_MIN_STEPS = 5;
const SMART_WRITER_MAX_STEPS = 20;

function AutowriteSetupEditor() {
  const settings = useWritingSettings(GLOBAL_DEFAULT_ID);
  const { saved, show } = useSaveIndicator();

  const chapterLength = settings?.chapterLength ?? 3000;
  const smartWritingMode = settings?.smartWritingMode ?? false;
  const noAskingMode = settings?.noAskingMode ?? false;
  const smartWriterMaxToolSteps = settings?.smartWriterMaxToolSteps ?? 12;
  const minScoreToAutoAccept = settings?.minScoreToAutoAccept ?? 7;
  const maxAutoRetries = settings?.maxAutoRetries ?? 2;

  const update = (data: Parameters<typeof updateWritingSettings>[1]) => {
    void upsertGlobalWritingSettings(data);
    show();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Cài đặt pipeline"
        description="Cấu hình mặc định áp dụng cho tất cả tiểu thuyết khi tạo mới. Mỗi tiểu thuyết có thể ghi đè riêng."
        saved={saved}
      />

      <div className="space-y-2">
        <Label className="text-xs font-medium">Độ dài chương (từ)</Label>
        <Input
          type="number"
          value={chapterLength}
          onChange={(e) =>
            update({ chapterLength: Number(e.target.value) || 3000 })
          }
          min={500}
          max={10000}
          step={500}
          className="w-32"
        />
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Hành vi pipeline
        </p>
        <div className="flex items-start gap-3">
          <Switch
            id="gd-smart"
            className="mt-0.5"
            checked={smartWritingMode}
            onCheckedChange={(v) => update({ smartWritingMode: v })}
          />
          <div className="space-y-0.5">
            <Label
              htmlFor="gd-smart"
              className="cursor-pointer text-sm font-medium leading-snug"
            >
              Viết thông minh
            </Label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tra cứu tiểu thuyết bằng công cụ, không gọi LLM bước bối cảnh.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Switch
            id="gd-noask"
            className="mt-0.5"
            checked={noAskingMode}
            onCheckedChange={(v) => update({ noAskingMode: v })}
          />
          <div className="space-y-0.5">
            <Label
              htmlFor="gd-noask"
              className="cursor-pointer text-sm font-medium leading-snug"
            >
              Không hỏi lại
            </Label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Chạy liền tới khi đánh giá xong; tự chọn hướng theo gợi ý AI.
            </p>
          </div>
        </div>
        <div
          className={cn(
            "space-y-3 border-t border-border/60 pt-3",
            !smartWritingMode && "pointer-events-none opacity-50",
          )}
        >
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Giới hạn bước công cụ (smart writer)
            </Label>
            <span className="min-w-[2ch] text-right text-sm font-semibold tabular-nums">
              {smartWriterMaxToolSteps}
            </span>
          </div>
          <Slider
            min={SMART_WRITER_MIN_STEPS}
            max={SMART_WRITER_MAX_STEPS}
            step={1}
            value={[smartWriterMaxToolSteps]}
            onValueChange={(v) => {
              const n = v[0];
              if (n != null) update({ smartWriterMaxToolSteps: n });
            }}
            disabled={!smartWritingMode}
            aria-label="Giới hạn bước"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Chế độ không hỏi lại
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Điểm tối thiểu để tự chấp nhận
            </Label>
            <Input
              type="number"
              value={minScoreToAutoAccept}
              onChange={(e) =>
                update({ minScoreToAutoAccept: Number(e.target.value) })
              }
              min={0}
              max={10}
              step={1}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Số lần thử lại tối đa
            </Label>
            <Input
              type="number"
              value={maxAutoRetries}
              onChange={(e) =>
                update({ maxAutoRetries: Number(e.target.value) })
              }
              min={0}
              max={10}
              step={1}
              className="w-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Auto-write pipeline agent editor ────────────────────────

const AGENT_ROLE_MAP: Partial<Record<ConfigItemId, WritingAgentRole>> = {
  "autowrite-context": "context",
  "autowrite-direction": "direction",
  "autowrite-outline": "outline",
  "autowrite-writer": "writer",
  "autowrite-review": "review",
  "autowrite-rewrite": "rewrite",
};

const AGENT_LABEL: Record<
  WritingAgentRole,
  { title: string; description: string }
> = {
  context: {
    title: "Bối cảnh",
    description:
      "Tổng hợp bối cảnh từ chương trước để chuẩn bị cho chương mới.",
  },
  direction: {
    title: "Hướng đi",
    description: "Đề xuất 3–5 hướng phát triển chương đa dạng.",
  },
  outline: {
    title: "Giàn ý",
    description:
      "Tạo cấu trúc phân cảnh chi tiết với sự kiện, tâm trạng và số từ mục tiêu.",
  },
  writer: {
    title: "Viết truyện",
    description: "Viết nội dung chương hoàn chỉnh theo giàn ý.",
  },
  review: {
    title: "Đánh giá",
    description: "Đánh giá chương theo 4 tiêu chí, cho điểm 0–10.",
  },
  rewrite: {
    title: "Viết lại",
    description: "Viết lại chương dựa trên kết quả đánh giá.",
  },
};

function AutowriteAgentEditor({ item }: { item: ConfigItemId }) {
  const role = AGENT_ROLE_MAP[item];
  const settings = useWritingSettings(GLOBAL_DEFAULT_ID);
  const { saved, show } = useSaveIndicator();

  const defaultPrompt = role ? getDefaultPrompt(role) : "";
  const modelKey = role ? (`${role}Model` as const) : undefined;
  const promptKey = role ? (`${role}Prompt` as const) : undefined;
  const modelValue = modelKey
    ? (settings?.[modelKey] as StepModelConfig | undefined)
    : undefined;
  const customPrompt = promptKey
    ? (settings?.[promptKey] as string | undefined)
    : undefined;
  const isCustom = !!customPrompt?.trim();
  const [localPrompt, setLocalPrompt] = useState(
    customPrompt?.trim() || defaultPrompt,
  );

  useEffect(() => {
    const next = customPrompt?.trim() || defaultPrompt;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalPrompt(next);
  }, [customPrompt, defaultPrompt, item, role]);

  const savePrompt = useDebouncedCallback((v: string) => {
    if (!promptKey) return;
    const trimmed = v.trim();
    const next = trimmed === defaultPrompt ? undefined : trimmed || undefined;
    void upsertGlobalWritingSettings({
      [promptKey]: next,
    })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  }, 600);

  useEffect(() => {
    return () => savePrompt.flush();
  }, [savePrompt]);

  if (!role) return null;

  const info = AGENT_LABEL[role];

  const handleModelChange = (value: StepModelConfig | undefined) => {
    if (!modelKey) return;
    void upsertGlobalWritingSettings({ [modelKey]: value })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  const handleResetPrompt = () => {
    if (!promptKey) return;
    setLocalPrompt(defaultPrompt);
    void upsertGlobalWritingSettings({ [promptKey]: undefined })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={info.title}
        description={info.description}
        saved={saved}
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Mô hình AI</Label>
        <StepModelPicker value={modelValue} onChange={handleModelChange} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">System Prompt</Label>
        <PromptEditor
          value={localPrompt}
          onChange={(v) => {
            setLocalPrompt(v);
            savePrompt.run(v);
          }}
          onReset={handleResetPrompt}
          isCustom={isCustom}
        />
      </div>
    </div>
  );
}

// ─── Auto-write setup step editor (world, characters, arcs, plans) ──

const SETUP_STEP_MAP: Partial<Record<ConfigItemId, SetupStep>> = {
  "autowrite-world": "world",
  "autowrite-characters": "characters",
  "autowrite-arcs": "arcs",
  "autowrite-plans": "plans",
};

const SETUP_STEP_LABEL: Record<
  SetupStep,
  { title: string; description: string }
> = {
  world: {
    title: "Thế giới quan",
    description: "Xây dựng bối cảnh, thế lực, địa danh và quy tắc thế giới.",
  },
  characters: {
    title: "Nhân vật",
    description: "Tạo nhân vật với tính cách, động lực và mục tiêu.",
  },
  arcs: {
    title: "Mạch truyện",
    description: "Thiết lập mạch chính, phụ và các điểm mốc.",
  },
  plans: {
    title: "Kế hoạch chương",
    description: "Lên kế hoạch tiêu đề và hướng đi cho các chương đầu tiên.",
  },
};

function AutowriteSetupStepEditor({ item }: { item: ConfigItemId }) {
  const step = SETUP_STEP_MAP[item];
  const settings = useWritingSettings(GLOBAL_DEFAULT_ID);
  const { saved, show } = useSaveIndicator();

  const promptKey = step ? SETUP_PROMPT_KEYS[step] : undefined;
  const modelKey = step ? SETUP_MODEL_KEYS[step] : undefined;
  const defaultPrompt = step ? getDefaultSetupPrompt(step) : "";
  const modelValue = modelKey
    ? (settings?.[modelKey as keyof typeof settings] as
        | StepModelConfig
        | undefined)
    : undefined;
  const customPrompt = promptKey
    ? (settings?.[promptKey as keyof typeof settings] as string | undefined)
    : undefined;
  const isCustom = !!customPrompt?.trim();
  const [localPrompt, setLocalPrompt] = useState(
    customPrompt?.trim() || defaultPrompt,
  );

  useEffect(() => {
    const next = customPrompt?.trim() || defaultPrompt;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalPrompt(next);
  }, [customPrompt, defaultPrompt, item, step]);

  const savePrompt = useDebouncedCallback((v: string) => {
    if (!promptKey) return;
    const trimmed = v.trim();
    const next = trimmed === defaultPrompt ? undefined : trimmed || undefined;
    void upsertGlobalWritingSettings({
      [promptKey]: next,
    })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  }, 600);

  useEffect(() => {
    return () => savePrompt.flush();
  }, [savePrompt]);

  if (!step) return null;

  const info = SETUP_STEP_LABEL[step];

  const handleModelChange = (value: StepModelConfig | undefined) => {
    if (!modelKey) return;
    void upsertGlobalWritingSettings({ [modelKey]: value })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  const handleResetPrompt = () => {
    if (!promptKey) return;
    setLocalPrompt(defaultPrompt);
    void upsertGlobalWritingSettings({ [promptKey]: undefined })
      .then(() => {
        show();
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={info.title}
        description={info.description}
        saved={saved}
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Mô hình AI</Label>
        <StepModelPicker value={modelValue} onChange={handleModelChange} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">System Prompt</Label>
        <PromptEditor
          value={localPrompt}
          onChange={(v) => {
            setLocalPrompt(v);
            savePrompt.run(v);
          }}
          onReset={handleResetPrompt}
          isCustom={isCustom}
        />
      </div>
    </div>
  );
}

// ─── Main router ─────────────────────────────────────────────

export function ConfigEditor({ item }: { item: ConfigItemId }) {
  const renderContent = () => {
    switch (item) {
      case "global-instruction":
        return <GlobalInstructionEditor />;
      case "chat-panel":
        return <ChatPanelEditor />;
      case "analysis-chapter":
      case "analysis-aggregation":
      case "analysis-character":
        return <AnalysisPhaseEditor item={item} />;
      case "chapter-translate":
      case "chapter-review":
      case "chapter-rewrite":
        return <ChapterToolEditor item={item} />;
      case "autowrite-setup":
        return <AutowriteSetupEditor />;
      case "autowrite-world":
      case "autowrite-characters":
      case "autowrite-arcs":
      case "autowrite-plans":
        return <AutowriteSetupStepEditor item={item} />;
      case "autowrite-context":
      case "autowrite-direction":
      case "autowrite-outline":
      case "autowrite-writer":
      case "autowrite-review":
      case "autowrite-rewrite":
        return <AutowriteAgentEditor item={item} />;
      default:
        return null;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="px-6 py-6">{renderContent()}</div>
    </ScrollArea>
  );
}
