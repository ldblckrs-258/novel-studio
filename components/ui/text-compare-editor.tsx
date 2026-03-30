"use client";

import {
  computeDiff,
  formatStats,
  type DiffResult,
} from "@/lib/chapter-tools/diff-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebouncedValue } from "@/lib/hooks/use-debounce";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { Settings2Icon } from "lucide-react";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "./button";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ScrollbarMarks } from "./scrollbar-marks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Switch } from "./switch";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CompareEditorConfig {
  showDiff: boolean;
  syncScroll: boolean;
  fontSize: FontSizeKey;
}

type FontSizeKey = "xs" | "sm" | "base" | "lg";

interface TextCompareEditorProps {
  /** Content for the left panel */
  leftValue: string;
  /** Content for the right panel */
  rightValue: string;
  /** Called when the editable panel's content changes. Omit for fully readonly mode. */
  onChange?: (value: string) => void;
  /** Which panel is editable (default: "right") */
  editableSide?: "left" | "right";
  /** Default initial value for showDiff — overridden once user changes via settings (default: false) */
  showDiff?: boolean;
  /** Optional label above the left panel */
  leftLabel?: string;
  /** Optional label above the right panel */
  rightLabel?: string;
  /** Additional class names merged onto the root container */
  className?: string;
  /** Additional class names merged onto the panel wrapper */
  panelWrapperClassName?: string;
  /** LocalStorage key suffix for persisting settings (default: "default") */
  storageKey?: string;
}

/* ------------------------------------------------------------------ */
/*  Font-size mapping                                                  */
/* ------------------------------------------------------------------ */

const FONT_SIZES: Record<FontSizeKey, { content: string; gutter: string }> = {
  xs: { content: "text-xs leading-4", gutter: "text-[10px] leading-4" },
  sm: { content: "text-sm leading-5", gutter: "text-xs leading-5" },
  base: { content: "text-base leading-6", gutter: "text-xs leading-6" },
  lg: { content: "text-lg leading-7", gutter: "text-sm leading-7" },
};

const FONT_SIZE_OPTIONS: { value: FontSizeKey; label: string }[] = [
  { value: "xs", label: "Rất nhỏ" },
  { value: "sm", label: "Nhỏ" },
  { value: "base", label: "Vừa" },
  { value: "lg", label: "Lớn" },
];

/* ------------------------------------------------------------------ */
/*  Async word-diff hook                                               */
/* ------------------------------------------------------------------ */

function useAsyncWordDiff(
  a: string,
  b: string,
  enabled: boolean,
): DiffResult | null {
  const debouncedA = useDebouncedValue(a, 200);
  const debouncedB = useDebouncedValue(b, 200);
  const [result, setResult] = useState<DiffResult | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const id = requestIdleCallback(
      () => {
        if (!cancelled) setResult(computeDiff(debouncedA, debouncedB));
      },
      { timeout: 1000 },
    );

    return () => {
      cancelled = true;
      cancelIdleCallback(id);
    };
  }, [debouncedA, debouncedB, enabled]);

  return enabled ? result : null;
}

/* ------------------------------------------------------------------ */
/*  Shared base styles (font-size classes added dynamically)           */
/* ------------------------------------------------------------------ */

const LINE_CLS = "flex";
const GUTTER_BASE =
  "w-12 shrink-0 self-stretch border-r pr-2 text-right font-mono text-muted-foreground/60 select-none";
const CONTENT_BASE =
  "min-w-0 flex-1 whitespace-pre-wrap break-words px-3 font-mono";

/* ------------------------------------------------------------------ */
/*  Plain lines (readonly, no diff)                                    */
/* ------------------------------------------------------------------ */

const PlainLines = memo(function PlainLines({
  value,
  gutterCls,
  contentCls,
}: {
  value: string;
  gutterCls: string;
  contentCls: string;
}) {
  const lines = useMemo(() => value.split("\n"), [value]);

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className={LINE_CLS}>
          <span className={gutterCls}>{i + 1}</span>
          <span className={contentCls}>{line || "\u00A0"}</span>
        </div>
      ))}
    </>
  );
});

