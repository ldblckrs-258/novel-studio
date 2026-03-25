"use client";

import { useMemo } from "react";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { computeDiff, formatStats } from "@/lib/chapter-tools/diff-utils";
import { DiffHighlight } from "./diff-highlight";

interface SideBySideDiffProps {
  original: string;
  result: string;
  onResultChange: (text: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}

export function SideBySideDiff({
  original,
  result,
  onResultChange,
  onAccept,
  onReject,
  onRegenerate,
}: SideBySideDiffProps) {
  const diff = useMemo(() => computeDiff(original, result), [original, result]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex gap-6 text-xs font-medium text-muted-foreground">
          <span>Thay đổi</span>
          <span>Kết quả (có thể chỉnh sửa)</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatStats(diff.stats)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <ScrollArea className="flex-1 border-r">
          <div className="p-4">
            <DiffHighlight changes={diff.changes} />
          </div>
        </ScrollArea>
        <div className="flex flex-1">
          <textarea
            className="flex-1 resize-none border-0 bg-transparent p-4 text-sm leading-relaxed outline-none"
            value={result}
            onChange={(e) => onResultChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          <RotateCcwIcon className="mr-1.5 size-3" />
          Tạo lại
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReject}>
            Hủy
          </Button>
          <Button size="sm" onClick={onAccept}>
            Áp dụng
          </Button>
        </div>
      </div>
    </div>
  );
}
