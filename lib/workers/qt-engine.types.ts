export type ConvertSource =
  | "novel-name"
  | "global-name"
  | "qt-name"
  | "vietphrase"
  | "phienam"
  | "luatnhan"
  | "unknown";

export interface ConvertSegment {
  original: string;
  translated: string;
  source: ConvertSource;
}

export interface DictPair {
  chinese: string;
  vietnamese: string;
}

// ─── Convert Options ──────────────────────────────────────────

/** Which dict gets higher priority when both have the same key */
export type NameVsPriority = "name-first" | "vp-first";

/** Whether novel-specific names override global or vice versa */
export type ScopePriority = "novel-first" | "global-first";

/** Min length filter for vietphrase entries */
export type VpLengthPriority = "none" | "long-first" | "vp-gt-3" | "vp-gt-4";

/** LuatNhan application mode */
export type LuatNhanMode = "off" | "name-only" | "name-and-pronouns";

/** How to split text before converting */
export type SplitMode = "sentence" | "paragraph";

export interface ConvertOptions {
  /** name dict vs vietphrase priority (default: "name-first") */
  nameVsPriority?: NameVsPriority;
  /** novel-specific vs global name priority (default: "novel-first") */
  scopePriority?: ScopePriority;
  /** Max phrase length to try matching (default: 12) */
  maxPhraseLength?: number;
  /** VP length priority filter (default: "none") */
  vpLengthPriority?: VpLengthPriority;
  /** LuatNhan mode (default: "name-only") */
  luatNhanMode?: LuatNhanMode;
  /** Split mode for text processing (default: "paragraph") */
  splitMode?: SplitMode;
}

export const DEFAULT_CONVERT_OPTIONS: Required<ConvertOptions> = {
  nameVsPriority: "name-first",
  scopePriority: "novel-first",
  maxPhraseLength: 12,
  vpLengthPriority: "none",
  luatNhanMode: "name-only",
  splitMode: "paragraph",
};

// Main → Worker
export type QTWorkerRequest =
  | {
      type: "init";
      dictData: Record<string, DictPair[]>;
    }
  | {
      type: "convert";
      id: string;
      text: string;
      novelNames?: DictPair[];
      globalNames?: DictPair[];
      options?: ConvertOptions;
    }
  | {
      type: "convert-batch";
      id: string;
      items: Array<{ itemId: string; text: string }>;
      novelNames?: DictPair[];
      globalNames?: DictPair[];
      options?: ConvertOptions;
    };

// Worker → Main
export type QTWorkerResponse =
  | { type: "ready" }
  | {
      type: "result";
      id: string;
      segments: ConvertSegment[];
      plainText: string;
    }
  | {
      type: "batch-progress";
      id: string;
      itemId: string;
      segments: ConvertSegment[];
      plainText: string;
    }
  | { type: "batch-complete"; id: string }
  | { type: "error"; id: string; message: string };
