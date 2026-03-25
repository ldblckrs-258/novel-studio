import { db } from "@/lib/db";

/**
 * Build translation context: summaries of previous chapters.
 * Returns null if no summaries are available.
 */
export async function buildTranslateContext(
  novelId: string,
  currentChapterOrder: number,
  maxChapters = 10,
): Promise<string | null> {
  const chapters = await db.chapters
    .where("novelId")
    .equals(novelId)
    .sortBy("order");

  const previous = chapters
    .filter((ch) => ch.order < currentChapterOrder && ch.summary)
    .slice(-maxChapters);

  if (previous.length === 0) return null;

  return previous
    .map((ch) => `### ${ch.title}\n${ch.summary}`)
    .join("\n\n");
}

/**
 * Build minimal context for review/edit: character names + location names.
 * Token-efficient — just a flat list of names.
 */
export async function buildMinimalContext(
  novelId: string,
): Promise<string | null> {
  const [characters, analysis] = await Promise.all([
    db.characters.where("novelId").equals(novelId).toArray(),
    db.novelAnalyses.where("novelId").equals(novelId).first(),
  ]);

  const parts: string[] = [];

  if (characters.length > 0) {
    const names = characters.map((c) => c.name).join(", ");
    parts.push(`Nhân vật: ${names}`);
  }

  if (analysis?.keyLocations?.length) {
    const locations = analysis.keyLocations.map((l) => l.name).join(", ");
    parts.push(`Địa danh: ${locations}`);
  }

  if (analysis?.factions?.length) {
    const factions = analysis.factions.map((f) => f.name).join(", ");
    parts.push(`Thế lực: ${factions}`);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
