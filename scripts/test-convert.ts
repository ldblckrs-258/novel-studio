#!/usr/bin/env npx tsx
/**
 * CLI tool to test the QT convert engine directly.
 *
 * Usage:
 *   npx tsx scripts/test-convert.ts "你好世界"
 *   npx tsx scripts/test-convert.ts --file input.txt
 *   echo "天空中烏雲密布" | npx tsx scripts/test-convert.ts
 *   npx tsx scripts/test-convert.ts --segments "他的剑很锋利"   # show segments detail
 */

import { readFileSync } from "fs";

// ─── Dict loading (reuse the same parsing logic) ────────────

interface DictPair {
  chinese: string;
  vietnamese: string;
}

function parseDictText(text: string): DictPair[] {
  const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const lines = clean.split(/\r?\n/);
  const entries: DictPair[] = [];
  for (const line of lines) {
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const chinese = line.slice(0, idx).trim();
    const vietnamese = line.slice(idx + 1).trim();
    if (chinese && vietnamese) entries.push({ chinese, vietnamese });
  }
  return entries;
}

function pickPrimary(value: string): string {
  if (!value.includes("/")) return value;
  for (const p of value.split("/")) {
    const trimmed = p.trim();
    if (trimmed) return trimmed;
  }
  return value;
}

function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.replace(/(?<=^|\s)\p{Ll}/gu, (c) => c.toUpperCase());
}

// ─── Simplified Chinese conversion ──────────────────────────

let sify: (text: string) => string;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("chinese-conv");
  sify = mod.sify;
} catch {
  sify = (t: string) => t; // fallback: no conversion
}

// ─── isCJK ──────────────────────────────────────────────────

function isCJK(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)
  );
}

// ─── Fullwidth punct ────────────────────────────────────────

const FULLWIDTH_PUNCT: Record<string, string> = {
  "，": ",",
  "。": ".",
  "：": ":",
  "；": ";",
  "！": "!",
  "？": "?",
  "（": "(",
  "）": ")",
  "【": "[",
  "】": "]",
  "、": ",",
  "～": "~",
  "「": "\u201C",
  "」": "\u201D",
  "『": "\u2018",
  "』": "\u2019",
  "\u3000": " ",
  "…": "...",
  "……": "...",
  "—": "\u2014",
  "──": "\u2014",
};

// ─── Segment types ──────────────────────────────────────────

type ConvertSource =
  | "novel-name"
  | "global-name"
  | "qt-name"
  | "auto-name"
  | "vietphrase"
  | "phienam"
  | "luatnhan"
  | "unknown";

interface ConvertSegment {
  original: string;
  translated: string;
  source: ConvertSource;
  _lk?: string; // simplified lookup key
}

// ─── CharBucket / IndexedDict ───────────────────────────────

interface CharBucket {
  entries: Map<string, string>;
  maxleng: number;
}
type IndexedDict = Map<string, CharBucket>;

function buildIndexedDict(source: Map<string, string>): IndexedDict {
  const indexed: IndexedDict = new Map();
  for (const [key, value] of source) {
    const fc = key[0];
    let bucket = indexed.get(fc);
    if (!bucket) {
      bucket = { entries: new Map(), maxleng: 0 };
      indexed.set(fc, bucket);
    }
    bucket.entries.set(key, value);
    if (key.length > bucket.maxleng) bucket.maxleng = key.length;
  }
  return indexed;
}

// ─── 2-pass pipeline ────────────────────────────────────────

interface MicroSegment extends ConvertSegment {
  _lk: string;
}

function createMicroSegments(
  origText: string,
  simpText: string,
  phienAmMap: Map<string, string>,
): MicroSegment[] {
  const segments: MicroSegment[] = [];
  for (let i = 0; i < origText.length; i++) {
    const origCh = origText[i];
    const simpCh = simpText[i] ?? origCh;
    if (isCJK(origCh)) {
      segments.push({
        original: origCh,
        translated: phienAmMap.get(simpCh) ?? phienAmMap.get(origCh) ?? origCh,
        source: "phienam",
        _lk: simpCh,
      });
    } else {
      segments.push({
        original: origCh,
        translated: origCh,
        source: "unknown",
        _lk: origCh,
      });
    }
  }
  return segments;
}

