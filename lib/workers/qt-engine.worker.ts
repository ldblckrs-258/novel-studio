import type {
  ConvertOptions,
  ConvertSegment,
  ConvertSource,
  DictPair,
  LuatNhanMode,
  QTWorkerRequest,
  QTWorkerResponse,
} from "./qt-engine.types";
import { DEFAULT_CONVERT_OPTIONS } from "./qt-engine.types";
import { sify } from "chinese-conv";
import {
  BRACKET_CLOSE,
  BRACKET_OPEN,
  CAP_PASSTHROUGH,
  CAP_TRIGGERS,
  COMPOUND_SURNAMES,
  DIALOGUE_CLOSE,
  DIALOGUE_OPEN,
  DIGIT_LEADING,
  DIGIT_TRAILING,
  WORD_CHAR_LEADING,
  WORD_CHAR_TRAILING,
  FULLWIDTH_PUNCT,
  isCJK,
  NAME_SOURCES,
  NAME_SUFFIXES,
  NO_SPACE_AFTER,
  NO_SPACE_BEFORE,
  NON_NAME_CHARS,
  SENTENCE_ENDERS,
  SINGLE_SURNAMES,
  normalizeFullwidthPunct,
} from "./qt-engine.constants";
import {
  enrichSegmentsWithPOS,
  initPOSTagger,
  isPOSReady,
} from "./pos-tagger";
import { applyGrammarRules } from "./grammar-rules";

// ─── Helpers ─────────────────────────────────────────────────

/** Pick first non-empty translation from QT-style "a/b/c" alternatives. */
function pickPrimary(value: string): string {
  if (!value.includes("/")) return value;
  const parts = value.split("/");
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed) return trimmed;
  }
  return value;
}

function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.replace(/(?<=^|\s)\p{Ll}/gu, (c) => c.toUpperCase());
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  for (let i = 0; i < str.length; i++) {
    if (/\p{Ll}/u.test(str[i])) {
      return str.slice(0, i) + str[i].toUpperCase() + str.slice(i + 1);
    }
    if (/\p{Lu}/u.test(str[i])) return str;
  }
  return str;
}

// ─── First-char indexed dictionary ──────────────────────────

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

// ─── State ───────────────────────────────────────────────────

let namesMap: Map<string, string>;
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

  for (const e of dictData.names ?? [])
    namesMap.set(e.chinese, capitalizeWords(pickPrimary(e.vietnamese)));
  for (const e of dictData.names2 ?? [])
    namesMap.set(e.chinese, capitalizeWords(pickPrimary(e.vietnamese)));

  for (const e of dictData.vietphrase ?? []) {
    if (e.chinese in FULLWIDTH_PUNCT) {
      vietPhraseMap.set(e.chinese, FULLWIDTH_PUNCT[e.chinese]);
    } else {
      vietPhraseMap.set(e.chinese, pickPrimary(e.vietnamese));
    }
  }

  for (const e of dictData.phienam ?? []) {
    if (e.chinese in FULLWIDTH_PUNCT) {
      phienAmMap.set(e.chinese, FULLWIDTH_PUNCT[e.chinese]);
    } else {
      phienAmMap.set(e.chinese, pickPrimary(e.vietnamese));
    }
  }

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

  maxKeyLength = 0;
  for (const k of namesMap.keys())
    if (k.length > maxKeyLength) maxKeyLength = k.length;
  for (const k of vietPhraseMap.keys())
    if (k.length > maxKeyLength) maxKeyLength = k.length;

  maxNameLength = 0;
  for (const k of namesMap.keys())
    if (k.length > maxNameLength) maxNameLength = k.length;
}

// ─── Name auto-detection ─────────────────────────────────────

