import { db } from "@/lib/db";

export type ContextDepth = "quick" | "standard" | "deep";

const DEPTH_CONFIG: Record<ContextDepth, { maxChapters: number; includeDetails: boolean }> = {
  quick: { maxChapters: 3, includeDetails: false },
  standard: { maxChapters: 8, includeDetails: true },
  deep: { maxChapters: 20, includeDetails: true },
};

/**
 * Build translation context: previous chapter summaries + novel metadata.
 * `depth` controls how many chapters and how much detail to include.
 */
export async function buildTranslateContext(
  novelId: string,
  currentChapterOrder: number,
  depth: ContextDepth = "standard",
  nameDict?: Array<{ chinese: string; vietnamese: string }>,
): Promise<string | null> {
  const config = DEPTH_CONFIG[depth];

  const [chapters, novel, characters] = await Promise.all([
    db.chapters.where("novelId").equals(novelId).sortBy("order"),
    config.includeDetails ? db.novels.get(novelId) : Promise.resolve(undefined),
    config.includeDetails
      ? db.characters.where("novelId").equals(novelId).toArray()
      : Promise.resolve([]),
  ]);

  const parts: string[] = [];

  // Novel-level metadata (names for consistency)
  const metaParts: string[] = [];
  if (characters.length > 0) {
    metaParts.push(`Nhân vật: ${characters.map((c) => c.name).join(", ")}`);
  }
  if (novel?.keyLocations?.length) {
    metaParts.push(`Địa danh: ${novel.keyLocations.map((l) => l.name).join(", ")}`);
  }
  if (novel?.factions?.length) {
    metaParts.push(`Thế lực: ${novel.factions.map((f) => f.name).join(", ")}`);
  }
  if (novel?.worldOverview && config.includeDetails) {
    metaParts.push(`Thế giới: ${novel.worldOverview}`);
  }
  if (metaParts.length > 0) {
    parts.push(`## Thuật ngữ & tên riêng\n${metaParts.join("\n")}`);
  }

  // Previous chapter summaries
  const previous = chapters
    .filter((ch) => ch.order < currentChapterOrder && ch.summary)
    .slice(-config.maxChapters);

  if (previous.length > 0) {
    const summaries = previous
      .map((ch) => `### ${ch.title}\n${ch.summary}`)
      .join("\n\n");
    parts.push(`## Tóm tắt chương trước\n${summaries}`);
  }

  // Name dictionary entries for translation consistency
  if (nameDict && nameDict.length > 0) {
    const MAX_NAME_ENTRIES = 500;
    const entries = nameDict.length > MAX_NAME_ENTRIES
      ? nameDict.slice(0, MAX_NAME_ENTRIES)
      : nameDict;
    const nameParts = entries
      .map((e) => `${e.chinese} → ${e.vietnamese}`)
      .join("\n");
    let section = `## Bảng tên riêng\nKhi dịch, hãy sử dụng bảng tên sau để đảm bảo tính nhất quán:\n${nameParts}`;
    if (nameDict.length > MAX_NAME_ENTRIES) {
      section += `\n... và ${nameDict.length - MAX_NAME_ENTRIES} mục khác`;
    }
    parts.push(section);
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

/**
 * Build minimal context for review/edit: character names + location names.
 * Token-efficient — just a flat list of names.
 */
export async function buildMinimalContext(
  novelId: string,
): Promise<string | null> {
  const [characters, novel] = await Promise.all([
    db.characters.where("novelId").equals(novelId).toArray(),
    db.novels.get(novelId),
  ]);

  const parts: string[] = [];

  if (characters.length > 0) {
    const names = characters.map((c) => c.name).join(", ");
    parts.push(`Nhân vật: ${names}`);
  }

  if (novel?.keyLocations?.length) {
    const locations = novel.keyLocations.map((l) => l.name).join(", ");
    parts.push(`Địa danh: ${locations}`);
  }

  if (novel?.factions?.length) {
    const factions = novel.factions.map((f) => f.name).join(", ");
    parts.push(`Thế lực: ${factions}`);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
