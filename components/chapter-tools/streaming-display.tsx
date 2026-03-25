"use client";

import { LoaderIcon, StopCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { chatStreamdownComponents } from "@/components/chat/streamdown-components";

interface StreamingDisplayProps {
  content: string;
  isStreaming: boolean;
  onCancel: () => void;
  renderAsMarkdown?: boolean;
}

export function StreamingDisplay({
  content,
  isStreaming,
  onCancel,
  renderAsMarkdown = false,
}: StreamingDisplayProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3">
        {renderAsMarkdown ? (
          <div className="prose-sm">
            <Streamdown
              mode="streaming"
              components={chatStreamdownComponents}
            >
              {content || "\u00A0"}
            </Streamdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {content}
            {isStreaming && (
              <span className="inline-block h-4 w-0.5 animate-pulse bg-primary" />
            )}
          </pre>
        )}
        {!content && isStreaming && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderIcon className="size-3 animate-spin" />
            Đang xử lý...
          </div>
        )}
      </div>

      {isStreaming && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="w-full"
        >
          <StopCircleIcon className="mr-1.5 size-3.5" />
          Hủy
        </Button>
      )}
    </div>
  );
}
