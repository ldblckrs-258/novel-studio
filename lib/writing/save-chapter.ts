import { db } from "@/lib/db";
import { countWords } from "@/lib/utils";
import type { OutlineAgentOutput } from "./types";

/**
 * Save the completed chapter to existing Chapter + Scene entities.
 * Uses rewrite content if available, otherwise writer content.
 */
export async function saveGeneratedChapter(options: {
  novelId: string;
  sessionId: string;
  chapterPlanId: string;
  outline: OutlineAgentOutput;
}): Promise<string> {
  const { novelId, sessionId, chapterPlanId, outline } = options;

  const chapterPlan = await db.chapterPlans.get(chapterPlanId);
  if (!chapterPlan) throw new Error("Chapter plan not found");

  // Prefer rewrite content over writer content
  const [rewriteResult, writerResult, reviewResult] = await Promise.all([
    db.writingStepResults
      .where("[sessionId+role]")
      .equals([sessionId, "rewrite"])
      .first(),
    db.writingStepResults
      .where("[sessionId+role]")
      .equals([sessionId, "writer"])
      .first(),
    db.writingStepResults
      .where("[sessionId+role]")
      .equals([sessionId, "review"])
      .first(),
  ]);

  const finalContent =
    rewriteResult?.status === "completed" && rewriteResult.output
      ? rewriteResult.output
      : (writerResult?.output ?? "");

  if (!finalContent) throw new Error("No content to save");

  const now = new Date();

  // Create Chapter
  const chapterId = crypto.randomUUID();
  await db.chapters.add({
    id: chapterId,
    novelId,
    title: outline.chapterTitle,
    order: chapterPlan.chapterOrder,
    summary: outline.synopsis,
    createdAt: now,
    updatedAt: now,
  });

  // Create Scene (single scene with all content)
  const sceneId = crypto.randomUUID();
  await db.scenes.add({
    id: sceneId,
    chapterId,
    novelId,
    title: outline.chapterTitle,
    content: finalContent,
    order: 1,
    wordCount: countWords(finalContent),
    version: 1,
    versionType: "ai-write",
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Link ChapterPlan to Chapter
  await db.chapterPlans.update(chapterPlanId, {
    chapterId,
    status: "saved",
    updatedAt: now,
  });

  // Persist non-suggestion review issues for cross-session context memory
  if (reviewResult?.output) {
    try {
      const reviewOutput = JSON.parse(reviewResult.output) as {
        issues: Array<{ type: string; severity: string; description: string }>;
      };
      const newIssues = reviewOutput.issues
        .filter((i) => i.severity !== "suggestion")
        .map((i) => ({
          chapterOrder: chapterPlan.chapterOrder,
          type: i.type,
          description: i.description,
        }));
      if (newIssues.length > 0) {
        const novel = await db.novels.get(novelId);
        const existing = novel?.reviewIssues ?? [];
        // Keep last 20 issues total (rolling window)
        const merged = [...existing, ...newIssues].slice(-20);
        await db.novels.update(novelId, { reviewIssues: merged });
      }
    } catch {
      // Non-critical — don't fail save if issue persistence fails
    }
  }

  return chapterId;
}
