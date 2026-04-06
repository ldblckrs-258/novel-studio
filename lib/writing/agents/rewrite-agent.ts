import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { appendUserInstructionToPrompt } from "@/lib/writing/append-user-instruction";
import { streamText } from "ai";
import type {
  AgentConfig,
  ReviewAgentOutput,
  RewriteTargetOptions,
} from "../types";

/**
 * Rewrite agent: takes the original chapter content + review feedback,
 * rewrites the chapter to fix identified issues.
 * Uses streaming for real-time display (same as writer agent).
 */
export async function runRewriteAgent(
  originalContent: string,
  review: ReviewAgentOutput,
  config: AgentConfig,
  onChunk?: (text: string) => void,
  targetOptions?: RewriteTargetOptions,
): Promise<string> {
  const isSelective =
    targetOptions?.targetIssueIndices != null &&
    targetOptions.targetIssueIndices.length > 0 &&
    targetOptions.targetIssueIndices.length < review.issues.length;

  const issuesToFix = isSelective
    ? review.issues.filter((_, i) =>
        targetOptions!.targetIssueIndices!.includes(i),
      )
    : review.issues;

  const issuesList = issuesToFix
    .map(
      (issue) =>
        `- [${issue.severity}] ${issue.type}: ${issue.description} (${issue.location}) → ${issue.suggestion}`,
    )
    .join("\n");

  const scope = isSelective
    ? `Chỉ sửa các vấn đề được liệt kê dưới đây. Giữ nguyên hoàn toàn các phần còn lại của chương không liên quan đến các vấn đề này.`
    : `Viết lại TOÀN BỘ chương, không chỉ sửa từng phần nhỏ.`;

  const basePrompt = `Dựa trên đánh giá của biên tập viên, hãy viết lại chương truyện để khắc phục các vấn đề.

## Đánh giá (${review.overallScore}/10)
${review.summary}

## Các vấn đề cần sửa${isSelective ? ` (đã chọn ${issuesToFix.length}/${review.issues.length} vấn đề)` : ""}
${issuesList}

## Nội dung gốc
${originalContent}

## Yêu cầu
- ${scope}
- Giữ nguyên cốt truyện, nhân vật và sự kiện
- Khắc phục tất cả vấn đề được nêu trong đánh giá
- Giữ nguyên phong cách và giọng văn của tác giả
- KHÔNG dùng markdown, chỉ văn xuôi thuần túy`;

  const result = streamText({
    model: config.model,
    system: withGlobalInstruction(
      config.systemPrompt,
      config.globalInstruction,
    ),
    prompt: appendUserInstructionToPrompt(basePrompt, config.userInstruction),
    abortSignal: config.abortSignal,
  });

  let accumulated = "";
  for await (const chunk of result.textStream) {
    accumulated += chunk;
    onChunk?.(chunk);
  }

  return accumulated;
}
