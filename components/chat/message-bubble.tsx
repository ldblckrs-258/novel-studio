import { Button } from "@/components/ui/button";
import { downloadErrorTrace, getErrorTrace } from "@/lib/ai/error-trace";
import type { ChatFile, ChatImage, ChatToolCall, MessagePart } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  AlertTriangleIcon,
  BookSearchIcon,
  BugIcon,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { useStickToBottom } from "use-stick-to-bottom";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { BrainIcon } from "../ui/brain";
import { WrenchIcon } from "../ui/wrench";
import { chatStreamdownComponents } from "./streamdown-components";

const TOOL_LABELS: Record<string, string> = {
  updateNovelSynopsis: "Cập nhật tóm tắt",
  updateGenresTags: "Cập nhật thể loại & nhãn",
  updateWorldBuilding: "Cập nhật thế giới quan",
  addFaction: "Thêm phe phái",
  updateFaction: "Cập nhật phe phái",
  addLocation: "Thêm địa điểm",
  updateLocation: "Cập nhật địa điểm",
  addCharacter: "Thêm nhân vật",
  updateCharacter: "Cập nhật nhân vật",
  addRelationship: "Thêm mối quan hệ",
  getNovelOverview: "Tra cứu tổng quan tiểu thuyết",
  getWorldBuilding: "Tra cứu thế giới quan",
  getChapterDetails: "Tra cứu chi tiết chương",
  getChapterContent: "Đọc nội dung chương",
  getCharacters: "Tra cứu nhân vật",
  getNovelNotes: "Tra cứu ghi chú",
  searchNovelContent: "Tìm kiếm nội dung",
};

const ERROR_MARKER = "<!-- error -->";

