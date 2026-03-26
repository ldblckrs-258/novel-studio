import type { NovelStudioDB } from "./db";

/**
 * Register all Dexie schema versions.
 * Called once from the NovelStudioDB constructor.
 *
 * IMPORTANT: This is a fresh v1 schema. Users must clear their IndexedDB
 * (`novel-studio` database) and re-import data after this reset.
 */
export function registerMigrations(db: NovelStudioDB) {
  db.version(1).stores({
    novels: "id, title, genre, createdAt, updatedAt",
    chapters: "id, novelId, order, createdAt, updatedAt",
    scenes:
      "id, chapterId, novelId, order, isActive, activeSceneId, [chapterId+isActive], [novelId+isActive], [activeSceneId+version]",
    characters: "id, novelId, name, role",
    notes: "id, novelId, category, createdAt",
    aiProviders: "id, name, isActive, createdAt, updatedAt",
    aiModels: "id, providerId, modelId, createdAt",
    conversations: "id, providerId, modelId, createdAt, updatedAt",
    conversationMessages: "id, conversationId, createdAt",
    chatSettings: "id",
    analysisSettings: "id",
  });

  db.version(2).stores({
    novels: "id, title, genre, createdAt, updatedAt",
    chapters: "id, novelId, order, createdAt, updatedAt",
    scenes:
      "id, chapterId, novelId, order, isActive, activeSceneId, [chapterId+isActive], [novelId+isActive], [activeSceneId+version]",
    characters: "id, novelId, name, role",
    notes: "id, novelId, category, createdAt",
    aiProviders: "id, name, isActive, createdAt, updatedAt",
    aiModels: "id, providerId, modelId, createdAt",
    conversations: "id, providerId, modelId, createdAt, updatedAt",
    conversationMessages: "id, conversationId, createdAt",
    chatSettings: "id",
    analysisSettings: "id",
    nameEntries: "id, scope, chinese, category, [scope+chinese], createdAt",
    dictEntries: "id, source, chinese, [source+chinese]",
    dictMeta: "id",
  });

  // v3: Add dictCache table for fast worker init (raw text blobs instead of 728k rows)
  db.version(3).stores({
    dictCache: "source",
  });

  // v4: Add convertSettings singleton for QT convert options
  db.version(4).stores({
    convertSettings: "id",
  });
}
