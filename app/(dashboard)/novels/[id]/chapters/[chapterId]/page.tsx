"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useChapter, updateChapter, useScenes, updateScene } from "@/lib/hooks";
import { ChapterToolsBar } from "@/components/chapter-tools/chapter-tools-bar";
import { ChapterToolsPanel } from "@/components/chapter-tools/chapter-tools-panel";
import { SideBySideDiff } from "@/components/chapter-tools/side-by-side-diff";
import { useChapterTools } from "@/lib/stores/chapter-tools";

export default function ChapterEditorPage() {
  const { id: novelId, chapterId } = useParams<{
    id: string;
    chapterId: string;
  }>();
  const chapter = useChapter(chapterId);
  const scenes = useScenes(chapterId);
  const scene = scenes?.[0];

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titleInit, setTitleInit] = useState(false);
  const [contentInit, setContentInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedResult, setEditedResult] = useState("");

  const activeMode = useChapterTools((s) => s.activeMode);
  const isStreaming = useChapterTools((s) => s.isStreaming);
  const completedResult = useChapterTools((s) => s.completedResult);
  const clearResult = useChapterTools((s) => s.clearResult);

  // Show diff in main area for translate/edit modes
  const showDiffInMain =
    !isStreaming &&
    !!completedResult &&
    (activeMode === "translate" || activeMode === "edit");

  useEffect(() => {
    if (chapter && !titleInit) {
      setTitle(chapter.title);
      setTitleInit(true);
    }
  }, [chapter, titleInit]);

  useEffect(() => {
    if (scene && !contentInit) {
      setContent(scene.content);
      setContentInit(true);
    }
  }, [scene, contentInit]);

  useEffect(() => {
    return () => {
      useChapterTools.getState().cancelStreaming();
    };
  }, []);

  // Sync editedResult when AI completes
  useEffect(() => {
    if (completedResult && (activeMode === "translate" || activeMode === "edit")) {
      setEditedResult(completedResult);
    }
  }, [completedResult, activeMode]);

  const isDirty =
    (titleInit && title !== chapter?.title) ||
    (contentInit && content !== scene?.content);

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  );

  const handleSave = useCallback(async () => {
    if (!chapter || !scene) return;
    setSaving(true);
    try {
      if (title !== chapter.title) {
        await updateChapter(chapterId, { title: title.trim() });
      }
      if (content !== scene.content) {
        await updateScene(scene.id, { content });
      }
      toast.success("Đã lưu");
    } catch {
      toast.error("Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }, [chapter, scene, chapterId, title, content]);

  const handleAcceptDiff = () => {
    setContent(editedResult);
    clearResult();
    toast.success(
      activeMode === "translate" ? "Đã áp dụng bản dịch" : "Đã áp dụng chỉnh sửa",
    );
  };

  if (chapter === undefined) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (!chapter) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <p className="text-muted-foreground">Không tìm thấy chương.</p>
      </main>
    );
  }

  return (
    <div className="flex h-[calc(100svh-3rem)] overflow-hidden">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sticky toolbar */}
        <div className="shrink-0 border-b bg-background px-6 py-3">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={`/novels/${novelId}`}>
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 font-heading text-lg font-semibold"
              placeholder="Tiêu đề chương"
            />
            <span className="text-xs text-muted-foreground">
              {wordCount.toLocaleString()} từ
            </span>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              <SaveIcon className="mr-1.5 size-3.5" />
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>

        {/* Main content area */}
        {showDiffInMain ? (
          <SideBySideDiff
            original={content}
            result={editedResult}
            onResultChange={setEditedResult}
            onAccept={handleAcceptDiff}
            onReject={clearResult}
            onRegenerate={() => {
              clearResult();
              // The mode component will show the action button again
            }}
          />
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="mx-auto h-full max-w-4xl px-6 py-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-full w-full resize-none rounded-lg border bg-transparent p-4 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring/50"
                placeholder="Bắt đầu viết..."
              />
            </div>
          </div>
        )}
      </main>

      <ChapterToolsBar chapterId={chapterId} />
      <ChapterToolsPanel
        content={content}
        novelId={novelId}
        chapterId={chapterId}
        chapterOrder={chapter.order}
      />
    </div>
  );
}
