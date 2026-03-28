import Dexie, { type EntityTable } from "dexie";
import { registerMigrations } from "./db-migrations";

// ─── Entity Types ────────────────────────────────────────────

export interface NameDescription {
  name: string;
  description: string;
}

export interface Novel {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  genre?: string;
  targetWordCount?: number;
  color?: string;
  author?: string;
  sourceUrl?: string;
  // Analysis fields (merged from NovelAnalysis)
  genres?: string[];
  tags?: string[];
  synopsis?: string;
  worldOverview?: string;
  powerSystem?: string;
  storySetting?: string;
  timePeriod?: string;
  factions?: NameDescription[];
  keyLocations?: NameDescription[];
  worldRules?: string;
  technologyLevel?: string;
  analysisStatus?: "pending" | "analyzing" | "completed" | "failed";
  chaptersAnalyzed?: number;
  totalChapters?: number;
  analysisError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  order: number;
  summary?: string;
  characterIds?: string[];
  analyzedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SceneVersionType =
  | "ai-translate"
  | "ai-edit"
  | "manual"
  | "qt-convert"
  | "find-replace";

export interface Scene {
  id: string;
  chapterId: string;
  novelId: string;
  title: string;
  content: string;
  order: number;
  wordCount: number;
  // Version fields
  version: number;
  versionType: SceneVersionType;
  /** 1 = current content, 0 = historical version. Number for IndexedDB compound key compat. */
  isActive: number;
  activeSceneId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterRelationship {
  characterName: string;
  description: string;
}

export interface Character {
  id: string;
  novelId: string;
  name: string;
  role: string;
  description: string;
  notes?: string;
  imageUrl?: string;
  // Analysis fields
  age?: string;
  sex?: string;
  appearance?: string;
  personality?: string;
  hobbies?: string;
  relationshipWithMC?: string;
  relationships?: CharacterRelationship[];
  characterArc?: string;
  strengths?: string;
  weaknesses?: string;
  motivations?: string;
  goals?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  novelId: string;
  title: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "mistral"
  | "xai"
  | "openrouter"
  | "openai-compatible"
  | "webgpu";

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  providerType?: ProviderType;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIModel {
  id: string;
  providerId: string;
  modelId: string;
  name: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  createdAt: Date;
}

export interface ChatSettings {
  id: "default";
  providerId: string;
  modelId: string;
  systemPrompt: string;
  temperature: number;
  globalSystemInstruction?: string;
}

export interface StepModelConfig {
  providerId: string;
  modelId: string;
}

export interface AnalysisSettings {
  id: "default";
  chapterAnalysisPrompt?: string;
  novelAggregationPrompt?: string;
  characterProfilingPrompt?: string;
  chapterModel?: StepModelConfig;
  aggregationModel?: StepModelConfig;
  characterModel?: StepModelConfig;
  // Chapter AI tools
  translateModel?: StepModelConfig;
  reviewModel?: StepModelConfig;
  editModel?: StepModelConfig;
  translatePrompt?: string;
  reviewPrompt?: string;
  editPrompt?: string;
}

// ─── Name Dictionary ─────────────────────────────────────────

export type NameEntryCategory =
  | "nhân vật"
  | "địa danh"
  | "môn phái"
  | "thuật ngữ"
  | "vật phẩm"
  | "kỹ năng"
  | "khác";

export const NAME_ENTRY_CATEGORIES: NameEntryCategory[] = [
  "nhân vật",
  "địa danh",
  "môn phái",
  "thuật ngữ",
  "vật phẩm",
  "kỹ năng",
  "khác",
];

export interface NameEntry {
  id: string;
  scope: string; // "global" | novelId
  chinese: string;
  vietnamese: string;
  category: string; // NameEntryCategory or custom string
  createdAt: Date;
  updatedAt: Date;
}

// ─── Replace Rules ──────────────────────────────────────────

export interface ReplaceRule {
  id: string;
  scope: string; // "global" | novelId
  pattern: string;
  replacement: string;
  isRegex: boolean;
  caseSensitive: boolean;
  enabled: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Excluded Names ─────────────────────────────────────────

export interface ExcludedName {
  id: string;
  scope: string; // "global" | novelId
  chinese: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── QT Dictionary ───────────────────────────────────────────

export type DictSource =
  | "vietphrase"
  | "names"
  | "names2"
  | "phienam"
  | "luatnhan";

export interface DictEntry {
  id: string;
  source: DictSource;
  chinese: string;
  vietnamese: string;
}

export interface DictMeta {
  id: string; // "dict-meta" singleton
  loadedAt: Date;
  sources: Record<DictSource, number>; // entry count per source
}

/** Cached raw text per dict source — avoids reading 728k rows from dictEntries on init */
export interface DictCache {
  source: DictSource;
  rawText: string;
}

// ─── Convert Settings ────────────────────────────────────────

export type { ConvertOptions } from "@/lib/workers/qt-engine.types";
export { DEFAULT_CONVERT_OPTIONS } from "@/lib/workers/qt-engine.types";

export interface ConvertSettings {
  id: string; // "convert-settings" singleton
  nameVsPriority: string;
  scopePriority: string;
  maxPhraseLength: number;
  vpLengthPriority: string;
  luatNhanMode: string;
  splitMode: string;
  capitalizeBrackets?: boolean;
}

// ─── Database ────────────────────────────────────────────────

export class NovelStudioDB extends Dexie {
  novels!: EntityTable<Novel, "id">;
  chapters!: EntityTable<Chapter, "id">;
  scenes!: EntityTable<Scene, "id">;
  characters!: EntityTable<Character, "id">;
  notes!: EntityTable<Note, "id">;
  aiProviders!: EntityTable<AIProvider, "id">;
  aiModels!: EntityTable<AIModel, "id">;
  conversations!: EntityTable<Conversation, "id">;
  conversationMessages!: EntityTable<ConversationMessage, "id">;
  chatSettings!: EntityTable<ChatSettings, "id">;
  analysisSettings!: EntityTable<AnalysisSettings, "id">;
  nameEntries!: EntityTable<NameEntry, "id">;
  replaceRules!: EntityTable<ReplaceRule, "id">;
  excludedNames!: EntityTable<ExcludedName, "id">;
  dictEntries!: EntityTable<DictEntry, "id">;
  dictMeta!: EntityTable<DictMeta, "id">;
  dictCache!: EntityTable<DictCache, "source">;
  convertSettings!: EntityTable<ConvertSettings, "id">;

  constructor() {
    super("novel-studio");
    registerMigrations(this);
  }
}

export const db = new NovelStudioDB();
