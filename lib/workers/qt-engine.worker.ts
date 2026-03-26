import type {
  QTWorkerRequest,
  QTWorkerResponse,
  ConvertSegment,
  ConvertOptions,
  DictPair,
  ConvertSource,
} from "./qt-engine.types";
import { DEFAULT_CONVERT_OPTIONS } from "./qt-engine.types";

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Pick primary translation from QT-style slash-separated alternatives.
 * Convention: first value before '/' is primary. If it's empty (leading '/'),
 * the particle can be omitted — but we still pick the first non-empty alternative
 * so plain text output is meaningful.
 */
function pickPrimary(value: string): string {
  if (!value.includes("/")) return value;
  const parts = value.split("/");
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed) return trimmed;
  }
  return value;
}

/** Capitalize first letter of each space-separated word: "lục trúc" → "Lục Trúc" */
function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.replace(/(?<=^|\s)\p{Ll}/gu, (c) => c.toUpperCase());
}

/** Capitalize first letter of the string */
function capitalizeFirst(str: string): string {
  if (!str) return str;
  // Find the first letter character and capitalize it
  for (let i = 0; i < str.length; i++) {
    if (/\p{Ll}/u.test(str[i])) {
      return str.slice(0, i) + str[i].toUpperCase() + str.slice(i + 1);
    }
    // If we hit an already-uppercase letter, it's already capitalized
    if (/\p{Lu}/u.test(str[i])) return str;
  }
  return str;
}

const NAME_SOURCES = new Set<ConvertSource>([
  "qt-name",
  "novel-name",
  "global-name",
]);

const SENTENCE_ENDERS = /[.!?。！？…\n]/;

// No space BEFORE these characters
const NO_SPACE_BEFORE =
  /[,.:;!?。，、；：！？…\u201c\u201d\u2018\u2019」』）\])}>～·\-–—\s]/;

