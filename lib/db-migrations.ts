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

  // v5: Extract replace rules and excluded names into dedicated tables
  db.version(5)
    .stores({
      nameEntries: "id, scope, chinese, category, [scope+chinese], createdAt",
      replaceRules: "id, scope, [scope+order], createdAt",
      excludedNames: "id, scope, chinese, [scope+chinese], createdAt",
    })
    .upgrade(async (tx) => {
      const nameEntries = tx.table("nameEntries");
      const replaceRulesTable = tx.table("replaceRules");
      const excludedNamesTable = tx.table("excludedNames");

      const allEntries = await nameEntries.toArray();
      const now = new Date();
      const toDelete: string[] = [];
      const newRules: Record<string, unknown>[] = [];
      const newExcludes: Record<string, unknown>[] = [];

      for (const entry of allEntries) {
        if (entry.category === "thay thế") {
          newRules.push({
            id: entry.id,
            scope: entry.scope,
            pattern: entry.chinese,
            replacement: entry.vietnamese,
            isRegex: entry.isRegex ?? false,
            caseSensitive: entry.caseSensitive ?? false,
            enabled: entry.enabled ?? true,
            order: entry.order ?? 0,
            createdAt: entry.createdAt ?? now,
            updatedAt: entry.updatedAt ?? now,
          });
          toDelete.push(entry.id);
        } else if (entry.category === "loại trừ") {
          newExcludes.push({
            id: entry.id,
            scope: entry.scope,
            chinese: entry.chinese,
            createdAt: entry.createdAt ?? now,
            updatedAt: entry.updatedAt ?? now,
          });
          toDelete.push(entry.id);
        }
      }

      if (newRules.length > 0) await replaceRulesTable.bulkAdd(newRules);
      if (newExcludes.length > 0) await excludedNamesTable.bulkAdd(newExcludes);
      if (toDelete.length > 0) await nameEntries.bulkDelete(toDelete);
    });

  // v6: Add novelId/chapterId to conversations for chat context awareness
  db.version(6).stores({
    conversations: "id, providerId, modelId, novelId, createdAt, updatedAt",
  });

  // v7: Add nameFrequency table for cross-chapter name detection tracking
  db.version(7).stores({
    nameFrequency:
      "id, novelId, chinese, status, [novelId+chinese], [novelId+status]",
  });

  // v8: Add ttsSettings table for TTS configuration persistence
  db.version(8).stores({
    ttsSettings: "id",
  });

  // v9: Add writing pipeline tables
  db.version(9).stores({
    plotArcs: "id, novelId, type, status, [novelId+type], createdAt",
    chapterPlans:
      "id, novelId, chapterOrder, status, [novelId+chapterOrder], createdAt",
    characterArcs: "id, novelId, characterId, [novelId+characterId], createdAt",
    writingSettings: "id",
    writingSessions:
      "id, novelId, chapterPlanId, status, [novelId+status], createdAt",
    writingStepResults: "id, sessionId, role, [sessionId+role]",
  });

  // v10: Smart writing (optional fields on writingSettings / writingSessions; schema unchanged)
  db.version(10).stores({
    plotArcs: "id, novelId, type, status, [novelId+type], createdAt",
    chapterPlans:
      "id, novelId, chapterOrder, status, [novelId+chapterOrder], createdAt",
    characterArcs: "id, novelId, characterId, [novelId+characterId], createdAt",
    writingSettings: "id",
    writingSessions:
      "id, novelId, chapterPlanId, status, [novelId+status], createdAt",
    writingStepResults: "id, sessionId, role, [sessionId+role]",
  });

  // v11: noAskingMode (settings) + handsFree on session (legacy; pipeline reads settings)
  db.version(11).stores({
    plotArcs: "id, novelId, type, status, [novelId+type], createdAt",
    chapterPlans:
      "id, novelId, chapterOrder, status, [novelId+chapterOrder], createdAt",
    characterArcs: "id, novelId, characterId, [novelId+characterId], createdAt",
    writingSettings: "id",
    writingSessions:
      "id, novelId, chapterPlanId, status, [novelId+status], createdAt",
    writingStepResults: "id, sessionId, role, [sessionId+role]",
  });

  // v12: keyEvents on ChapterPlanScene, retry fields on WritingSettings,
  //      reviewIssues on Novel — all non-indexed fields; schema strings unchanged
  db.version(12).stores({
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
    replaceRules: "id, scope, [scope+order], createdAt",
    excludedNames: "id, scope, chinese, [scope+chinese], createdAt",
    dictEntries: "id, source, chinese, [source+chinese]",
    dictMeta: "id",
    dictCache: "source",
    convertSettings: "id",
    nameFrequency:
      "id, novelId, chinese, status, [novelId+chinese], [novelId+status]",
    ttsSettings: "id",
    plotArcs: "id, novelId, type, status, [novelId+type], createdAt",
    chapterPlans:
      "id, novelId, chapterOrder, status, [novelId+chapterOrder], createdAt",
    characterArcs: "id, novelId, characterId, [novelId+characterId], createdAt",
    writingSettings: "id",
    writingSessions:
      "id, novelId, chapterPlanId, status, [novelId+status], createdAt",
    writingStepResults: "id, sessionId, role, [sessionId+role]",
  });
}