/* ------------------------------------------------------------------ */
/*  Word-level diff (readonly, inline highlights per line)             */
/* ------------------------------------------------------------------ */

interface DiffSpan {
  text: string;
  highlighted: boolean;
}

const WordDiffLines = memo(function WordDiffLines({
  diff,
  side,
  gutterCls,
  contentCls,
}: {
  diff: DiffResult;
  side: "left" | "right";
  gutterCls: string;
  contentCls: string;
}) {
  // Build line-by-line structure from word-level changes,
  // keeping only spans that belong to this side.
  const lines = useMemo(() => {
    const result: DiffSpan[][] = [[]];

    for (const change of diff.changes) {
      // Left panel: skip added (belongs to right side only)
      if (side === "left" && change.added) continue;
      // Right panel: skip removed (belongs to left side only)
      if (side === "right" && change.removed) continue;

      const highlighted = !!(side === "left" ? change.removed : change.added);

      const parts = change.value.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) result.push([]);
        if (parts[i]) {
          result[result.length - 1].push({ text: parts[i], highlighted });
        }
      }
    }

    return result;
  }, [diff, side]);

  const hlCls =
    side === "left"
      ? "rounded-sm bg-red-200 text-red-800 line-through dark:bg-red-800/50 dark:text-red-300"
      : "rounded-sm bg-green-200 text-green-800 dark:bg-green-800/50 dark:text-green-300";
  const lineBgCls =
    side === "left"
      ? "bg-red-50 dark:bg-red-950/30"
      : "bg-green-50 dark:bg-green-950/30";
  const markColor =
    side === "left"
      ? "bg-red-400 dark:bg-red-500"
      : "bg-green-400 dark:bg-green-500";

  return (
    <>
      {lines.map((spans, i) => {
        const hasHighlight = spans.some((s) => s.highlighted);
        return (
          <div
            key={i}
            className={cn(LINE_CLS, hasHighlight && lineBgCls)}
            {...(hasHighlight
              ? { "data-mark": true, "data-mark-color": markColor }
              : {})}
          >
            <span className={gutterCls}>{i + 1}</span>
            <span className={contentCls}>
              {spans.length === 0
                ? "\u00A0"
                : spans.map((s, j) => (
                    <span key={j} className={s.highlighted ? hlCls : undefined}>
                      {s.text}
                    </span>
                  ))}
            </span>
          </div>
        );
      })}
    </>
  );
});

/* ------------------------------------------------------------------ */
/*  Settings popover                                                   */
/* ------------------------------------------------------------------ */