function trieMerge(
  microSegments: MicroSegment[],
  indexedPriorityMaps: Array<[ConvertSource, IndexedDict]>,
  maxPhraseLength: number,
): ConvertSegment[] {
  const result: ConvertSegment[] = [];
  let i = 0;
  while (i < microSegments.length) {
    const seg = microSegments[i];
    if (seg.source === "unknown") {
      result.push(seg);
      i++;
      continue;
    }

    let lookupCombined = "";
    let originalCombined = "";
    let j = i;
    const maxLook = Math.min(i + maxPhraseLength, microSegments.length);
    while (j < maxLook && microSegments[j].source !== "unknown") {
      lookupCombined += microSegments[j]._lk;
      originalCombined += microSegments[j].original;
      j++;
    }

    let matched = false;
    const firstLk = seg._lk;
    for (const [source, indexed] of indexedPriorityMaps) {
      const bucket = indexed.get(firstLk);
      if (!bucket) continue;
      const maxLen = Math.min(bucket.maxleng, lookupCombined.length);
      for (let len = maxLen; len >= 2; len--) {
        const lkPhrase = lookupCombined.substring(0, len);
        if (bucket.entries.has(lkPhrase)) {
          result.push({
            original: originalCombined.substring(0, len),
            translated: bucket.entries.get(lkPhrase)!,
            source,
          });
          i += len;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) continue;

    let singleMatched = false;
    for (const [source, indexed] of indexedPriorityMaps) {
      const bucket = indexed.get(firstLk);
      if (bucket?.entries.has(firstLk)) {
        result.push({
          original: seg.original,
          translated: bucket.entries.get(firstLk)!,
          source,
        });
        singleMatched = true;
        break;
      }
    }
    if (!singleMatched) result.push(seg);
    i++;
  }
  return result;
}

// ─── Plain text assembly ────────────────────────────────────

const NO_SPACE_BEFORE =
  /[,.:;!?。，、；：！？…\u201d\u2019」』）\])}>》»～·\-–—\u2014%°\s]/;
