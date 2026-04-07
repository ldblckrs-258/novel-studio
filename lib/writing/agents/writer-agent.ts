import { streamText } from "ai";
import { db } from "@/lib/db";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { appendUserInstructionToPrompt } from "@/lib/writing/append-user-instruction";
import { buildWritingContext } from "../context-builder";
import type { AgentConfig, ContextAgentOutput, OutlineAgentOutput } from "../types";

/** Hard cap so the user prompt stays within typical model context limits. */
const MAX_REFERENCE_CONTEXT_CHARS = 28_000;

export interface RunWriterAgentInput {
  novelId: string;
  chapterOrder: number;
  contextOutput: ContextAgentOutput;
  outline: OutlineAgentOutput;
}

export async function runWriterAgent(
  input: RunWriterAgentInput,
  config: AgentConfig,
  onChunk?: (text: string) => void,
): Promise<string> {
  const { novelId, chapterOrder, contextOutput, outline } = input;

  const [writingContext, chapterPlan] = await Promise.all([
    buildWritingContext(novelId, chapterOrder, "standard"),
    db.chapterPlans
      .where("[novelId+chapterOrder]")
      .equals([novelId, chapterOrder])
      .first(),
  ]);

  let referenceBlock = writingContext.context;
  if (referenceBlock.length > MAX_REFERENCE_CONTEXT_CHARS) {
    referenceBlock =
      referenceBlock.slice(0, MAX_REFERENCE_CONTEXT_CHARS) +
      "\n\n...[bối cảnh tham chiếu đã rút gọn do độ dài]";
  }

  const directionsBlock =
    chapterPlan && chapterPlan.directions?.length > 0
      ? chapterPlan.directions.map((d, i) => `${i + 1}. ${d}`).join("\n")
      : "";

  const unresolved =
    contextOutput.unresolvedThreads?.length > 0
      ? contextOutput.unresolvedThreads.join("; ")
      : "(không ghi nhận)";

  const contextSummary = [
    `Sự kiện trước đó: ${contextOutput.previousEvents}`,
    `Tiến trình cốt truyện: ${contextOutput.plotProgress}`,
    `Tuyến chưa giải quyết: ${unresolved}`,
    `Trạng thái nhân vật: ${(contextOutput.characterStates ?? []).map((c) => `${c.name}: ${c.currentState}`).join("; ")}`,
    `Thế giới (tóm tắt): ${contextOutput.worldState}`,
  ].join("\n");

  const directionsSection = directionsBlock
    ? `## Hướng đi đã chọn (bắt buộc tuân thủ — không tự đổi hướng khác)
${directionsBlock}

`
    : "";

  const outlineText = outline.scenes
    .map(
      (s, i) =>
        `### Phân cảnh ${i + 1}: ${s.title}
Tóm tắt: ${s.summary}
Nhân vật: ${(s.characters ?? []).join(", ")}
${s.location ? `Địa điểm: ${s.location}` : ""}
Sự kiện: ${(s.keyEvents ?? []).join("; ")}
Tâm trạng: ${s.mood}
Số từ: ~${s.wordCountTarget} từ`,
    )
    .join("\n\n");

  const basePrompt = `<context_summary>
${contextSummary}
</context_summary>

${directionsSection ? `<selected_directions constraint="bắt buộc tuân thủ — không tự đổi hướng khác">\n${directionsBlock}\n</selected_directions>\n\n` : ""}<novel_reference note="tên nhân vật, thế giới, mạch truyện, chương trước — phải khớp chính xác; không đổi tên, không bịa thiết lập trái với dữ liệu này">
${referenceBlock}
</novel_reference>

<chapter_synopsis>
${outline.synopsis}
</chapter_synopsis>

<detailed_outline>
${outlineText}
</detailed_outline>

<requirements>
  <req>Tên chương: "${outline.chapterTitle}"</req>
  <req>Tổng số từ mục tiêu: ${outline.totalWordCountTarget} từ</req>
  <req>Bám sát giàn ý và hướng đi đã chọn; giữ nhất quán với tham chiếu tiểu thuyết.</req>
  <req>Viết văn xuôi thuần túy, không dùng markdown.</req>
  <req>Viết bằng Tiếng Việt.</req>
</requirements>`;

  const result = streamText({
    model: config.model,
    system: withGlobalInstruction(config.systemPrompt, config.globalInstruction),
    prompt: appendUserInstructionToPrompt(basePrompt, config.userInstruction),
    abortSignal: config.abortSignal,
  });

  let accumulated = "";

  for await (const chunk of result.textStream) {
    accumulated += chunk;
    onChunk?.(chunk);
  }

  if (config.abortSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  return accumulated;
}
