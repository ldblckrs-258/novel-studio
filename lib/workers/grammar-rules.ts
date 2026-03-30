/**
 * Grammar rules for Chinese→Vietnamese post-processing.
 *
 * Batch 1: Structural particles (的/了/着/地/得)
 * Batch 2: POS-smart adverbs/modals (还/在/会/要/才/又/都/也/被)
 * Batch 3: Context-aware rules (look at neighboring segments)
 *
 * Rules ONLY fire when posTag is present AND matches.
 * When POS is unavailable → dict translation preserved.
 */

import type { ConvertSegment } from "./qt-engine.types";

// ─── Helpers ────────────────────────────────────────────────

/** Find next non-whitespace segment after index i */
function nextMeaningful(segments: ConvertSegment[], i: number): ConvertSegment | null {
  for (let k = i + 1; k < segments.length; k++) {
    if (segments[k].source !== "unknown") return segments[k];
  }
  return null;
}

/** Find prev non-whitespace segment before index i */
function prevMeaningful(segments: ConvertSegment[], i: number): ConvertSegment | null {
  for (let k = i - 1; k >= 0; k--) {
    if (segments[k].source !== "unknown") return segments[k];
  }
  return null;
}


// ─── Main entry ─────────────────────────────────────────────

export function applyGrammarRules(segments: ConvertSegment[]): void {
  // Pass 1: Simple POS-based rules (Batch 1 + 2)
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.source === "unknown") continue;
    if (!seg.posTag) continue;

    const rule = SIMPLE_RULES[seg.original];
    if (rule && rule.posMatch(seg.posTag)) {
      segments[i] = { ...seg, translated: rule.translation };
    }
  }

  // Pass 2: Context-aware rules (Batch 3)
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.source === "unknown") continue;

    const rules = CONTEXT_RULES[seg.original];
    if (!rules) continue;

    for (const rule of rules) {
      if (rule.match(segments, i)) {
        segments[i] = { ...segments[i], translated: rule.translation };
        break; // first match wins
      }
    }
  }
}

// ─── Batch 1+2: Simple POS rules ───────────────────────────

interface SimpleRule {
  posMatch: (posTag: string) => boolean;
  translation: string;
}

const SIMPLE_RULES: Record<string, SimpleRule> = {
  // ── Batch 1: Structural particles ─────────────────────────

  "的": {
    posMatch: (pos) => pos.startsWith("u"),
    translation: "",
  },
  "了": {
    posMatch: (pos) => pos === "ul" || pos === "ule",
    translation: "rồi",
  },
  "着": {
    posMatch: (pos) => pos === "uz" || (pos.startsWith("u") && pos !== "ul"),
    translation: "",
  },
  "地": {
    posMatch: (pos) => pos.startsWith("u"),
    translation: "",
  },
  "得": {
    posMatch: (pos) => pos === "ud" || pos === "ude",
    translation: "",
  },

  // ── Batch 2: Adverbs & modals ─────────────────────────────

  "还": {
    posMatch: (pos) => pos === "d",
    translation: "vẫn",
  },
  "在": {
    posMatch: (pos) => pos === "d",
    translation: "đang",
  },
  "会": {
    posMatch: (pos) => pos === "d",
    translation: "sẽ",
  },
  "要": {
    posMatch: (pos) => pos === "d",
    translation: "sắp",
  },
  "才": {
    posMatch: (pos) => pos === "d",
    translation: "mới",
  },
  "又": {
    posMatch: (pos) => pos === "d",
    translation: "lại",
  },
  "都": {
    posMatch: (pos) => pos === "d",
    translation: "đều",
  },
  "也": {
    posMatch: (pos) => pos === "d",
    translation: "cũng",
  },
  "被": {
    posMatch: (pos) => pos === "p",
    translation: "bị",
  },
};

// ─── Batch 3: Context-aware rules ───────────────────────────

interface ContextRule {
  match: (segments: ConvertSegment[], i: number) => boolean;
  translation: string;
}

