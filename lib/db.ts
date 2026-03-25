import Dexie, { type EntityTable } from "dexie";

// ─── Entity Types ────────────────────────────────────────────

export interface Novel {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  genre?: string;
  targetWordCount?: number;
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

export interface Scene {
  id: string;
  chapterId: string;
  novelId: string;
  title: string;
  content: string;
  order: number;
  wordCount: number;
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
  | "openai-compatible";

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

export interface NameDescription {
  name: string;
  description: string;
}

export interface NovelAnalysis {
  id: string;
  novelId: string;
  genres: string[];
  tags: string[];
  synopsis: string;
  worldOverview?: string;
  powerSystem?: string;
  storySetting?: string;
  timePeriod?: string;
  factions?: NameDescription[];
  keyLocations?: NameDescription[];
  worldRules?: string;
  technologyLevel?: string;
  analysisStatus: "pending" | "analyzing" | "completed" | "failed";
  chaptersAnalyzed: number;
  totalChapters: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
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
  novelAnalyses!: EntityTable<NovelAnalysis, "id">;
  analysisSettings!: EntityTable<AnalysisSettings, "id">;

  constructor() {
    super("novel-studio");

    this.version(1).stores({
      novels: "id, title, genre, createdAt, updatedAt",
      chapters: "id, novelId, order, createdAt",
      scenes: "id, chapterId, novelId, order, createdAt",
      characters: "id, novelId, name, role",
      notes: "id, novelId, category, createdAt",
    });

    this.version(2).stores({
      aiProviders: "id, name, isActive, createdAt, updatedAt",
      aiModels: "id, providerId, modelId, createdAt",
    });

    this.version(3).stores({
      conversations: "id, providerId, modelId, createdAt, updatedAt",
      conversationMessages: "id, conversationId, createdAt",
    });

    this.version(4).stores({
      chatSettings: "id",
    });

    this.version(5).stores({
      novelAnalyses: "id, novelId, analysisStatus, createdAt",
    });

    this.version(6).stores({
      analysisSettings: "id",
    });

    // v7: Add analyzedAt to Chapter (non-indexed field, no store changes needed)
    this.version(7).stores({});

    // v8: Add chapter AI tool fields to AnalysisSettings (non-indexed)
    this.version(8).stores({});
  }
}

export const db = new NovelStudioDB();
