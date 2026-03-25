import type { NovelStudioDB } from "./db";

/**
 * Register all Dexie schema versions and data migrations.
 * Called once from the NovelStudioDB constructor.
 */
export function registerMigrations(db: NovelStudioDB) {
  db.version(1).stores({
    novels: "id, title, genre, createdAt, updatedAt",
    chapters: "id, novelId, order, createdAt",
    scenes: "id, chapterId, novelId, order, createdAt",
    characters: "id, novelId, name, role",
    notes: "id, novelId, category, createdAt",
  });

  db.version(2).stores({
    aiProviders: "id, name, isActive, createdAt, updatedAt",
    aiModels: "id, providerId, modelId, createdAt",
  });

  db.version(3).stores({
    conversations: "id, providerId, modelId, createdAt, updatedAt",
    conversationMessages: "id, conversationId, createdAt",
  });

  db.version(4).stores({
    chatSettings: "id",
  });

  db.version(5).stores({
    novelAnalyses: "id, novelId, analysisStatus, createdAt",
  });

  db.version(6).stores({
    analysisSettings: "id",
  });

  // v7: Add analyzedAt to Chapter (non-indexed field, no store changes needed)
  db.version(7).stores({});

  // v8: Add chapter AI tool fields to AnalysisSettings (non-indexed)
  db.version(8).stores({});

  // v9: Add color, author, sourceUrl to Novel (non-indexed)
  db.version(9).stores({});

  // v10: Merge novelAnalyses into novels, drop novelAnalyses table
  db.version(10)
    .stores({ novelAnalyses: null })
    .upgrade(async (tx) => {
      const analyses = await tx.table("novelAnalyses").toArray();
      for (const a of analyses) {
        await tx.table("novels").update(a.novelId, {
          genres: a.genres,
          tags: a.tags,
          synopsis: a.synopsis,
          worldOverview: a.worldOverview,
          powerSystem: a.powerSystem,
          storySetting: a.storySetting,
          timePeriod: a.timePeriod,
          factions: a.factions,
          keyLocations: a.keyLocations,
          worldRules: a.worldRules,
          technologyLevel: a.technologyLevel,
          analysisStatus: a.analysisStatus,
          chaptersAnalyzed: a.chaptersAnalyzed,
          totalChapters: a.totalChapters,
          analysisError: a.error,
        });
      }
    });
}