const CONTEXT_RULES: Record<string, ContextRule[]> = {
  // 过: after verb → experience particle "qua" (去过=đã đi qua, 吃过=đã ăn qua)
  // POS=ug → particle; otherwise keep dict
  "过": [
    {
      match: (segs, i) => {
        const pos = segs[i].posTag;
        if (!pos || pos !== "ug") return false;
        const prev = prevMeaningful(segs, i);
        return prev !== null && (prev.posTag !== undefined && prev.posTag.startsWith("v"));
      },
      translation: "qua",
    },
  ],

  // 起来: after verb → resultative complement, often redundant → remove
  // 跑起来=chạy lên, 笑起来=cười lên, 看起来=nhìn lên (→ "trông")
  "起来": [
    {
      match: (segs, i) => {
        const prev = prevMeaningful(segs, i);
        return prev !== null && (prev.posTag !== undefined && prev.posTag.startsWith("v"));
      },
      translation: "lên",
    },
  ],

  // 出来: after verb → directional complement "ra"
  // 走出来=đi ra, 拿出来=lấy ra, 说出来=nói ra
  "出来": [
    {
      match: (segs, i) => {
        const prev = prevMeaningful(segs, i);
        return prev !== null && (prev.posTag !== undefined && prev.posTag.startsWith("v"));
      },
      translation: "ra",
    },
  ],

  // 下去: after verb → continuation complement "xuống/tiếp"
  "下去": [
    {
      match: (segs, i) => {
        const prev = prevMeaningful(segs, i);
        return prev !== null && (prev.posTag !== undefined && prev.posTag.startsWith("v"));
      },
      translation: "xuống",
    },
  ],

  // 不: before adj/verb at sentence end with 吗/？ → question "không"
  // Otherwise keep dict. Most cases dict handles fine.
  // 好不好=tốt không tốt → handled by dict as compound
  // Standalone 不 before verb: "không" (dict already correct)

  // 没: POS=d → "không/chưa". Often 没有=không có (dict compound).
  // Standalone 没 before verb: "chưa"
  "没": [
    {
      match: (segs, i) => {
        const pos = segs[i].posTag;
        if (!pos || pos !== "d") return false;
        const next = nextMeaningful(segs, i);
        return next !== null && (next.posTag !== undefined && next.posTag.startsWith("v"));
      },
      translation: "chưa",
    },
  ],

  // 把: disposal marker → "đem" (when POS=p, before noun+verb)
  // 把书放下=đem sách đặt xuống
  "把": [
    {
      match: (segs, i) => {
        const pos = segs[i].posTag;
        return pos === "p";
      },
      translation: "đem",
    },
  ],

  // 让: POS=v, causative → "để" (让他走=để hắn đi)
  // Dict may translate as "nhường", context-fix to "để"
  "让": [
    {
      match: (segs, i) => {
        const pos = segs[i].posTag;
        if (!pos) return false;
        const next = nextMeaningful(segs, i);
        // 让 + person/pronoun → causative "để"
        return (pos === "v" || pos === "p") &&
          next !== null &&
          (next.posTag !== undefined && (next.posTag.startsWith("n") || next.posTag === "r"));
      },
      translation: "để",
    },
  ],

  // 给: POS=p (preposition) → "cho" (给他=cho hắn)
  // POS=v → "cho" too in most cases. Dict usually handles.
  "给": [
    {
      match: (segs, i) => {
        const pos = segs[i].posTag;
        return pos === "p";
      },
      translation: "cho",
    },
  ],

  // 对: POS=p (preposition) + followed by noun/pronoun → "đối với"
  // POS=a (correct) → keep dict
  "对": [
    {
      match: (segs, i) => {
        const pos = segs[i].posTag;
        if (pos !== "p") return false;
        const next = nextMeaningful(segs, i);
        return next !== null &&
          (next.posTag !== undefined && (next.posTag.startsWith("n") || next.posTag === "r"));
      },
      translation: "đối với",
    },
  ],

  // 向: POS=p → "hướng về" / "về phía"
  "向": [
    {
      match: (segs, i) => segs[i].posTag === "p",
      translation: "hướng về",
    },
  ],

  // 从: POS=p → "từ"
  "从": [
    {
      match: (segs, i) => segs[i].posTag === "p",
      translation: "từ",
    },
  ],
};
