"use client";

import { stringToColor, tokenizeXml } from "@/lib/utils/string-to-color";
import { cn } from "@/lib/utils";
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
import { ScrollbarMarks } from "./scrollbar-marks";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FindHighlight {
  index: number;
  length: number;
}

interface LineEditorProps {
  /** Current text value */
  value: string;
  /** Called when text changes */
  onChange: (value: string) => void;
  /** Make the editor read-only */
  readOnly?: boolean;
  /** Placeholder shown when value is empty */
  placeholder?: string;
  /** Additional class names merged onto the root container */
  className?: string;
  /** Font-size Tailwind classes for content (default: "text-sm leading-5") */
  contentFont?: string;
  /** Font-size Tailwind classes for gutter (default: "text-xs leading-5") */
  gutterFont?: string;
  /** Highlight ranges (char index + length) rendered as marks in the mirror */
  highlights?: FindHighlight[] | null;
  /** Colorize XML-like tags using hashed hue per tag name */
  xmlColors?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const LINE_CLS = "flex";
const GUTTER_BASE =
  "w-12 shrink-0 self-stretch border-r bg-muted/30 pr-2 text-right font-mono text-muted-foreground/60 select-none";
const CONTENT_BASE =
  "min-w-0 flex-1 whitespace-pre-wrap break-words px-3 font-mono";

/* ------------------------------------------------------------------ */
/*  Rendered lines                                                     */
/* ------------------------------------------------------------------ */

/** Render a line with XML tag coloring. */
function renderXmlLine(line: string, isDark: boolean): React.ReactNode {
  if (!line) return "\u00A0";
  const tokens = tokenizeXml(line);
  if (tokens.every((t) => t.type === "text")) return line || "\u00A0";
  const colorOpts = isDark ? { s: 80, l: 72 } : { s: 70, l: 42 };
  return tokens.map((token, i) => {
    if (token.type === "text") return token.value || null;
    return (
      <span key={i} style={{ color: stringToColor(token.tagName, colorOpts) }}>
        {token.value}
      </span>
    );
  });
}

/** Build highlighted content fragments for a single line. */
function renderHighlightedLine(
  line: string,
  lineStart: number,
  highlights: FindHighlight[],
): React.ReactNode {
  // Filter highlights that overlap this line
  const lineEnd = lineStart + line.length;
  const relevant = highlights.filter(
    (h) => h.index < lineEnd && h.index + h.length > lineStart,
  );
  if (relevant.length === 0) return line || "\u00A0";

  const fragments: React.ReactNode[] = [];
  let cursor = 0;

  for (const h of relevant) {
    const start = Math.max(0, h.index - lineStart);
    const end = Math.min(line.length, h.index + h.length - lineStart);
    if (start > cursor) {
      fragments.push(line.slice(cursor, start));
    }
    fragments.push(
      <mark
        key={`${h.index}-${h.length}`}
        className="rounded-sm bg-yellow-200/80 text-inherit dark:bg-yellow-500/40"
        data-mark
      >
        {line.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < line.length) {
    fragments.push(line.slice(cursor));
  }
  return fragments.length > 0 ? fragments : "\u00A0";
}

const RenderedLines = memo(function RenderedLines({
  value,
  gutterCls,
  contentCls,
  highlights,
  xmlColors,
  isDark,
}: {
  value: string;
  gutterCls: string;
  contentCls: string;
  highlights?: FindHighlight[] | null;
  xmlColors?: boolean;
  isDark?: boolean;
}) {
  const lines = useMemo(() => value.split("\n"), [value]);

  // Pre-compute line start offsets if highlights are present
  const lineOffsets = useMemo(() => {
    if (!highlights || highlights.length === 0) return null;
    const offsets: number[] = [];
    let offset = 0;
    for (const line of lines) {
      offsets.push(offset);
      offset += line.length + 1; // +1 for \n
    }
    return offsets;
  }, [lines, highlights]);

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className={LINE_CLS}>
          <span className={gutterCls}>{i + 1}</span>
          <span className={contentCls}>
            {highlights && highlights.length > 0 && lineOffsets
              ? renderHighlightedLine(line, lineOffsets[i], highlights)
              : xmlColors
                ? renderXmlLine(line, isDark ?? false)
                : line || "\u00A0"}
          </span>
        </div>
      ))}
    </>
  );
});

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LineEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  className,
  contentFont = "text-sm leading-5",
  gutterFont = "text-xs leading-5",
  highlights,
  xmlColors,
}: LineEditorProps) {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const deferredValue = useDeferredValue(value);

  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const gutterCls = cn(GUTTER_BASE, gutterFont);
  const contentCls = cn(CONTENT_BASE, contentFont);

  /* sync mirror padding with textarea scrollbar width */
  useEffect(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror || readOnly) return;

    const sync = () => {
      const sw = textarea.offsetWidth - textarea.clientWidth;
      mirror.style.paddingRight = `${sw}px`;
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(textarea);
    return () => ro.disconnect();
  }, [readOnly]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    if (mirrorRef.current)
      mirrorRef.current.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`;
  }, []);

  // Keep mirror in sync after every render — browser may adjust scrollTop
  // without firing scroll events (content change, paste, programmatic set).
  useLayoutEffect(() => {
    if (mirrorRef.current && textareaRef.current && !readOnly)
      mirrorRef.current.style.transform = `translateY(${-textareaRef.current.scrollTop}px)`;
  });

  if (readOnly) {
    return (
      <div className={cn("overflow-y-auto rounded-md border", className)}>
        <RenderedLines
          value={value}
          gutterCls={gutterCls}
          contentCls={contentCls}
          xmlColors={xmlColors}
          isDark={isDark}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-md border", className)}
    >
      {/* Mirror — visible rendered lines with inline gutter */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div ref={mirrorRef}>
          <RenderedLines
            value={deferredValue}
            gutterCls={gutterCls}
            contentCls={contentCls}
            highlights={highlights}
            xmlColors={xmlColors}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Textarea — transparent text, captures input & scrolling */}
      <textarea
        ref={textareaRef}
        className={cn(
          "relative z-10 h-full w-full resize-none border-0 bg-transparent pl-[3.75rem] pr-3 font-mono text-transparent caret-foreground outline-none selection:bg-primary/20",
          contentFont,
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        spellCheck={false}
        readOnly={readOnly}
      />

      {highlights && highlights.length > 0 && (
        <ScrollbarMarks
          scrollRef={textareaRef}
          contentRef={mirrorRef}
          selector="[data-mark]"
        />
      )}
    </div>
  );
}
