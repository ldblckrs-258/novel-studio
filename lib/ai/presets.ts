import type { ProviderType } from "@/lib/db";

export interface ProviderPreset {
  type: ProviderType;
  label: string;
  description: string;
  defaultBaseUrl: string;
  baseUrlEditable: boolean;
  apiKeyPlaceholder: string;
  apiKeyHelpUrl?: string;
  popularModels: string[];
  /** Icon key for thesvg package (e.g. "openai" → import from "thesvg/openai") */
  iconKey: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    type: "openai",
    label: "OpenAI",
    description: "GPT-4.2, GPT-4.1, o3, o4-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    baseUrlEditable: false,
    apiKeyPlaceholder: "sk-...",
    apiKeyHelpUrl: "https://platform.openai.com/api-keys",
    iconKey: "openai",
    popularModels: [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
      "o3",
      "o4-mini",
    ],
  },
  {
    type: "anthropic",
    label: "Anthropic",
    description: "Claude Opus, Sonnet, Haiku",
    defaultBaseUrl: "https://api.anthropic.com",
    baseUrlEditable: false,
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyHelpUrl: "https://console.anthropic.com/settings/keys",
    iconKey: "anthropic",
    popularModels: [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-20250414",
    ],
  },
  {
    type: "google",
    label: "Google AI",
    description: "Gemini 3.1 Pro, Flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    baseUrlEditable: false,
    apiKeyPlaceholder: "AI...",
    apiKeyHelpUrl: "https://aistudio.google.com/app/apikey",
    iconKey: "google",
    popularModels: ["gemini-3.1-pro", "gemini-3.1-flash", "gemini-2.0-flash"],
  },
  {
    type: "groq",
    label: "Groq",
    description: "Suy luận siêu nhanh — Llama, Mixtral",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    baseUrlEditable: false,
    apiKeyPlaceholder: "gsk_...",
    apiKeyHelpUrl: "https://console.groq.com/keys",
    iconKey: "groq",
    popularModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
    ],
  },
  {
    type: "mistral",
    label: "Mistral",
    description: "Mistral Large, Medium, Small",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    baseUrlEditable: false,
    apiKeyPlaceholder: "...",
    apiKeyHelpUrl: "https://console.mistral.ai/api-keys",
    iconKey: "mistral",
    popularModels: [
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
    ],
  },
  {
    type: "xai",
    label: "xAI",
    description: "Grok",
    defaultBaseUrl: "https://api.x.ai/v1",
    baseUrlEditable: false,
    apiKeyPlaceholder: "xai-...",
    apiKeyHelpUrl: "https://console.x.ai/",
    iconKey: "xai",
    popularModels: ["grok-3", "grok-3-mini", "grok-2"],
  },
  {
    type: "openrouter",
    label: "OpenRouter",
    description: "Truy cập 200+ mô hình qua một API",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    baseUrlEditable: false,
    apiKeyPlaceholder: "sk-or-...",
    apiKeyHelpUrl: "https://openrouter.ai/keys",
    iconKey: "openrouter",
    popularModels: [],
  },
  {
    type: "openai-compatible",
    label: "Tùy chỉnh",
    description:
      "LM Studio, Ollama, Together, hoặc bất kỳ endpoint tương thích",
    defaultBaseUrl: "",
    baseUrlEditable: true,
    apiKeyPlaceholder: "Khóa API (tùy chọn cho local)",
    iconKey: "",
    popularModels: [],
  },
];

export function getPreset(type: ProviderType): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.type === type);
}