// No space AFTER these characters (opening punctuation / whitespace)
const NO_SPACE_AFTER = /[\u201c\u201d\u2018\u2019「『（\[({<\s]/;

// ─── State ───────────────────────────────────────────────────

let namesMap: Map<string, string>; // Names + Names2 merged
let vietPhraseMap: Map<string, string>;
let phienAmMap: Map<string, string>;
let luatNhanPatterns: Array<{
  prefix: string;
  suffix: string;
  template: string;
}>;
let luatNhanPrefixIndex: Map<string, number[]>;
let maxKeyLength = 0;
let maxNameLength = 0;

// ─── Init ────────────────────────────────────────────────────

function initDicts(dictData: Record<string, DictPair[]>): void {
  namesMap = new Map<string, string>();
  vietPhraseMap = new Map<string, string>();
  phienAmMap = new Map<string, string>();
  luatNhanPatterns = [];
  luatNhanPrefixIndex = new Map();

  // Names + Names2 — pick primary, auto-capitalize proper names
  for (const e of dictData.names ?? [])
    namesMap.set(e.chinese, capitalizeWords(pickPrimary(e.vietnamese)));
  for (const e of dictData.names2 ?? [])
    namesMap.set(e.chinese, capitalizeWords(pickPrimary(e.vietnamese)));

  // VietPhrase — pick primary translation
  for (const e of dictData.vietphrase ?? [])
    vietPhraseMap.set(e.chinese, pickPrimary(e.vietnamese));

  // PhienAm (single-char fallback) — pick primary translation
  for (const e of dictData.phienam ?? [])
    phienAmMap.set(e.chinese, pickPrimary(e.vietnamese));

  // LuatNhan — parse {0} patterns
  for (const e of dictData.luatnhan ?? []) {
    const idx = e.chinese.indexOf("{0}");
    if (idx < 0) continue;
    const prefix = e.chinese.slice(0, idx);
    const suffix = e.chinese.slice(idx + 3);
    luatNhanPatterns.push({
      prefix,
      suffix,
      template: pickPrimary(e.vietnamese),
    });
  }

  // Build prefix index for LuatNhan
  for (let i = 0; i < luatNhanPatterns.length; i++) {
    const p = luatNhanPatterns[i];
    if (p.prefix.length > 0) {
      const firstChar = p.prefix[0];
      if (!luatNhanPrefixIndex.has(firstChar)) {
        luatNhanPrefixIndex.set(firstChar, []);
      }
      luatNhanPrefixIndex.get(firstChar)!.push(i);
    }
  }

  // Compute max key lengths
  maxKeyLength = 0;
  for (const k of namesMap.keys())
    if (k.length > maxKeyLength) maxKeyLength = k.length;
  for (const k of vietPhraseMap.keys())
    if (k.length > maxKeyLength) maxKeyLength = k.length;

  maxNameLength = 0;
  for (const k of namesMap.keys())
    if (k.length > maxNameLength) maxNameLength = k.length;
}

// ─── Convert ─────────────────────────────────────────────────

function convert(
  text: string,
  novelNames?: DictPair[],
  globalNames?: DictPair[],
  opts?: ConvertOptions,
): ConvertSegment[] {
  const o = { ...DEFAULT_CONVERT_OPTIONS, ...opts };

  // Build priority Maps for this conversion — apply pickPrimary + capitalizeWords for names
  const novelNamesMap = novelNames?.length
    ? new Map(
        novelNames.map((e) => [
          e.chinese,
          capitalizeWords(pickPrimary(e.vietnamese)),
        ]),
      )
    : null;
  const globalNamesMap = globalNames?.length
    ? new Map(
        globalNames.map((e) => [
          e.chinese,
          capitalizeWords(pickPrimary(e.vietnamese)),
        ]),
      )
    : null;

  // Build filtered vietphrase based on vpLengthPriority
  let filteredVP = vietPhraseMap;
  if (o.vpLengthPriority !== "none") {
    const minLen =
      o.vpLengthPriority === "vp-gt-3" ? 4 :
      o.vpLengthPriority === "vp-gt-4" ? 5 : 0;
    if (minLen > 0) {
      filteredVP = new Map();
      for (const [k, v] of vietPhraseMap) {
        if (k.length >= minLen) filteredVP.set(k, v);
      }
      // Keep single-char VP entries as fallback — they're essential
      for (const [k, v] of vietPhraseMap) {
        if (k.length === 1 && !filteredVP.has(k)) filteredVP.set(k, v);
      }
    }
  }

  // Build priority order based on nameVsPriority and scopePriority
  type PriorityEntry = [ConvertSource, Map<string, string>];
  const priorityMaps: PriorityEntry[] = [];

  // Name maps ordered by scope priority
  const orderedNameMaps: PriorityEntry[] = [];
  if (o.scopePriority === "novel-first") {
    if (novelNamesMap) orderedNameMaps.push(["novel-name", novelNamesMap]);
    if (globalNamesMap) orderedNameMaps.push(["global-name", globalNamesMap]);
  } else {
    if (globalNamesMap) orderedNameMaps.push(["global-name", globalNamesMap]);
    if (novelNamesMap) orderedNameMaps.push(["novel-name", novelNamesMap]);
  }
  orderedNameMaps.push(["qt-name", namesMap]);

  // Name vs VP priority
  if (o.nameVsPriority === "name-first") {
    priorityMaps.push(...orderedNameMaps);
    priorityMaps.push(["vietphrase", filteredVP]);
  } else {
    priorityMaps.push(["vietphrase", filteredVP]);
    priorityMaps.push(...orderedNameMaps);
  }

  // Combined names for LuatNhan {0} matching (already capitalized from Maps)
  const allNames = new Map(namesMap);
  if (globalNamesMap)
    for (const [k, v] of globalNamesMap) allNames.set(k, v);
  if (novelNamesMap)
    for (const [k, v] of novelNamesMap) allNames.set(k, v);

  // Compute effective max key/name lengths (capped by maxPhraseLength option)
  let effectiveMaxKey = Math.min(maxKeyLength, o.maxPhraseLength);
  let effectiveMaxName = maxNameLength;
  if (novelNamesMap)
    for (const k of novelNamesMap.keys()) {
      if (k.length > effectiveMaxKey) effectiveMaxKey = Math.min(k.length, o.maxPhraseLength);
      if (k.length > effectiveMaxName) effectiveMaxName = k.length;
    }
  if (globalNamesMap)
    for (const k of globalNamesMap.keys()) {
      if (k.length > effectiveMaxKey) effectiveMaxKey = Math.min(k.length, o.maxPhraseLength);
      if (k.length > effectiveMaxName) effectiveMaxName = k.length;
    }

  // For "long-first" VP priority, we want to prefer longer VP matches
  // This is already the default behavior (longest-match-first), so no change needed
  // The option is mainly to distinguish from the min-length filters

  const segments: ConvertSegment[] = [];
  let i = 0;

  while (i < text.length) {
    let matched = false;

    // 1. Try LuatNhan patterns (prefix index lookup) — skip if luatNhanMode is "off"
    const char = text[i];
    const patternIndices = o.luatNhanMode !== "off" ? luatNhanPrefixIndex.get(char) : undefined;
    if (patternIndices) {
      for (const pi of patternIndices) {
        const pattern = luatNhanPatterns[pi];
        if (!text.startsWith(pattern.prefix, i)) continue;

        const searchStart = i + pattern.prefix.length;
        // Try longest name first
        for (
          let nameLen = Math.min(
            effectiveMaxName,
            text.length - searchStart,
          );
          nameLen >= 1;
          nameLen--
        ) {
          const candidate = text.slice(searchStart, searchStart + nameLen);
          // "name-only": match only against name dicts; "name-and-pronouns": also match VP
          const luatNhanMatch = allNames.has(candidate) ||
            (o.luatNhanMode === "name-and-pronouns" && filteredVP.has(candidate));
          if (!luatNhanMatch) continue;

          const suffixStart = searchStart + nameLen;
          if (!text.startsWith(pattern.suffix, suffixStart)) continue;

          // Match!
          const translatedName = allNames.get(candidate) ?? filteredVP.get(candidate) ?? candidate;
          const translation = pattern.template.replace(
            "{0}",
            translatedName,
          );
          const matchEnd = suffixStart + pattern.suffix.length;
          segments.push({
            original: text.slice(i, matchEnd),
            translated: translation,
            source: "luatnhan",
          });
          i = matchEnd;
          matched = true;
          break;
        }
        if (matched) break;
      }
    }

    // 2. Try priority Maps (longest match first)
    if (!matched) {
      const maxLen = Math.min(effectiveMaxKey, text.length - i);
      for (let j = maxLen; j >= 1; j--) {
        const sub = text.slice(i, i + j);
        for (const [source, map] of priorityMaps) {
          if (map.has(sub)) {
            segments.push({
              original: sub,
              translated: map.get(sub)!,
              source,
            });
            i += j;
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }

    // 3. Fallback to PhienAm (single character)
    if (!matched) {
      const c = text[i];
      if (phienAmMap.has(c)) {
        segments.push({
          original: c,
          translated: phienAmMap.get(c)!,
          source: "phienam",
        });
      } else {
        segments.push({ original: c, translated: c, source: "unknown" });
      }
      i += 1;
    }
  }

  // Post-process: auto-capitalize sentence starts
  capitalizeSentences(segments);

  return segments;
}

// ─── Post-processing ─────────────────────────────────────────

/**
 * Capitalize the first letter of each sentence in-place.
 * A "sentence start" is: beginning of text, after sentence-ending punctuation,
 * or after a newline (new paragraph). Skips over whitespace and opening quotes
 * to find the first translatable word.
 */
function capitalizeSentences(segments: ConvertSegment[]): void {
  let needsCap = true; // start of text

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text =
      seg.source === "unknown" ? seg.original : seg.translated;

    if (needsCap && seg.source !== "unknown" && !NAME_SOURCES.has(seg.source)) {
      // Capitalize this translated segment
      const capped = capitalizeFirst(seg.translated);
      if (capped !== seg.translated) {
        segments[i] = { ...seg, translated: capped };
      }
      needsCap = false;
    }

    // Check if this segment ends a sentence → next word needs capitalization
    const lastChar = text.trimEnd().slice(-1);
    if (lastChar && SENTENCE_ENDERS.test(lastChar)) {
      needsCap = true;
    }

    // "unknown" segments that are only whitespace / opening quotes don't reset needsCap
    if (
      seg.source === "unknown" &&
      needsCap &&
      /^[\s\u3000""''「『（(\[{<]+$/.test(seg.original)
    ) {
      // Keep needsCap = true, skip over whitespace/opening-quotes
    } else if (seg.source !== "unknown") {
      // Name sources are already capitalized, so they "consume" the needsCap
      if (needsCap && NAME_SOURCES.has(seg.source)) {
        needsCap = false;
      }
    }
  }
}

// ─── Plain text assembly ─────────────────────────────────────

function segmentsToPlainText(segments: ConvertSegment[]): string {
  const parts: string[] = [];

  for (const seg of segments) {
    if (seg.source === "unknown") {
      parts.push(seg.original);
      continue;
    }

    const translated = seg.translated;
    if (!translated) continue;

    // Determine whether to insert a space before this word
    if (parts.length > 0) {
      const prev = parts[parts.length - 1];
      const lastChar = prev.slice(-1);
      const firstChar = translated[0];

      const shouldAddSpace =
        lastChar !== undefined &&
        firstChar !== undefined &&
        // No space after whitespace / newlines
        lastChar !== " " &&
        lastChar !== "\n" &&
        lastChar !== "\u3000" &&
        // No space after opening punctuation
        !NO_SPACE_AFTER.test(lastChar) &&
        // No space before closing punctuation / commas / dots
        !NO_SPACE_BEFORE.test(firstChar);

      if (shouldAddSpace) {
        parts.push(" ");
      }
    }

    parts.push(translated);
  }

  // Clean up: collapse multiple consecutive ASCII spaces only
  return parts.join("").replace(/ {2,}/g, " ");
}

// ─── Message Handler ─────────────────────────────────────────

function post(msg: QTWorkerResponse) {
  self.postMessage(msg);
}

self.onmessage = (event: MessageEvent<QTWorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      try {
        initDicts(msg.dictData);
        post({ type: "ready" });
      } catch (err) {
        post({
          type: "error",
          id: "",
          message: `Init failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      break;
    }

    case "convert": {
      try {
        const segments = convert(msg.text, msg.novelNames, msg.globalNames, msg.options);
        const plainText = segmentsToPlainText(segments);
        post({ type: "result", id: msg.id, segments, plainText });
      } catch (err) {
        post({
          type: "error",
          id: msg.id,
          message: `Convert failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      break;
    }

    case "convert-batch": {
      try {
        for (const item of msg.items) {
          const segments = convert(
            item.text,
            msg.novelNames,
            msg.globalNames,
            msg.options,
          );
          const plainText = segmentsToPlainText(segments);
          post({
            type: "batch-progress",
            id: msg.id,
            itemId: item.itemId,
            segments,
            plainText,
          });
        }
        post({ type: "batch-complete", id: msg.id });
      } catch (err) {
        post({
          type: "error",
          id: msg.id,
          message: `Batch convert failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      break;
    }
  }
};
