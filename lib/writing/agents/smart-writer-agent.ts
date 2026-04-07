import { createNovelReadTools } from "@/lib/ai/novel-read-tools";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { db } from "@/lib/db";
import { appendUserInstructionToPrompt } from "@/lib/writing/append-user-instruction";
import {
  buildSmartWriterUserPrompt,
  SMART_WRITER_TOOL_LIMIT_MESSAGE,
} from "@/lib/writing/prompts";
import {
  getSmartWriterToolLabelVi,
  SMART_WRITER_WRITING_LABEL_VI,
} from "@/lib/writing/smart-writer-tool-labels";
import { stepCountIs, streamText } from "ai";
import type {
  AgentConfig,
  ContextAgentOutput,
  OutlineAgentOutput,
} from "../types";

function ellipsis(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}

export interface RunSmartWriterAgentInput {
  novelId: string;
  chapterOrder: number;
  contextOutput: ContextAgentOutput;
  outline: OutlineAgentOutput;
}

export async function runSmartWriterAgent(
  input: RunSmartWriterAgentInput,
  config: AgentConfig,
  chapterLength: number,
  maxToolSteps: number,
  onChunk?: (text: string) => void,
  onToolActivity?: (label: string) => void,
): Promise<string> {
  const { novelId, chapterOrder, contextOutput, outline } = input;

  const [chapterPlan, allCharacters] = await Promise.all([
    db.chapterPlans
      .where("[novelId+chapterOrder]")
      .equals([novelId, chapterOrder])
      .first(),
    db.characters.where("novelId").equals(novelId).toArray(),
  ]);

  const characterNameList =
    allCharacters.length > 0
      ? allCharacters.map((c) => `${c.name} (${c.role})`).join(", ")
      : "(chưa có nhân vật)";

  const directionsBlock =
    chapterPlan && chapterPlan.directions?.length > 0
      ? chapterPlan.directions.map((d, i) => `${i + 1}. ${d}`).join("\n")
      : "";

  const unresolved =
    contextOutput.unresolvedThreads?.length > 0
      ? contextOutput.unresolvedThreads.join("; ")
      : "(không ghi nhận)";

  const contextSummary = [
    `Sự kiện trước đó (rút gọn): ${ellipsis(contextOutput.previousEvents, 1200)}`,
    `Tiến trình cốt truyện: ${contextOutput.plotProgress}`,
    `Tuyến chưa giải quyết: ${unresolved}`,
    `Trạng thái nhân vật (rút gọn): ${(contextOutput.characterStates ?? [])
      .slice(0, 8)
      .map((c) => `${c.name}: ${c.currentState}`)
      .join("; ")}${(contextOutput.characterStates ?? []).length > 8 ? "…" : ""}`,
    `Thế giới (rút gọn): ${ellipsis(contextOutput.worldState, 800)}`,
  ].join("\n");

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

  const toolBudgetNote =
    outline.scenes.length > 0
      ? `Bạn có tổng cộng ~${maxToolSteps} lần gọi công cụ. Phân bổ hợp lý (~${Math.ceil(maxToolSteps / outline.scenes.length)} lần/phân cảnh) để đủ tra cứu trước khi viết.\n`
      : "";

  const baseUser = buildSmartWriterUserPrompt({
    chapterTitle: outline.chapterTitle,
    chapterOrder,
    toolBudgetNote,
    characterNameList,
    contextSummary,
    directionsBlock,
    synopsis: outline.synopsis,
    outlineText,
    totalWordCountTarget: outline.totalWordCountTarget,
    chapterLength,
  });

  const systemPrompt = config.systemPrompt.replace(
    "{chapterLength}",
    String(chapterLength),
  );

  const tools = createNovelReadTools(novelId);
  const userContent = appendUserInstructionToPrompt(
    baseUser,
    config.userInstruction,
  );

  const result = streamText({
    model: config.model,
    system: withGlobalInstruction(systemPrompt, config.globalInstruction),
    messages: [{ role: "user", content: userContent }],
    tools,
    stopWhen: stepCountIs(maxToolSteps),
    abortSignal: config.abortSignal,
  });

  let accumulated = "";
  let finishReason: string | undefined;
  let streamPhase: "tool" | "text" | null = null;

  const markWritingText = () => {
    if (streamPhase !== "text") {
      streamPhase = "text";
      onToolActivity?.(SMART_WRITER_WRITING_LABEL_VI);
    }
  };

  for await (const part of result.fullStream) {
    if (part.type === "tool-input-start") {
      streamPhase = "tool";
      onToolActivity?.(getSmartWriterToolLabelVi(part.toolName));
    } else if (part.type === "text-delta") {
      markWritingText();
      accumulated += part.text;
      onChunk?.(part.text);
    } else if (part.type === "finish-step") {
      finishReason = part.finishReason;
    } else if (part.type === "error") {
      throw part.error;
    }
  }

  if (config.abortSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  if (finishReason === "tool-calls" && !config.abortSignal?.aborted) {
    try {
      const { messages: responseMessages } = await result.response;
      const followUp = streamText({
        model: config.model,
        messages: [
          ...responseMessages,
          {
            role: "user",
            content: SMART_WRITER_TOOL_LIMIT_MESSAGE,
          },
        ],
        abortSignal: config.abortSignal,
      });

      streamPhase = null;
      for await (const part of followUp.fullStream) {
        if (part.type === "text-delta") {
          markWritingText();
          accumulated += part.text;
          onChunk?.(part.text);
        } else if (part.type === "error") {
          throw part.error;
        }
      }
    } catch {
      // Keep partial accumulated text
    }
  }

  if (config.abortSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  return accumulated;
}