const NO_SPACE_AFTER = /[\u201c\u2018「『（\[({<《«\-–—\u2014\s]/;
const DIGIT_TRAILING = /\d$/;
const DIGIT_LEADING = /^\d/;
const WORD_CHAR_TRAILING = /[\d\p{Script=Latin}]$/u;
const WORD_CHAR_LEADING = /^[\d\p{Script=Latin}]/u;

function normalizeFullwidthPunct(text: string): string {
  const re = new RegExp(
    Object.keys(FULLWIDTH_PUNCT)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"),
    "g",
  );
  return text.replace(re, (m) => FULLWIDTH_PUNCT[m] ?? m);
}

function segmentsToPlainText(segments: ConvertSegment[]): string {
  const parts: string[] = [];
  let prevSource: ConvertSource | undefined;
  for (const seg of segments) {
    const text =
      seg.source === "unknown"
        ? normalizeFullwidthPunct(seg.original)
        : normalizeFullwidthPunct(seg.translated);
    if (!text) continue;
    if (parts.length > 0) {
      const prev = parts[parts.length - 1];
      const lastChar = prev.slice(-1);
      const firstChar = text[0];
      const shouldAddSpace =
        lastChar !== undefined &&
        firstChar !== undefined &&
        lastChar !== " " &&
        lastChar !== "\n" &&
        lastChar !== "\u3000" &&
        !NO_SPACE_AFTER.test(lastChar) &&
        !NO_SPACE_BEFORE.test(firstChar) &&
        !(DIGIT_TRAILING.test(lastChar) && DIGIT_LEADING.test(firstChar)) &&
        !(
          prevSource === "unknown" &&
          seg.source === "unknown" &&
          WORD_CHAR_TRAILING.test(lastChar) &&
          WORD_CHAR_LEADING.test(firstChar)
        );
      if (shouldAddSpace) parts.push(" ");
    }
    prevSource = seg.source;
    parts.push(text);
  }
  return parts
    .join("")
    .replace(/ {2,}/g, " ")
    .replace(/\n /g, "\n")
    .replace(/\.{4,}/g, "...");
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const showSegments = args.includes("--segments");
  const fileIdx = args.indexOf("--file");
  const filteredArgs = args.filter(
    (a) =>
      a !== "--segments" &&
      a !== "--file" &&
      (fileIdx < 0 || args.indexOf(a) !== fileIdx + 1),
  );

  let input: string;
  if (fileIdx >= 0 && args[fileIdx + 1]) {
    input = readFileSync(args[fileIdx + 1], "utf-8");
  } else if (filteredArgs.length > 0) {
    input = filteredArgs.join(" ");
  } else {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    input = Buffer.concat(chunks).toString("utf-8");
  }

  if (!input.trim()) {
    console.error('Usage: npx tsx scripts/test-convert.ts "Chinese text"');
    console.error("       npx tsx scripts/test-convert.ts --file input.txt");
    console.error('       npx tsx scripts/test-convert.ts --segments "text"');
    process.exit(1);
  }

  // Load dicts
  const dictDir = "public/dict";
  console.error("Loading dictionaries...");

  const vpText = readFileSync(`${dictDir}/vietphrase.txt`, "utf-8");
  const namesText = readFileSync(`${dictDir}/names.txt`, "utf-8");
  const names2Text = readFileSync(`${dictDir}/names2.txt`, "utf-8");
  const paText = readFileSync(`${dictDir}/phienam.txt`, "utf-8");

  let overrideText = "";
  try {
    overrideText = readFileSync(`${dictDir}/vietphrase-override.txt`, "utf-8");
  } catch {
    /* optional */
  }

  const namesMap = new Map<string, string>();
  for (const e of parseDictText(namesText))
    namesMap.set(e.chinese, capitalizeWords(pickPrimary(e.vietnamese)));
  for (const e of parseDictText(names2Text))
    namesMap.set(e.chinese, capitalizeWords(pickPrimary(e.vietnamese)));

  const vietPhraseMap = new Map<string, string>();
  for (const e of parseDictText(vpText)) {
    if (e.chinese in FULLWIDTH_PUNCT)
      vietPhraseMap.set(e.chinese, FULLWIDTH_PUNCT[e.chinese]);
    else vietPhraseMap.set(e.chinese, pickPrimary(e.vietnamese));
  }
  // Apply overrides (later entries win via Map.set)
  for (const e of parseDictText(overrideText)) {
    vietPhraseMap.set(e.chinese, pickPrimary(e.vietnamese));
  }

  const phienAmMap = new Map<string, string>();
  for (const e of parseDictText(paText)) {
    if (e.chinese in FULLWIDTH_PUNCT)
      phienAmMap.set(e.chinese, FULLWIDTH_PUNCT[e.chinese]);
    else phienAmMap.set(e.chinese, pickPrimary(e.vietnamese));
  }

  console.error(
    `Loaded: VP=${vietPhraseMap.size}, Names=${namesMap.size}, PA=${phienAmMap.size}, Override=${parseDictText(overrideText).length}`,
  );

  // Build priority maps (name-first order)
  type PriorityEntry = [ConvertSource, Map<string, string>];
  const priorityMaps: PriorityEntry[] = [
    ["qt-name", namesMap],
    ["vietphrase", vietPhraseMap],
  ];
  const indexedPriorityMaps: [ConvertSource, IndexedDict][] = priorityMaps.map(
    ([source, map]) => [source, buildIndexedDict(map)],
  );

  // Convert
  const simplified = sify(input) ?? input;
  const micro = createMicroSegments(input, simplified, phienAmMap);
  const segments = trieMerge(micro, indexedPriorityMaps, 12);
  const plainText = segmentsToPlainText(segments);

  if (showSegments) {
    console.error("\n── Segments ──");
    for (const seg of segments) {
      if (seg.source === "unknown" && !seg.original.trim()) continue;
      const src = seg.source.padEnd(10);
      const orig = seg.original.padEnd(6);
      console.error(`  [${src}] ${orig} → ${seg.translated}`);
    }
    console.error("");
  }

  console.log(plainText);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
