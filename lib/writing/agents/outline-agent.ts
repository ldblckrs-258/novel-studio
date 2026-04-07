import { generateStructured } from "@/lib/ai/structured";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { appendUserInstructionToPrompt } from "@/lib/writing/append-user-instruction";
import { outlineOutputSchema } from "../schemas";
import type {
  AgentConfig,
  ContextAgentOutput,
  OutlineAgentOutput,
} from "../types";

export async function runOutlineAgent(
  contextOutput: ContextAgentOutput,
  selectedDirections: string[],
  chapterLength: number,
  config: AgentConfig,
): Promise<OutlineAgentOutput> {
  const contextSummary = [
    `Sự kiện trước đó: ${contextOutput.previousEvents}`,
    `Trạng thái nhân vật: ${(contextOutput.characterStates ?? []).map((c) => `${c.name}: ${c.currentState}`).join("; ")}`,
    `Thế giới: ${contextOutput.worldState}`,
  ].join("\n\n");

  const directionText = selectedDirections
    .map((d, i) => `${i + 1}. ${d}`)
    .join("\n");

  const basePrompt = `<context>
${contextSummary}
</context>

<selected_directions>
${directionText}
</selected_directions>

<requirements>
  <word_target>Tổng số từ mục tiêu: ${chapterLength} từ</word_target>
  <distribution>Phân bổ số từ hợp lý cho mỗi phân cảnh dựa trên tầm quan trọng và nhịp độ.</distribution>
</requirements>

<request>Tạo giàn ý chi tiết cho chương mới dựa trên bối cảnh và hướng đi đã chọn.</request>`;

  const { object } = await generateStructured<OutlineAgentOutput>({
    model: config.model,
    schema: outlineOutputSchema,
    system: withGlobalInstruction(config.systemPrompt, config.globalInstruction),
    prompt: appendUserInstructionToPrompt(basePrompt, config.userInstruction),
    abortSignal: config.abortSignal,
  });

  return object;
}
