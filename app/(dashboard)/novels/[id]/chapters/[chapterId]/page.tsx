"use client";

import { ChapterToolsBar } from "@/components/chapter-tools/chapter-tools-bar";
import { ChapterToolsPanel } from "@/components/chapter-tools/chapter-tools-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmInterruptDialog } from "@/components/ui/confirm-interrupt-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { LineEditor } from "@/components/ui/line-editor";
import { TextCompareEditor } from "@/components/ui/text-compare-editor";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VersionHistoryDialog } from "@/components/version-history-dialog";
import { VersionLimitDialog } from "@/components/version-limit-dialog";
import {
  createSceneVersion,
  ensureInitialVersion,
  updateChapter,
  updateScene,
  useChapter,
  useConfirmInterrupt,
  useHistoryState,
  useNavigationGuard,
  useScenes,
} from "@/lib/hooks";
import {
  useChapterTools,
  type ChapterToolMode,
} from "@/lib/stores/chapter-tools";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronDownIcon,
  HistoryIcon,
  Redo2Icon,
  RotateCcwIcon,
  SaveIcon,
  Undo2Icon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const isMac =
  typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const modSymbol = isMac ? "⌘" : "Ctrl+";

export default function ChapterEditorPage() {
  const { id: novelId, chapterId } = useParams<{
    id: string;
    chapterId: string;
  }>();
  const chapter = useChapter(chapterId);
  const scenes = useScenes(chapterId);
  const scene = scenes?.[0];

  // Undo/redo history for title + content
  const {
    title,
    content,
    setTitle,
    setContent,
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistoryState(chapter?.title ?? "", scene?.content ?? "", {
    capacity: 50,
    debounceMs: 500,
  });

  const [saving, setSaving] = useState(false);
  const [editedResult, setEditedResult] = useState("");
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const activeMode = useChapterTools((s) => s.activeMode);
  const isStreaming = useChapterTools((s) => s.isStreaming);
  const completedResult = useChapterTools((s) => s.completedResult);
  const clearResult = useChapterTools((s) => s.clearResult);
  const findHighlights = useChapterTools((s) => s.findHighlights);

  // Show diff in main area for edit and replace modes
  const showDiffInMain =
    !isStreaming &&
    !!completedResult &&
    (activeMode === "edit" || activeMode === "replace");

  useEffect(() => {
    return () => {
      useChapterTools.getState().cancelStreaming();
      useChapterTools.getState().setActiveMode(null);
    };
  }, []);

  // Sync editedResult when AI/replace completes
  useEffect(() => {
    if (
      completedResult &&
      (activeMode === "edit" || activeMode === "replace")
    ) {
      setEditedResult(completedResult);
    }
  }, [completedResult, activeMode]);

  const isDirty =
    title !== (chapter?.title ?? "") || content !== (scene?.content ?? "");

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  );

  // Navigation guard: intercepts all <a> clicks + tab close when dirty
  const navGuard = useNavigationGuard(isDirty);

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

  const handleSaveAsVersion = useCallback(async () => {
    if (!chapter || !scene) return;
    setSaving(true);
    try {
      if (title !== chapter.title) {
        await updateChapter(chapterId, { title: title.trim() });
      }
      if (content !== scene.content) {
        // Bootstrap v1 (manual) with original DB content if no versions exist
        await ensureInitialVersion(scene.id, scene.novelId, scene.content);
        // Save the NEW content as a version
        const versionType =
          useChapterTools.getState().pendingVersionType ?? "manual";
        const versionId = await createSceneVersion(
          scene.id,
          scene.novelId,
          versionType,
          content,
        );
        if (versionId === null) {
          setShowLimitDialog(true);
          setSaving(false);
          return;
        }
        useChapterTools.getState().setPendingVersionType(null);
        await updateScene(scene.id, { content });
      }
      toast.success("Đã lưu phiên bản mới");
    } catch {
      toast.error("Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }, [chapter, scene, chapterId, title, content]);

  const handleRetryAfterLimitFreed = useCallback(async () => {
    if (!chapter || !scene) return;
    setSaving(true);
    try {
      if (title !== chapter.title) {
        await updateChapter(chapterId, { title: title.trim() });
      }
      if (content !== scene.content) {
        const versionType =
          useChapterTools.getState().pendingVersionType ?? "manual";
        useChapterTools.getState().setPendingVersionType(null);
        await createSceneVersion(scene.id, scene.novelId, versionType, content);
        await updateScene(scene.id, { content });
      }
      toast.success("Đã lưu phiên bản mới");
    } catch {
      toast.error("Lưu thất bại");
    } finally {
      setSaving(false);
      setShowLimitDialog(false);
    }
  }, [chapter, scene, chapterId, title, content]);

  const handleAcceptDiff = () => {
    pushSnapshot({ content: editedResult, title });
    const versionType =
      useChapterTools.getState().pendingVersionType ?? "ai-edit";
    useChapterTools.getState().setPendingVersionType(versionType);
    clearResult();
    toast.success(
      activeMode === "replace" ? "Đã áp dụng thay thế" : "Đã áp dụng chỉnh sửa",
    );
  };

  // Guard for chapter tools interruption
  const { showConfirm, guard, confirm, dismiss } =
    useConfirmInterrupt(isStreaming);

  const handleToggleMode = useCallback(
    (mode: ChapterToolMode) => {
      const current = useChapterTools.getState().activeMode;
      const target = current === mode ? null : mode;
      guard(() => {
        useChapterTools.getState().cancelStreaming();
        useChapterTools.getState().setActiveMode(target);
      });
    },
    [guard],
  );

  const handleClosePanel = useCallback(() => {
    guard(() => {
      useChapterTools.getState().cancelStreaming();
      useChapterTools.getState().setActiveMode(null);
    });
  }, [guard]);

  const handleTranslated = useCallback(
    (result: { content: string; title?: string }) => {
      pushSnapshot({ content: result.content, title: result.title ?? title });
      useChapterTools.getState().setPendingVersionType("ai-translate");
    },
    [pushSnapshot, title],
  );

  const handleRevertTranslation = useCallback(() => {
    undo();
    useChapterTools.getState().setPendingVersionType(null);
  }, [undo]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Ctrl+S
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "s") {
        e.preventDefault();
        handleSaveRef.current();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

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
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/novels/${novelId}`}>
                <ArrowLeftIcon className="size-4" />
                Trở lại
              </Link>
            </Button>
            <Button variant="ghost" size="icon-sm" asChild title="Chế độ đọc">
              <Link href={`/novels/${novelId}/read/${chapter.order + 1}`}>
                <BookOpenIcon className="size-4" />
              </Link>
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={undo}
                    disabled={!canUndo}
                    aria-label="Hoàn tác"
                  >
                    <Undo2Icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Hoàn tác <Kbd>{modSymbol}Z</Kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={redo}
                    disabled={!canRedo}
                    aria-label="Làm lại"
                  >
                    <Redo2Icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Làm lại <Kbd>{modSymbol}⇧Z</Kbd>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowHistory(true)}
              title="Lịch sử phiên bản"
            >
              <HistoryIcon className="size-4" />
            </Button>
            <div className="flex items-center">
              <Button
                size="sm"
                className="rounded-r-none"
                onClick={handleSave}
                disabled={!isDirty || saving}
              >
                <SaveIcon className="mr-1.5 size-3.5" />
                {saving ? "Đang lưu..." : "Lưu"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="rounded-l-none px-1.5"
                    disabled={!isDirty || saving}
                  >
                    <ChevronDownIcon className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <DropdownMenuItem onClick={handleSaveAsVersion}>
                    Lưu phiên bản mới
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main content area */}
        {showDiffInMain ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TextCompareEditor
              leftValue={content}
              rightValue={editedResult}
              onChange={setEditedResult}
              editableSide="right"
              showDiff
              storageKey="chapter-diff"
              leftLabel="Bản gốc"
              rightLabel="Kết quả (chỉnh sửa)"
              className="min-h-0 flex-1 rounded-none border-x-0 border-t-0"
              panelWrapperClassName="min-h-0 flex-1"
            />
            <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
              {activeMode === "edit" ? (
                <Button variant="ghost" size="sm" onClick={() => clearResult()}>
                  <RotateCcwIcon className="mr-1.5 size-3" />
                  Tạo lại
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearResult}>
                  Hủy
                </Button>
                <Button size="sm" onClick={handleAcceptDiff}>
                  Áp dụng
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="mx-auto h-full max-w-4xl px-6 py-4">
              <LineEditor
                value={content}
                onChange={setContent}
                placeholder="Bắt đầu viết..."
                className="h-full"
                highlights={activeMode === "replace" ? findHighlights : null}
              />
            </div>
          </div>
        )}
      </main>

      <ChapterToolsBar chapterId={chapterId} onToggleMode={handleToggleMode} />
      <ChapterToolsPanel
        content={content}
        novelId={novelId}
        chapterId={chapterId}
        chapterOrder={chapter.order}
        chapterTitle={chapter.title}
        onTranslated={handleTranslated}
        onRevertTranslation={handleRevertTranslation}
        onClose={handleClosePanel}
      />
      <ConfirmInterruptDialog
        open={showConfirm}
        onConfirm={confirm}
        onCancel={dismiss}
      />

      {/* Unsaved changes navigation guard */}
      <AlertDialog
        open={navGuard.showDialog}
        onOpenChange={(v) => {
          if (!v) navGuard.cancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thay đổi chưa được lưu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có thay đổi chưa lưu. Nếu rời đi, các thay đổi sẽ bị mất.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={navGuard.cancel}>
              Ở lại
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={navGuard.confirm}>
              Rời đi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scene && showHistory && (
        <VersionHistoryDialog
          open={showHistory}
          onOpenChange={setShowHistory}
          sceneId={scene.id}
          novelId={scene.novelId}
          currentContent={content}
          onRevert={(newContent) => {
            pushSnapshot({ content: newContent, title });
            setShowHistory(false);
          }}
        />
      )}
      {scene && showLimitDialog && (
        <VersionLimitDialog
          open={showLimitDialog}
          onOpenChange={setShowLimitDialog}
          sceneId={scene.id}
          onSpaceFreed={handleRetryAfterLimitFreed}
        />
      )}
    </div>
  );
}