function detectNames(
  text: string,
  existingNames: Map<string, string>,
  vpMap: Map<string, string>,
  paMap: Map<string, string>,
  minFrequency: number,
  rejected: Set<string>,
): Map<string, string> {
  const candidates = new Map<string, number>();

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!isCJK(ch)) continue;

    // Check compound surname (2-char) first, then single (1-char)
    const ch2 = i + 1 < text.length ? text.slice(i, i + 2) : "";
    const isCompound = COMPOUND_SURNAMES.has(ch2);
    const isSingle = !isCompound && SINGLE_SURNAMES.has(ch);
    if (!isCompound && !isSingle) continue;

    const surnameLen = isCompound ? 2 : 1;

    // Left-boundary check: if the surname char is the tail of a prior VP word,
    // it's likely continuation of another word, not the start of a name.
    if (i > 0 && isCJK(text[i - 1])) {
      let partOfPriorWord = false;
      for (let pLen = 2; pLen <= Math.min(4, i + 1); pLen++) {
        const prior = text.slice(i - pLen + 1, i + 1);
        if (vpMap.has(prior) || existingNames.has(prior)) {
          partOfPriorWord = true;
          break;
        }
      }
      if (partOfPriorWord) continue;
    }

    // Try given-name lengths: 1 and 2 chars after the surname
    for (let givenLen = 2; givenLen >= 1; givenLen--) {
      const totalLen = surnameLen + givenLen;
      if (i + totalLen > text.length) continue;

      const candidate = text.slice(i, i + totalLen);
      // All chars must be CJK
      if (![...candidate].every(isCJK)) continue;
      // Already a known name — skip (handled by existing pipeline)
      if (existingNames.has(candidate)) continue;
      // Skip if user has rejected this name
      if (rejected.has(candidate)) continue;
      // Skip if in VP dictionary (likely a common word/phrase)
      if (vpMap.has(candidate)) continue;
      // Skip if given-name contains non-name chars (particles, pronouns, etc.)
      const givenName = candidate.slice(surnameLen);
      if ([...givenName].some((c) => NON_NAME_CHARS.has(c))) continue;

      candidates.set(candidate, (candidates.get(candidate) ?? 0) + 1);
    }
  }

  // Filter by frequency, dedup substrings, generate readings
  const result = new Map<string, string>();
  // Sort by length descending so longer names take priority
  const sorted = [...candidates.entries()].sort(
    (a, b) => b[0].length - a[0].length || b[1] - a[1],
  );

  for (const [name, count] of sorted) {
    if (count < minFrequency) continue;
    // Skip if this name is a substring of an already-accepted longer name
    let isSubstring = false;
    for (const accepted of result.keys()) {
      if (accepted.includes(name)) {
        isSubstring = true;
        break;
      }
    }
    if (isSubstring) continue;

    // Generate Hán-Việt reading from phienAm map
    const reading = [...name]
      .map((c) => paMap.get(c) ?? c)
      .join(" ");
    result.set(name, capitalizeWords(reading));
  }

  return result;
}

// ─── Convert ─────────────────────────────────────────────────

// ─── 2-Pass pipeline helpers ────────────────────────────────

interface MatchedRegion {
  start: number;
  end: number;
  segment: ConvertSegment;
}

/**
 * Pre-scan: find LuatNhan pattern matches on raw text.
 * Returns non-overlapping matched regions sorted by position.
 */
function scanLuatNhan(
  text: string,
  allNames: Map<string, string>,
  filteredVP: Map<string, string>,
  effectiveMaxName: number,
  mode: LuatNhanMode,
): MatchedRegion[] {
  if (mode === "off") return [];
  const regions: MatchedRegion[] = [];
  let i = 0;

  while (i < text.length) {
    let matched = false;
    const ch = text[i];
    const patternIndices = luatNhanPrefixIndex.get(ch);

    if (patternIndices) {
      for (const pi of patternIndices) {
        const pattern = luatNhanPatterns[pi];
        if (!text.startsWith(pattern.prefix, i)) continue;

        const searchStart = i + pattern.prefix.length;
        for (
          let nameLen = Math.min(effectiveMaxName, text.length - searchStart);
          nameLen >= 1;
          nameLen--
        ) {
          const candidate = text.slice(searchStart, searchStart + nameLen);
          const isMatch =
            allNames.has(candidate) ||
            (mode === "name-and-pronouns" && filteredVP.has(candidate));
          if (!isMatch) continue;

          const suffixStart = searchStart + nameLen;
          if (!text.startsWith(pattern.suffix, suffixStart)) continue;

          const translatedName =
            allNames.get(candidate) ?? filteredVP.get(candidate) ?? candidate;
          const translation = pattern.template.replace("{0}", translatedName);
          const matchEnd = suffixStart + pattern.suffix.length;

          regions.push({
            start: i,
            end: matchEnd,
            segment: {
              original: text.slice(i, matchEnd),
              translated: translation,
              source: "luatnhan",
            },
          });
          i = matchEnd;
          matched = true;
          break;
        }
        if (matched) break;
      }
    }

    if (!matched) i++;
  }

  return regions;
}

