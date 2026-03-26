import { generateStructured } from "@/lib/ai";
import { CHINESE_SURNAMES } from "@/lib/data/chinese-surnames";
import { jsonSchema } from "ai";
import type { LanguageModel } from "ai";

export interface ExtractedName {
  chinese: string;
  vietnamese: string;
  category: string;
  confidence: number;
}

// ─── AI-based extraction ─────────────────────────────────────

const nameExtractionSchema = jsonSchema<{ names: ExtractedName[] }>({
  type: "object",
  properties: {
    names: {
      type: "array",
      items: {
        type: "object",
        properties: {
          chinese: { type: "string", description: "Tên gốc tiếng Trung" },
          vietnamese: { type: "string", description: "Tên phiên âm/dịch tiếng Việt" },
          category: {
            type: "string",
            enum: ["nhân vật", "địa danh", "môn phái", "thuật ngữ", "vật phẩm", "kỹ năng", "khác"],
            description: "Phân loại",
          },
          confidence: { type: "number", minimum: 0, maximum: 1, description: "Độ tin cậy" },
        },
        required: ["chinese", "vietnamese", "category", "confidence"],
      },
    },
  },
  required: ["names"],
});

const EXTRACT_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích tiểu thuyết Trung Quốc. Nhiệm vụ: trích xuất tất cả tên riêng (nhân vật, địa danh, môn phái, thuật ngữ, vật phẩm, kỹ năng) từ cặp văn bản gốc tiếng Trung và bản dịch tiếng Việt.

Quy tắc:
- So sánh bản gốc và bản dịch để tìm cặp tên Trung-Việt tương ứng
- Phân loại chính xác từng cặp tên
- Ưu tiên tên nhân vật và địa danh xuất hiện nhiều lần
- Không bao gồm đại từ, từ phổ thông
- Confidence: 1.0 nếu chắc chắn, 0.5-0.9 nếu không chắc`;

export async function extractNamesAI(opts: {
  model: LanguageModel;
  sourceText: string;
  translatedText: string;
  signal?: AbortSignal;
}): Promise<ExtractedName[]> {
  const prompt = `## Văn bản gốc (Trung)\n${opts.sourceText.slice(0, 5000)}\n\n## Bản dịch (Việt)\n${opts.translatedText.slice(0, 5000)}\n\nHãy trích xuất tất cả tên riêng từ cặp văn bản trên.`;

  const result = await generateStructured({
    model: opts.model,
    schema: nameExtractionSchema,
    system: EXTRACT_SYSTEM_PROMPT,
    prompt,
    abortSignal: opts.signal,
  });

  return result.object.names;
}

// ─── Rule-based extraction ───────────────────────────────────

/** Check if a character is a CJK ideograph */
function isCJK(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
    (code >= 0x3400 && code <= 0x4dbf) // CJK Extension A
  );
}

export async function extractNamesRuleBased(opts: {
  sourceText: string;
  phienAmMap: Map<string, string>;
}): Promise<ExtractedName[]> {
  const { sourceText, phienAmMap } = opts;
  const candidates = new Map<string, number>(); // name → count

  // Find 2-4 char CJK sequences that appear 3+ times
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= sourceText.length - len; i++) {
      const sub = sourceText.slice(i, i + len);
      // All chars must be CJK
      if (![...sub].every(isCJK)) continue;
      // First char should be a known surname (for 2-4 char names)
      const hasSurname =
        CHINESE_SURNAMES.has(sub[0]) ||
        (len >= 3 && CHINESE_SURNAMES.has(sub.slice(0, 2)));
      if (!hasSurname) continue;

      candidates.set(sub, (candidates.get(sub) ?? 0) + 1);
    }
  }

  // Filter to names appearing 3+ times
  const results: ExtractedName[] = [];
  for (const [name, count] of candidates) {
    if (count < 3) continue;

    // Generate Hán-Việt reading
    const syllables = [...name]
      .map((c) => {
        const reading = phienAmMap.get(c);
        if (!reading) return c;
        return reading.charAt(0).toUpperCase() + reading.slice(1);
      })
      .join(" ");

    // Check if not a substring of a longer already-found name
    const isSubstring = results.some(
      (r) => r.chinese.includes(name) && r.chinese !== name,
    );
    if (isSubstring) continue;

    results.push({
      chinese: name,
      vietnamese: syllables,
      category: "nhân vật",
      confidence: Math.min(0.9, 0.3 + count * 0.05),
    });
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  return results.slice(0, 200); // Cap at 200 suggestions
}
