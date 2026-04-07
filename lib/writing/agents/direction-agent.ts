import { generateStructured } from "@/lib/ai/structured";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import type { ChapterPlan, PlotArc } from "@/lib/db";
import { appendUserInstructionToPrompt } from "@/lib/writing/append-user-instruction";
import { directionOutputSchema } from "../schemas";
import type {
  AgentConfig,
  ContextAgentOutput,
  DirectionAgentOutput,
} from "../types";

export async function runDirectionAgent(
  contextOutput: ContextAgentOutput,
  plotArcs: PlotArc[],
  config: AgentConfig,
  chapterOrder?: number,
  chapterPlan?: ChapterPlan,
): Promise<DirectionAgentOutput> {
  const contextSummary = [
    `Sự kiện trước đó: ${contextOutput.previousEvents}`,
    `Tiến trình cốt truyện: ${contextOutput.plotProgress}`,
    `Tuyến chưa giải quyết: ${(contextOutput.unresolvedThreads ?? []).join("; ")}`,
    `Trạng thái nhân vật: ${(contextOutput.characterStates ?? []).map((c) => `${c.name}: ${c.currentState}`).join("; ")}`,
  ].join("\n\n");

  // Only include active arcs with relevant plot points
  const arcSummary =
    plotArcs.length > 0
      ? plotArcs.map((a) => {
          const relevantPoints = a.plotPoints
            .filter((p) => p.status !== "resolved")
            .slice(0, 3);
          const pointsText = relevantPoints.length > 0
            ? ` | Điểm mốc sắp tới: ${relevantPoints.map((p) => p.title).join(", ")}`
            : "";
          return `- ${a.title} (${a.type}): ${a.description}${pointsText}`;
        }).join("\n")
      : "";

  // Include chapter plan context if available
  const chapterPlanContext = chapterPlan
    ? [
        chapterPlan.title ? `Tiêu đề chương: ${chapterPlan.title}` : "",
        chapterPlan.directions?.length > 0
          ? `Hướng đi từ kế hoạch: ${chapterPlan.directions.join("; ")}`
          : "",
      ].filter(Boolean).join("\n")
    : "";

  const basePrompt = `${chapterPlanContext ? `<chapter_plan priority="cao — các hướng đi phải nhất quán với kế hoạch này">\nChương ${chapterOrder ?? "?"}.\n${chapterPlanContext}\n</chapter_plan>\n\n` : ""}<context_summary note="tóm tắt — chỉ dùng làm nền, không để chi phối hướng đi">
${contextSummary}
</context_summary>
${arcSummary ? `\n<active_arcs note="chỉ mạch đang hoạt động">\n${arcSummary}\n</active_arcs>` : ""}

<request>
Đề xuất 3–5 hướng đi cho chương ${chapterOrder ?? "tiếp theo"}.${chapterPlanContext ? " Ưu tiên phát triển theo kế hoạch chương đã có." : ""} Mỗi hướng cần có id duy nhất. Trường recommendedOptionIds phải là 1–3 id ưu tiên nhất.
</request>`;

  const { object } = await generateStructured<DirectionAgentOutput>({
    model: config.model,
    schema: directionOutputSchema,
    system: withGlobalInstruction(
      config.systemPrompt,
      config.globalInstruction,
    ),
    prompt: appendUserInstructionToPrompt(basePrompt, config.userInstruction),
    abortSignal: config.abortSignal,
  });

  return object;
}
