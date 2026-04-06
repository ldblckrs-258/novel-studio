import { generateStructured } from "@/lib/ai/structured";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { appendUserInstructionToPrompt } from "@/lib/writing/append-user-instruction";
import { buildWritingContext } from "../context-builder";
import { contextOutputSchema } from "../schemas";
import type {
  AgentConfig,
  ContextAgentInput,
  ContextAgentOutput,
  WritingContext,
} from "../types";

export async function runContextAgent(
  input: ContextAgentInput,
  config: AgentConfig,
): Promise<{ output: ContextAgentOutput; writingContext: WritingContext }> {
  const writingContext = await buildWritingContext(
    input.novelId,
    input.chapterOrder,
  );

  const basePrompt = `<novel_context>
${writingContext.context}
</novel_context>

<request>Tổng hợp thông tin bối cảnh cho chương ${input.chapterOrder} dựa trên dữ liệu trên.</request>`;

  const { object } = await generateStructured<ContextAgentOutput>({
    model: config.model,
    schema: contextOutputSchema,
    system: withGlobalInstruction(config.systemPrompt, config.globalInstruction),
    prompt: appendUserInstructionToPrompt(basePrompt, config.userInstruction),
    abortSignal: config.abortSignal,
  });

  return { output: object, writingContext };
}
