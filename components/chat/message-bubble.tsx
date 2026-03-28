import { Button } from "@/components/ui/button";
import { downloadErrorTrace, getErrorTrace } from "@/lib/ai/error-trace";
import { cn } from "@/lib/utils";
import {
  AlertTriangleIcon,
  BugIcon,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  CopyIcon,
  DownloadIcon,
  LoaderIcon,
  PencilIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { useStickToBottom } from "use-stick-to-bottom";
import { chatStreamdownComponents } from "./streamdown-components";

const ERROR_MARKER = "<!-- error -->";

export function MessageBubble({
  message,
  isStreaming = false,
  onEdit,
  onRerun,
}: {
  message: { id: string; role: string; content: string; reasoning?: string };
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
  // Auto-open while streaming thinking, otherwise respect manual toggle
  const reasoningOpen =
    (isStreaming && hasReasoning && !message.content) || reasoningOpenManual;

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

  return (
    <div
      className={cn(
        "group/msg flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {isUser ? "Bạn" : "Trợ lý"}
      </span>

      {/* Reasoning / thinking block */}
      {hasReasoning && (
        <div className="max-w-[85%]">
          <button
            type="button"
            onClick={() => setReasoningOpen(!reasoningOpen)}
            className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
          >
            <LoaderIcon
              className={cn(
                "size-3",
                isStreaming && !message.content && "animate-spin",
              )}
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

      {(isUser || message.content) && (
        <div
          className={cn(
            "max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-snug",
            isUser
              ? "bg-primary text-primary-foreground"
              : isError
                ? "border border-destructive/30 bg-destructive/10 text-destructive"
                : "bg-muted text-foreground",
          )}
        >
          {isUser && editing ? (
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
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content || "\u00A0"}</p>
          ) : isError ? (
            <div className="flex gap-2">
              <AlertTriangleIcon className="mt-0.75 size-3 shrink-0" />
              <div className="min-w-0 flex-1 *:break-all">
                <Streamdown mode="static" components={chatStreamdownComponents}>
                  {displayContent}
                </Streamdown>
              </div>
            </div>
          ) : (
            <Streamdown
              mode={isStreaming ? "streaming" : "static"}
              controls={{ code: { copy: true } }}
              components={chatStreamdownComponents}
            >
              {message.content}
            </Streamdown>
          )}
        </div>
      )}

      {/* Message actions */}
      {!editing && !isStreaming && message.content && (
        <div className="flex gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Sao chép"
          >
            {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          </button>
          {isUser && onEdit && (
            <button
              type="button"
              onClick={startEdit}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Sửa tin nhắn"
            >
              <PencilIcon size={12} />
            </button>
          )}
          {isUser && onRerun && (
            <button
              type="button"
              onClick={onRerun}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Chạy lại tin nhắn"
            >
              <RefreshCwIcon size={12} />
            </button>
          )}
          {isError && getErrorTrace(message.id) && (
            <button
              type="button"
              onClick={handleDownloadTrace}
              className="flex items-center gap-1 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Tải trace log"
            >
              <DownloadIcon size={12} />
              <BugIcon size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