function SettingsPopover({
  config,
  onUpdate,
}: {
  config: CompareEditorConfig;
  onUpdate: (patch: Partial<CompareEditorConfig>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Cài đặt hiển thị">
          <Settings2Icon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 space-y-3 p-3">
        {/* Show diff */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">Hiện diff</Label>
          <Switch
            size="sm"
            checked={config.showDiff}
            onCheckedChange={(v) => onUpdate({ showDiff: v })}
          />
        </div>

        {/* Sync scroll */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">Đồng bộ cuộn</Label>
          <Switch
            size="sm"
            checked={config.syncScroll}
            onCheckedChange={(v) => onUpdate({ syncScroll: v })}
          />
        </div>

        {/* Font size */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal">Cỡ chữ</Label>
          <Select
            value={config.fontSize}
            onValueChange={(v) => onUpdate({ fontSize: v as FontSizeKey })}
          >
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function TextCompareEditor({
  leftValue,
  rightValue,
  onChange,
  editableSide = "right",
  showDiff: defaultShowDiff = false,
  leftLabel,
  rightLabel,
  className,
  panelWrapperClassName,
  storageKey = "default",
}: TextCompareEditorProps) {
  /* ── mobile panel toggle ── */
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState<"left" | "right">("left");

  /* ── persisted config ── */

  const [config, setConfig] = useLocalStorage<CompareEditorConfig>(
    `text-compare-editor:${storageKey}`,
    { showDiff: defaultShowDiff, syncScroll: true, fontSize: "sm" },
  );

  const updateConfig = useCallback(
    (patch: Partial<CompareEditorConfig>) =>
      setConfig((prev) => ({ ...prev, ...patch })),
    [setConfig],
  );

  /* ── refs ── */

  const leftScrollRef = useRef<HTMLElement | null>(null);
  const rightScrollRef = useRef<HTMLElement | null>(null);
  const editableMirrorRef = useRef<HTMLDivElement | null>(null);
  const scrollLock = useRef(false);

  const diff = useAsyncWordDiff(leftValue, rightValue, config.showDiff);
  const isLeftEditable = !!onChange && editableSide === "left";

  /* ── sync mirror padding with textarea scrollbar width ── */

  useEffect(() => {
    const editableScrollRef = isLeftEditable ? leftScrollRef : rightScrollRef;
    const textarea = editableScrollRef.current;
    const mirror = editableMirrorRef.current;
    if (!textarea || !mirror) return;

    const sync = () => {
      const sw = textarea.offsetWidth - textarea.clientWidth;
      mirror.style.paddingRight = `${sw}px`;
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(textarea);
    return () => ro.disconnect();
  }, [isLeftEditable]);

  /* ── keep mirror in sync after every render ── */
  // Browser may adjust textarea.scrollTop without firing scroll events
  // (e.g. content change, paste, programmatic value set).
  // Reading scrollTop in useLayoutEffect forces reflow → correct value before paint.
  useLayoutEffect(() => {
    const editableEl = isLeftEditable
      ? leftScrollRef.current
      : rightScrollRef.current;
    if (editableMirrorRef.current && editableEl)
      editableMirrorRef.current.style.transform = `translateY(${-editableEl.scrollTop}px)`;
  });

  /* ── deferred mirror value for editable panel ── */
  // Textarea uses immediate value; mirror uses deferred value so React can
  // interrupt/batch the expensive PlainLines reconciliation during fast typing.
  const editableValue = isLeftEditable ? leftValue : rightValue;
  const deferredEditableValue = useDeferredValue(editableValue);

  /* ── resolved font classes ── */

  const { content: contentFont, gutter: gutterFont } =
    FONT_SIZES[config.fontSize];
  const gutterCls = cn(GUTTER_BASE, gutterFont);
  const contentCls = cn(CONTENT_BASE, contentFont);

  /* ── scroll sync (proportional) ── */

  const handleScroll = useCallback(
    (source: "left" | "right") => (e: React.UIEvent<HTMLElement>) => {
      // Mirror ALWAYS follows the textarea scroll — must run even when locked
      const editableEl = isLeftEditable
        ? leftScrollRef.current
        : rightScrollRef.current;
      if (editableMirrorRef.current && editableEl)
        editableMirrorRef.current.style.transform = `translateY(${-editableEl.scrollTop}px)`;

      if (scrollLock.current) return;
      scrollLock.current = true;

      // cross-panel sync (only when enabled)
      if (config.syncScroll) {
        const src = e.currentTarget;
        const srcMax = src.scrollHeight - src.clientHeight;
        const target = source === "left" ? rightScrollRef : leftScrollRef;
        if (target.current) {
          if (srcMax > 0) {
            const ratio = src.scrollTop / srcMax;
            const tgtMax =
              target.current.scrollHeight - target.current.clientHeight;
            target.current.scrollTop = Math.round(ratio * tgtMax);
          } else {
            target.current.scrollTop = 0;
          }
        }
      }

      // hold lock for 2 frames to absorb async bounce-back events
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollLock.current = false;
        });
      });
    },
    [isLeftEditable, config.syncScroll],
  );

  /* ── render panel ── */

  function renderPanel(
    side: "left" | "right",
    value: string,
    editable: boolean,
  ) {
    const scrollRef = side === "left" ? leftScrollRef : rightScrollRef;
    const onScroll = handleScroll(side);
    const showDiffHighlight = config.showDiff && !!diff;
    // Diff forces readonly so both panels show highlights
    // without the cost of re-rendering mirror + diff on every keystroke.
    const effectiveEditable = editable && !showDiffHighlight;
    // Editable panel mirror uses deferred value to avoid blocking on keystrokes
    const mirrorValue = effectiveEditable ? deferredEditableValue : value;

    // Choose mirror content: diff-highlighted or plain lines
    const linesContent = showDiffHighlight ? (
      <WordDiffLines
        diff={diff!}
        side={side}
        gutterCls={gutterCls}
        contentCls={contentCls}
      />
    ) : (
      <PlainLines
        value={mirrorValue}
        gutterCls={gutterCls}
        contentCls={contentCls}
      />
    );

    if (effectiveEditable) {
      return (
        <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
          {/* Mirror — visible rendered lines, follows textarea scroll via translateY */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div ref={editableMirrorRef}>{linesContent}</div>
          </div>

          {/* Textarea — transparent text, captures input & scrolling */}
          <textarea
            ref={(el) => {
              scrollRef.current = el;
            }}
            className={cn(
              "relative z-10 h-full w-full resize-none border-0 bg-transparent pl-[3.75rem] pr-3 font-mono text-transparent caret-foreground outline-none selection:bg-primary/20",
              contentFont,
            )}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onScroll={onScroll}
            spellCheck={false}
          />
          {showDiffHighlight && (
            <ScrollbarMarks
              scrollRef={scrollRef as React.RefObject<HTMLElement>}
              contentRef={editableMirrorRef}
              selector="[data-mark]"
            />
          )}
        </div>
      );
    }

    // Readonly panel — div-based with inline gutter
    const readonlyRef = scrollRef;
    return (
      <div className="relative h-full min-h-0 min-w-0 flex-1">
        <div
          ref={(el) => {
            scrollRef.current = el;
          }}
          className="h-full cursor-default overflow-y-auto"
          onScroll={onScroll}
        >
          {linesContent}
        </div>
        {showDiffHighlight && (
          <ScrollbarMarks
            scrollRef={readonlyRef as React.RefObject<HTMLElement>}
            selector="[data-mark]"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-md border",
        className,
      )}
    >
      {/* Header — desktop: labels grid; mobile: tab switcher */}
      <div className="flex shrink-0 items-center justify-between border-b bg-muted/30 px-2 py-1 sm:px-4 sm:py-1.5">
        {/* Desktop: side-by-side labels */}
        <div className="hidden flex-1 grid-cols-2 gap-4 text-xs font-medium text-muted-foreground sm:grid">
          <span>{leftLabel || "Bản gốc"}</span>
          <span>{rightLabel || "Kết quả"}</span>
        </div>

        {/* Mobile: segmented tab switcher */}
        <div className="flex rounded-md border bg-muted/50 p-0.5 sm:hidden">
          {(
            [
              { side: "left" as const, label: leftLabel || "Bản gốc" },
              { side: "right" as const, label: rightLabel || "Kết quả" },
            ] as const
          ).map(({ side, label }) => (
            <button
              key={side}
              onClick={() => setMobilePanel(side)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-all",
                mobilePanel === side
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground active:bg-background/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {config.showDiff && diff && (
            <span className="hidden text-xs text-muted-foreground sm:block">
              {formatStats(diff.stats)}
            </span>
          )}
          <SettingsPopover config={config} onUpdate={updateConfig} />
        </div>
      </div>

      {/* Panels: desktop side-by-side OR mobile single panel.
          Only ONE layout renders to avoid duplicate refs (editableMirrorRef). */}
      {isMobile ? (
        <div className={cn("min-h-0", panelWrapperClassName)}>
          {mobilePanel === "left"
            ? renderPanel("left", leftValue, isLeftEditable)
            : renderPanel("right", rightValue, !!onChange && !isLeftEditable)}
        </div>
      ) : (
        <div className={cn("flex min-h-0", panelWrapperClassName)}>
          {renderPanel("left", leftValue, isLeftEditable)}
          <div className="w-px shrink-0 bg-border" />
          {renderPanel("right", rightValue, !!onChange && !isLeftEditable)}
        </div>
      )}
    </div>
  );
}
