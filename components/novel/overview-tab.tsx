"use client";

import { Badge } from "@/components/ui/badge";
import { EditableText } from "./editable-text";
import type { Novel } from "@/lib/db";
import { updateNovel } from "@/lib/hooks";

export function OverviewTab({
  novel,
  chapterCount,
  wordCount,
  characterCount,
}: {
  novel: Novel;
  chapterCount: number;
  wordCount: number;
  characterCount: number;
}) {
  const save = (field: string, value: unknown) => {
    updateNovel(novel.id, { [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex gap-3">
        <Badge variant="secondary">{chapterCount} chương</Badge>
        <Badge variant="secondary">{wordCount.toLocaleString()} từ</Badge>
        <Badge variant="secondary">{characterCount} nhân vật</Badge>
      </div>

      {/* Synopsis */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Tóm tắt
        </p>
        <EditableText
          value={novel.synopsis ?? ""}
          onSave={(v) => save("synopsis", v)}
          placeholder="Chưa có tóm tắt. Chạy phân tích hoặc nhấn để viết..."
          multiline
          displayClassName="text-sm leading-relaxed"
        />
      </div>
    </div>
  );
}