function formatResultPreview(result: unknown): string {
  if (result == null) return "...";
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function ToolCallItem({
  toolCall,
  noCollapse,
}: {
  toolCall: ChatToolCall;
  noCollapse?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[toolCall.toolName] ?? toolCall.toolName;
  const hasArgs = Object.keys(toolCall.args).length > 0;
  const isEditTool =
    toolCall.toolName.startsWith("update") ||
    toolCall.toolName.startsWith("add");

  return (
    <div className="rounded-md border border-border/40 bg-background/50 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left hover:bg-muted/50"
      >
        {isEditTool ? (
          <PencilIcon className="size-3 shrink-0" />
        ) : (
          <BookSearchIcon className="size-3 shrink-0" />
        )}
        <span className="flex-1 truncate font-medium">{label}</span>
        {noCollapse ? null : open ? (
          <ChevronUp size={10} />
        ) : (
          <ChevronDown size={10} />
        )}
      </button>
      {open || noCollapse ? (
        <div className="border-t border-border/40 px-2 py-1.5 overflow-auto">
          {hasArgs && (
            <div className="mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Tham số
              </span>
              <pre className="mt-0.5 whitespace-pre-wrap break-all text-[10px] leading-relaxed">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Kết quả
            </span>
            <pre className="mt-0.5 max-h-48 whitespace-pre-wrap break-all text-[10px] leading-relaxed">
              {formatResultPreview(toolCall.result)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Collapsible group of tool calls */
function ToolCallsGroup({
  toolCalls,
  isStreaming,
  hasContentAfter,
}: {
  toolCalls: ChatToolCall[];
  isStreaming: boolean;
  hasContentAfter: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isLoading = isStreaming && !hasContentAfter;

  return (
    <div className="max-w-[85%]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-0.5 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
      >
        <WrenchIcon autoAnimate={isLoading} className="size-3" />
        {isLoading
          ? "Đang tra cứu..."
          : `Đã sử dụng ${toolCalls.length} công cụ`}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="mb-1 space-y-1 ml-4">
          {toolCalls.map((tc, i) => (
            <ToolCallItem
              key={i}
              toolCall={tc}
              noCollapse={toolCalls.length <= 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({
  message,
  isStreaming = false,
  onEdit,
  onRerun,
}: {
  message: {
    id: string;
    role: string;
    content: string;
    reasoning?: string;
    parts?: MessagePart[];
    images?: ChatImage[];
    files?: ChatFile[];
  };
  isStreaming?: boolean;
  onEdit?: (newContent: string) => void;
  onRerun?: () => void;
}) {
  const isUser = message.role === "user";
  const isError = !isUser && message.content.startsWith(ERROR_MARKER);
  const displayContent = isError
    ? message.content.slice(ERROR_MARKER.length).trimStart()
    : message.content;
  const [reasoningOpenManual, setReasoningOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const { scrollRef: reasoningScrollRef, contentRef: reasoningContentRef } =
    useStickToBottom();
  const hasReasoning = !!message.reasoning;
  const hasParts = !!message.parts?.length;
  // Auto-open while streaming (stays open through tool calls), manual toggle after
  const reasoningOpen = (isStreaming && hasReasoning) || reasoningOpenManual;

  function startEdit() {
    setEditText(message.content);
    setEditing(true);
  }

  function confirmEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(trimmed);
    }
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      confirmEdit();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  }

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const plain = isError ? displayContent : message.content;
    navigator.clipboard.writeText(plain).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleDownloadTrace() {
    const trace = getErrorTrace(message.id);
    if (trace) {
      downloadErrorTrace(trace);
    }
  }

  /** Render assistant content as a text bubble */
  const renderTextBubble = (text: string, streaming: boolean, key?: string) => {
    if (!text) return null;
    return (
      <div
        key={key}
        className={cn(
          "max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-relaxed",
          isError
            ? "border border-destructive/30 bg-destructive/10 text-destructive"
            : "bg-muted/70 text-foreground",
        )}
      >
        {isError ? (
          <div className="flex gap-2">
            <AlertTriangleIcon className="mt-0.75 size-3 shrink-0" />
            <div className="min-w-0 flex-1 *:break-all">
              <Streamdown mode="static" components={chatStreamdownComponents}>
                {text}
              </Streamdown>
            </div>
          </div>
        ) : (
          <Streamdown
            mode={streaming ? "streaming" : "static"}
            controls={{ code: { copy: true } }}
            components={chatStreamdownComponents}
          >
            {text}
          </Streamdown>
        )}
      </div>
    );
  };

  /** Render interleaved parts (text + tool-calls in order) */
  const renderParts = () => {
    if (!message.parts?.length) return null;

    return message.parts.map((part, idx) => {
      if (part.type === "tool-calls") {
        // Check if there's text content after this tool-calls group
        const hasContentAfter = message
          .parts!.slice(idx + 1)
          .some((p) => p.type === "text" && p.content.trim());

        return (
          <ToolCallsGroup
            key={`tc-${idx}`}
            toolCalls={part.toolCalls}
            isStreaming={isStreaming}
            hasContentAfter={hasContentAfter}
          />
        );
      }

      // Text part — render as bubble
      if (!part.content.trim()) return null;

      // Check if this is the last text part (for streaming mode)
      const isLastTextPart = !message
        .parts!.slice(idx + 1)
        .some((p) => p.type === "text");

      return renderTextBubble(
        isError
          ? part.content.replace(ERROR_MARKER, "").trimStart()
          : part.content,
        isStreaming && isLastTextPart,
        `text-${idx}`,
      );
    });
  };

  return (
    <div
      className={cn(
        "group/msg flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div className="flex items-center gap-1.5">
        {!isUser && (
          <SparklesIcon className="size-2.5 text-muted-foreground/50" />
        )}
        <span className="text-[10px] font-medium text-muted-foreground/60">
          {isUser ? "Bạn" : "Trợ lý"}
        </span>
      </div>

      {/* Reasoning / thinking block */}
      {hasReasoning && (
        <div className="max-w-[85%]">
          <button
            type="button"
            onClick={() => setReasoningOpen(!reasoningOpen)}
            className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
          >
            <BrainIcon
              autoAnimate={isStreaming && !message.content}
              className="size-3"
            />
            {isStreaming && !message.content
              ? "Đang suy nghĩ..."
              : "Đã suy nghĩ một lúc"}
            {reasoningOpen ? (
              <ChevronUp size={12} />
            ) : (
              <ChevronDown size={12} />
            )}
          </button>
          {reasoningOpen && (
            <div
              ref={reasoningScrollRef}
              className="mb-2 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground"
            >
              <div ref={reasoningContentRef}>
                <Streamdown
                  mode={isStreaming ? "streaming" : "static"}
                  components={chatStreamdownComponents}
                >
                  {message.reasoning}
                </Streamdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interleaved content: parts (text + tool-calls) or fallback */}
      {isUser ? (
        <>
          {/* Image grid */}
          {message.images && message.images.length > 0 && (
            <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
              {message.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setLightboxIndex(i);
                    setLightboxOpen(true);
                  }}
                  className="overflow-hidden rounded-lg border border-white/10 transition-opacity hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt={img.name ?? `Ảnh ${i + 1}`}
                    className="max-h-40 max-w-40 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          {/* File chips */}
          {message.files && message.files.length > 0 && (
            <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
              {message.files.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-primary/80 px-2.5 py-1.5"
                  title={`${file.name} · ${(file.size / 1024).toFixed(0)} KB`}
                >
                  <FileTextIcon className="size-3 shrink-0 text-primary-foreground/70" />
                  <span className="max-w-[120px] truncate text-[11px] font-medium text-primary-foreground">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-primary-foreground/50">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Lightbox */}
          {message.images && message.images.length > 0 && (
            <Lightbox
              open={lightboxOpen}
              close={() => setLightboxOpen(false)}
              index={lightboxIndex}
              slides={message.images.map((img) => ({ src: img.dataUrl }))}
            />
          )}
          {/* Text bubble */}
          {(editing || !!message.content) && (
            <div
              className={cn(
                "max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[13px] leading-relaxed",
                "bg-primary text-primary-foreground shadow-sm",
              )}
            >
              {editing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="field-sizing-content max-h-32 min-h-8 w-full resize-none rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-1.5 text-[13px] text-primary-foreground outline-none placeholder:text-primary-foreground/50"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={cancelEdit}
                      className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    >
                      <XIcon />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={confirmEdit}
                      className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    >
                      <CheckIcon />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          )}
        </>
      ) : hasParts ? (
        /* Render ordered parts: text ↔ tool-calls interleaved */
        renderParts()
      ) : (
        /* Fallback: legacy messages without parts */
        message.content && renderTextBubble(displayContent, isStreaming)
      )}

      {/* Message actions */}
      {!editing &&
        !isStreaming &&
        (message.content ||
          (isUser &&
            (!!message.images?.length || !!message.files?.length))) && (
          <div className="flex gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
            <button
              type="button"
              onClick={handleCopy}
              className="flex size-6 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              title="Sao chép"
            >
              {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
            </button>
            {isUser && onEdit && (
              <button
                type="button"
                onClick={startEdit}
                className="flex size-6 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                title="Sửa tin nhắn"
              >
                <PencilIcon size={11} />
              </button>
            )}
            {isUser && onRerun && (
              <button
                type="button"
                onClick={onRerun}
                className="flex size-6 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                title="Chạy lại tin nhắn"
              >
                <RefreshCwIcon size={11} />
              </button>
            )}
            {isError && getErrorTrace(message.id) && (
              <button
                type="button"
                onClick={handleDownloadTrace}
                className="flex size-6 items-center justify-center gap-0.5 rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                title="Tải trace log"
              >
                <DownloadIcon size={11} />
                <BugIcon size={11} />
              </button>
            )}
          </div>
        )}
    </div>
  );
}
