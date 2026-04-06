import { estimateTokens } from "@/lib/analysis/token-budget";
import { db } from "@/lib/db";
import type { WritingContext, WritingContextDepth } from "./types";

const BUDGET_CONFIG: Record<
  WritingContextDepth,
  {
    maxChapterSummaries: number;
    maxCharacterTokens: number;
    maxWorldTokens: number;
    maxPlotTokens: number;
  }
> = {
  standard: {
    maxChapterSummaries: 10,
    maxCharacterTokens: 2000,
    maxWorldTokens: 1500,
    maxPlotTokens: 1000,
  },
  deep: {
    maxChapterSummaries: 50,
    maxCharacterTokens: 6000,
    maxWorldTokens: 4000,
    maxPlotTokens: 3000,
  },
};

/** Truncate text to fit within a token budget */
function truncateToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  // Approximate char limit — estimateTokens uses ~4 chars/token for non-CJK
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars) + "\n...[đã cắt bớt]";
}

/** Compute a simple hash for stale-context detection */
async function computeContextHash(parts: string[]): Promise<string> {
  const raw = parts.join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build comprehensive writing context for story generation.
 *
 * Truncation priority (first to truncate → last):
 * 1. Old chapter summaries (keep recent, drop oldest first)
 * 2. Minor character details (keep names + roles, drop full profiles)
 * 3. World-building details (keep overview, drop specifics)
 * 4. Plot arc details (keep main arc, drop subplot details)
 * 5. Recent chapter summaries (NEVER truncate)
 */
export async function buildWritingContext(
  novelId: string,
  chapterOrder: number,
  depth: WritingContextDepth = "standard",
): Promise<WritingContext> {
  const config = BUDGET_CONFIG[depth];

  const [novel, chapters, characters, plotArcs, characterArcs] =
    await Promise.all([
      db.novels.get(novelId),
      db.chapters.where("novelId").equals(novelId).sortBy("order"),
      db.characters.where("novelId").equals(novelId).toArray(),
      db.plotArcs.where("novelId").equals(novelId).toArray(),
      db.characterArcs.where("novelId").equals(novelId).toArray(),
    ]);

  if (!novel) throw new Error("Novel not found");

  const parts: string[] = [];
  const hashParts: string[] = [novel.updatedAt?.toISOString() ?? ""];

  // ── Novel metadata & world-building ───────────────────────
  const worldParts: string[] = [];
  if (novel.synopsis) worldParts.push(`Tóm tắt: ${novel.synopsis}`);
  if (novel.worldOverview) worldParts.push(`Thế giới: ${novel.worldOverview}`);
  if (novel.powerSystem)
    worldParts.push(`Hệ thống sức mạnh: ${novel.powerSystem}`);
  if (novel.storySetting) worldParts.push(`Bối cảnh: ${novel.storySetting}`);
  if (novel.worldRules) worldParts.push(`Quy tắc: ${novel.worldRules}`);
  if (novel.factions?.length) {
    worldParts.push(
      `Thế lực:\n${novel.factions.map((f) => `- ${f.name}: ${f.description}`).join("\n")}`,
    );
  }
  if (novel.keyLocations?.length) {
    worldParts.push(
      `Địa danh:\n${novel.keyLocations.map((l) => `- ${l.name}: ${l.description}`).join("\n")}`,
    );
  }

  if (worldParts.length > 0) {
    const worldText = worldParts.join("\n");
    parts.push(
      `## Thế giới quan\n${truncateToTokens(worldText, config.maxWorldTokens)}`,
    );
  }

  // ── Characters ────────────────────────────────────────────
  if (characters.length > 0) {
    hashParts.push(
      ...characters.map((c) => c.updatedAt?.toISOString() ?? c.id),
    );

    const charParts: string[] = [];
    let charTokens = 0;

    for (const char of characters) {
      const arc = characterArcs.find((a) => a.characterId === char.id);
      let profile = `### ${char.name} (${char.role})`;
      if (char.personality) profile += `\nTính cách: ${char.personality}`;
      if (char.motivations) profile += `\nĐộng lực: ${char.motivations}`;
      if (char.goals) profile += `\nMục tiêu: ${char.goals}`;
      if (char.strengths) profile += `\nĐiểm mạnh: ${char.strengths}`;
      if (char.weaknesses) profile += `\nĐiểm yếu: ${char.weaknesses}`;
      if (char.relationships?.length) {
        profile += `\nQuan hệ: ${char.relationships.map((r) => `${r.characterName} - ${r.description}`).join("; ")}`;
      }
      if (arc?.trajectory) {
        profile += `\nHành trình: ${arc.trajectory}`;
        if (arc.developments?.length > 0) {
          const recent = [...arc.developments]
            .sort((a, b) => b.chapterOrder - a.chapterOrder)
            .slice(0, 3);
          profile += `\nPhát triển gần đây: ${recent.map((d) => `Ch.${d.chapterOrder}: ${d.description}`).join("; ")}`;
        }
      }

      const tokens = estimateTokens(profile);
      if (charTokens + tokens > config.maxCharacterTokens) {
        // Truncate to name + role only for remaining characters
        charParts.push(`### ${char.name} (${char.role})`);
      } else {
        charParts.push(profile);
        charTokens += tokens;
      }
    }

    parts.push(`## Nhân vật\n${charParts.join("\n\n")}`);
  }

  // ── Plot arcs ─────────────────────────────────────────────
  if (plotArcs.length > 0) {
    hashParts.push(...plotArcs.map((a) => a.updatedAt?.toISOString() ?? a.id));

    const arcParts: string[] = [];
    let arcTokens = 0;

    // Main arcs first, then subplots
    const sorted = [...plotArcs].sort((a, b) => {
      const order = { main: 0, character: 1, subplot: 2 };
      return (order[a.type] ?? 3) - (order[b.type] ?? 3);
    });

    for (const arc of sorted) {
      let arcText = `### ${arc.title} (${arc.type}, ${arc.status})`;
      arcText += `\n${arc.description}`;

      const activePoints = arc.plotPoints.filter(
        (p) => p.status !== "resolved",
      );
      if (activePoints.length > 0) {
        arcText += `\nĐiểm mở: ${activePoints
          .map((p) => {
            if (p.chapterOrder == null) return p.title;
            if (p.chapterOrder <= chapterOrder)
              return `${p.title} [QUÁ HẠN chương ${p.chapterOrder}]`;
            if (p.chapterOrder <= chapterOrder + 3)
              return `${p.title} [đến hạn chương ${p.chapterOrder}]`;
            return p.title;
          })
          .join(", ")}`;
      }

      const tokens = estimateTokens(arcText);
      if (arcTokens + tokens > config.maxPlotTokens) break;
      arcParts.push(arcText);
      arcTokens += tokens;
    }

    if (arcParts.length > 0) {
      parts.push(`## Mạch truyện\n${arcParts.join("\n\n")}`);
    }
  }

  // ── Previous chapter summaries ────────────────────────────
  const previous = chapters
    .filter((ch) => ch.order < chapterOrder && ch.summary)
    .slice(-config.maxChapterSummaries);

  if (previous.length > 0) {
    const summaries = previous
      .map((ch) => `### Chương ${ch.order}: ${ch.title}\n${ch.summary}`)
      .join("\n\n");
    parts.push(`## Tóm tắt chương trước\n${summaries}`);
  }

  // ── Chapter plans for upcoming chapter ────────────────────
  const chapterPlan = await db.chapterPlans
    .where("[novelId+chapterOrder]")
    .equals([novelId, chapterOrder])
    .first();

  if (chapterPlan) {
    const planParts: string[] = [];
    if (chapterPlan.directions.length > 0) {
      planParts.push(`Hướng đi: ${chapterPlan.directions.join("; ")}`);
    }
    if (chapterPlan.outline) {
      planParts.push(`Giàn ý: ${chapterPlan.outline}`);
    }
    if (planParts.length > 0) {
      parts.push(`## Kế hoạch chương ${chapterOrder}\n${planParts.join("\n")}`);
    }
  }

  // ── Prior review issues (cross-session memory) ─────────────
  if (novel.reviewIssues && novel.reviewIssues.length > 0) {
    const recent = novel.reviewIssues.slice(-5);
    const issueLines = recent
      .map((i) => `- Ch.${i.chapterOrder} [${i.type}]: ${i.description}`)
      .join("\n");
    parts.push(`## Vấn đề cần tránh (từ chương trước)\n${issueLines}`);
  }

  const context = parts.join("\n\n");
  const hash = await computeContextHash(hashParts);

  return { context, hash };
}