/**
 * Micro-segment with an extra lookup key for dict matching.
 * `original` = display char (may be traditional), `_lk` = simplified char for dict lookup.
 */
interface MicroSegment extends ConvertSegment {
  _lk: string;
}

/**
 * Pass 1: Create one micro-segment per character.
 * Uses simplified text for phienAm lookup (dict is simplified),
 * but keeps original (possibly traditional) text for display.
 */
function createMicroSegments(
  originalText: string,
  simplifiedText: string,
): MicroSegment[] {
  const segments: MicroSegment[] = [];
  for (let i = 0; i < originalText.length; i++) {
    const origCh = originalText[i];
    const simpCh = simplifiedText[i] ?? origCh;
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

/**
 * Pass 2: Walk micro-segments, merge consecutive CJK segments when
 * a compound phrase is found in the priority maps (trie longest-match).
 * Uses `_lk` (simplified) for dict lookup, keeps `original` (traditional) for display.
 */
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
      result.push({ original: seg.original, translated: seg.translated, source: seg.source });
      i++;
      continue;
    }

    // Build lookahead: _lk for dict lookup, original for display
    let lookupCombined = "";
    let originalCombined = "";
    let j = i;
    const maxLook = Math.min(i + maxPhraseLength, microSegments.length);
    while (j < maxLook && microSegments[j].source !== "unknown") {
      lookupCombined += microSegments[j]._lk;
      originalCombined += microSegments[j].original;
      j++;
    }

    // Try longest-match using simplified lookup key
    let matched = false;
    const firstLk = seg._lk;
    for (const [source, indexed] of indexedPriorityMaps) {
      const bucket = indexed.get(firstLk);
      if (!bucket) continue;
      const maxLen = Math.min(bucket.maxleng, lookupCombined.length);

      for (let len = maxLen; len >= 2; len--) {
        const lookupPhrase = lookupCombined.substring(0, len);
        if (bucket.entries.has(lookupPhrase)) {
          result.push({
            original: originalCombined.substring(0, len),
            translated: bucket.entries.get(lookupPhrase)!,
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

    // No compound — try single-char lookup using simplified key
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

    if (!singleMatched) {
      result.push({ original: seg.original, translated: seg.translated, source: seg.source });
    }
    i++;
  }

  return result;
}

// ─── Convert ─────────────────────────────────────────────────

interface ConvertResult {
  segments: ConvertSegment[];
  detectedNames?: DictPair[];
}

function convert(
  text: string,
  novelNames?: DictPair[],
  globalNames?: DictPair[],
  opts?: ConvertOptions,
): ConvertResult {
  const o = { ...DEFAULT_CONVERT_OPTIONS, ...opts };

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

  let filteredVP = vietPhraseMap;
  if (o.vpLengthPriority !== "none") {
    const minLen =
      o.vpLengthPriority === "vp-gt-3"
        ? 4
        : o.vpLengthPriority === "vp-gt-4"
          ? 5
          : 0;
    if (minLen > 0) {
      filteredVP = new Map();
      for (const [k, v] of vietPhraseMap) {
        if (k.length >= minLen) filteredVP.set(k, v);
      }
      for (const [k, v] of vietPhraseMap) {
        if (k.length === 1 && !filteredVP.has(k)) filteredVP.set(k, v);
      }
    }
  }

  type PriorityEntry = [ConvertSource, Map<string, string>];
  const priorityMaps: PriorityEntry[] = [];

  const orderedNameMaps: PriorityEntry[] = [];
  if (o.scopePriority === "novel-first") {
    if (novelNamesMap) orderedNameMaps.push(["novel-name", novelNamesMap]);
    if (globalNamesMap) orderedNameMaps.push(["global-name", globalNamesMap]);
  } else {
    if (globalNamesMap) orderedNameMaps.push(["global-name", globalNamesMap]);
    if (novelNamesMap) orderedNameMaps.push(["novel-name", novelNamesMap]);
  }
  orderedNameMaps.push(["qt-name", namesMap]);

  if (o.nameVsPriority === "name-first") {
    priorityMaps.push(...orderedNameMaps);
    priorityMaps.push(["vietphrase", filteredVP]);
  } else {
    priorityMaps.push(["vietphrase", filteredVP]);
    priorityMaps.push(...orderedNameMaps);
  }

  const allNames = new Map(namesMap);
  if (globalNamesMap) for (const [k, v] of globalNamesMap) allNames.set(k, v);
  if (novelNamesMap) for (const [k, v] of novelNamesMap) allNames.set(k, v);

  // Convert traditional→simplified once for all lookups (dict is simplified)
  const simplified = sify(text) ?? text;

  let autoDetected: Map<string, string> | null = null;
  if (o.autoDetectNames) {
    const rejectedSet = new Set(o.rejectedAutoNames);
    autoDetected = detectNames(
      simplified,
      allNames,
      filteredVP,
      phienAmMap,
      o.nameDetectMinFrequency,
      rejectedSet,
    );
    if (autoDetected.size === 0) autoDetected = null;
  }

  // Insert auto-detected names into priority chain
  if (autoDetected) {
    if (o.nameVsPriority === "name-first") {
      priorityMaps.splice(priorityMaps.length - 1, 0, [
        "auto-name",
        autoDetected,
      ]);
    } else {
      priorityMaps.push(["auto-name", autoDetected]);
    }
    for (const [k, v] of autoDetected) allNames.set(k, v);
  }

  // Build first-char indexed versions of priority maps
  type IndexedPriorityEntry = [ConvertSource, IndexedDict];
  const indexedPriorityMaps: IndexedPriorityEntry[] = priorityMaps.map(
    ([source, map]) => [source, buildIndexedDict(map)],
  );

  // Compute effectiveMaxName for LuatNhan (still needs global scan)
  let effectiveMaxName = maxNameLength;
  if (novelNamesMap)
    for (const k of novelNamesMap.keys())
      if (k.length > effectiveMaxName) effectiveMaxName = k.length;
  if (globalNamesMap)
    for (const k of globalNamesMap.keys())
      if (k.length > effectiveMaxName) effectiveMaxName = k.length;
  if (autoDetected)
    for (const k of autoDetected.keys())
      if (k.length > effectiveMaxName) effectiveMaxName = k.length;

  // ── 2-Pass pipeline ──────────────────────────────────────────
  //
  const luatNhanRegions = scanLuatNhan(
    simplified, // use simplified for LuatNhan pattern matching
    allNames,
    filteredVP,
    effectiveMaxName,
    o.luatNhanMode,
  );

  const segments: ConvertSegment[] = [];
  let pos = 0;

  for (const region of luatNhanRegions) {
    if (pos < region.start) {
      const gapOrig = text.slice(pos, region.start);
      const gapSimp = simplified.slice(pos, region.start);
      const micro = createMicroSegments(gapOrig, gapSimp);
      const merged = trieMerge(micro, indexedPriorityMaps, o.maxPhraseLength);
      segments.push(...merged);
    }
    // LuatNhan segment: keep original text from the original input
    segments.push({
      ...region.segment,
      original: text.slice(region.start, region.end),
    });
    pos = region.end;
  }

  if (pos < text.length) {
    const gapOrig = text.slice(pos, text.length);
    const gapSimp = simplified.slice(pos, text.length);
    const micro = createMicroSegments(gapOrig, gapSimp);
    const merged = trieMerge(micro, indexedPriorityMaps, o.maxPhraseLength);
    segments.push(...merged);
  }

  // Post-processing pipeline
  markDialogue(segments);
  if (o.posTaggingEnabled && isPOSReady()) {
    enrichSegmentsWithPOS(segments, text);
    applyGrammarRules(segments);
  }

  if (autoDetected?.size) capitalizeDetectedNames(segments, autoDetected);
  capitalizeNameAdjacent(segments);
  capitalizeSentences(segments);
  if (o.capitalizeBrackets) capitalizeBracketContent(segments);

  const result: ConvertResult = { segments };
  if (autoDetected?.size) {
    result.detectedNames = [...autoDetected.entries()].map(([c, v]) => ({
      chinese: c,
      vietnamese: v,
    }));
  }
  return result;
}

// ─── Dialogue detection ─────────────────────────────────────

function markDialogue(segments: ConvertSegment[]): void {
  let inside = false;
  for (const seg of segments) {
    const text = seg.source === "unknown" ? seg.original : seg.translated;
    const trimmed = text.trim();
    if (DIALOGUE_OPEN.has(trimmed)) {
      inside = true;
      seg.inDialogue = true;
      continue;
    }
    if (DIALOGUE_CLOSE.has(trimmed)) {
      seg.inDialogue = true;
      inside = false;
      continue;
    }
    if (inside) {
      seg.inDialogue = true;
    }
  }
}

// ─── Post-processing ─────────────────────────────────────────

function capitalizeNameAdjacent(segments: ConvertSegment[]): void {
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const seg = segments[i];
    if (
      NAME_SOURCES.has(prev.source) &&
      !NAME_SOURCES.has(seg.source) &&
      seg.source !== "unknown" &&
      seg.original.length === 1 &&
      NAME_SUFFIXES.has(seg.original)
    ) {
      const capped = capitalizeWords(seg.translated);
      if (capped !== seg.translated)
        segments[i] = { ...seg, translated: capped };
    }
  }
}

function capitalizeDetectedNames(
  segments: ConvertSegment[],
  detectedNames: Map<string, string>,
): void {
  for (const [nameChars] of detectedNames) {
    const nameLen = nameChars.length;
    for (let i = 0; i <= segments.length - nameLen; i++) {
      // Build combined original from consecutive segments
      let combined = "";
      let j = i;
      while (j < segments.length && combined.length < nameLen) {
        combined += segments[j].original;
        j++;
      }
      if (combined !== nameChars) continue;
      // Check if any segment is already a name source — skip if so
      let alreadyName = false;
      for (let k = i; k < j; k++) {
        if (NAME_SOURCES.has(segments[k].source)) {
          alreadyName = true;
          break;
        }
      }
      if (alreadyName) continue;
      // Capitalize each segment and mark as auto-name
      for (let k = i; k < j; k++) {
        segments[k] = {
          ...segments[k],
          translated: capitalizeFirst(segments[k].translated),
          source: "auto-name",
        };
      }
    }
  }
}

function capitalizeBracketContent(segments: ConvertSegment[]): void {
  let inside = false;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.source === "unknown" ? seg.original : seg.translated;
    if (BRACKET_OPEN.test(text)) {
      inside = true;
      continue;
    }
    if (BRACKET_CLOSE.test(text)) {
      inside = false;
      continue;
    }
    if (inside && seg.source !== "unknown") {
      const capped = capitalizeWords(seg.translated);
      if (capped !== seg.translated)
        segments[i] = { ...seg, translated: capped };
    }
  }
}

function capitalizeSentences(segments: ConvertSegment[]): void {
  let needsCap = true;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.source === "unknown" ? seg.original : seg.translated;

    if (needsCap) {
      if (NAME_SOURCES.has(seg.source)) {
        needsCap = false;
      } else if (seg.source !== "unknown") {
        const capped = capitalizeFirst(seg.translated);
        if (capped !== seg.translated)
          segments[i] = { ...seg, translated: capped };
        needsCap = false;
      } else if (CAP_PASSTHROUGH.test(seg.original)) {
        // Punctuation/whitespace — pass through, keep needsCap
      } else {
        needsCap = false;
      }
    }

    if (SENTENCE_ENDERS.test(text) || CAP_TRIGGERS.test(text)) {
      needsCap = true;
    }
  }
}

// ─── Plain text assembly ─────────────────────────────────────

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
        // Keep passthrough word-chars together: "ABC123" stays intact,
        // but translated segments still get spaces: "vị đại"
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
        // Start POS tagger init in background (non-blocking)
        initPOSTagger().catch((err) =>
          console.warn("POS tagger init failed:", err),
        );
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
        const { segments, detectedNames } = convert(
          msg.text,
          msg.novelNames,
          msg.globalNames,
          msg.options,
        );
        const plainText = segmentsToPlainText(segments);
        post({
          type: "result",
          id: msg.id,
          segments,
          plainText,
          detectedNames,
        });
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
          const { segments, detectedNames } = convert(
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
            detectedNames,
          });
        }
        post({ type: "batch-complete", id: msg.id });
      } catch (err) {
        post({
          type: "error",
          id: msg.id,
          message: `Batch failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      break;
    }
  }
};
