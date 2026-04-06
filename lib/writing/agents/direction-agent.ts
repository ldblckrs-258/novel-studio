import { generateStructured } from "@/lib/ai/structured";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import type { PlotArc } from "@/lib/db";
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
): Promise<DirectionAgentOutput> {
  const contextSummary = [
    `Sự kiện trước đó: ${contextOutput.previousEvents}`,
    `Tiến trình cốt truyện: ${contextOutput.plotProgress}`,
    `Tuyến chưa giải quyết: ${contextOutput.unresolvedThreads.join("; ")}`,
    `Trạng thái nhân vật: ${contextOutput.characterStates.map((c) => `${c.name}: ${c.currentState}`).join("; ")}`,
    `Thế giới: ${contextOutput.worldState}`,
  ].join("\n\n");

  const arcSummary =
    plotArcs.length > 0
      ? `\n\nMạch truyện:\n${plotArcs.map((a) => `- ${a.title} (${a.type}, ${a.status}): ${a.description}`).join("\n")}`
      : "";

  const chapterNote =
    chapterOrder != null
      ? `\n\nĐang viết chương ${chapterOrder}. Các điểm cốt truyện đánh dấu [QUÁ HẠN] hoặc [đến hạn] nên được ưu tiên giải quyết trong các hướng đi đề xuất.`
      : "";

  const basePrompt = `Dựa trên bối cảnh sau, hãy đề xuất 3-5 hướng đi cho chương tiếp theo. Mỗi hướng cần có id duy nhất. Trường recommendedOptionIds phải là 1-3 id trong danh sách options mà bạn cho là ưu tiên nhất (thứ tự từ quan trọng đến phụ).\n\n${contextSummary}${arcSummary}${chapterNote}`;

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
