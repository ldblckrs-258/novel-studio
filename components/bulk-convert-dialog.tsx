"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmInterruptDialog } from "@/components/ui/confirm-interrupt-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  runBulkConvert,
  saveBulkConvertResults,
} from "@/lib/chapter-tools/bulk-convert";
import type { Chapter } from "@/lib/db";
import { useConfirmInterrupt } from "@/lib/hooks/use-confirm-interrupt";
import { useQTEngineReady } from "@/lib/hooks/use-qt-engine";
import {
  useBulkConvertStore,
  type ChapterConvertStatus,
} from "@/lib/stores/bulk-convert";
import {
  AlertTriangleIcon,
  ArrowRightLeftIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  LoaderIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const STATUS_ICONS: Record<ChapterConvertStatus, React.ReactNode> = {
  pending: <CircleDashedIcon className="text-muted-foreground size-4" />,
  converting: <LoaderIcon className="size-4 animate-spin text-blue-500" />,
  done: <CheckCircle2Icon className="size-4 text-green-500" />,
  error: <AlertTriangleIcon className="size-4 text-red-500" />,
};

export function BulkConvertDialog({
  open,
  onOpenChange,
  novelId,
  chapters,
  selectedChapterIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  chapters: Chapter[];
  selectedChapterIds?: string[];
}) {
  const engineReady = useQTEngineReady();
  const store = useBulkConvertStore();
  const [autoSave, setAutoSave] = useState(true);
  const { showConfirm, guard, confirm, dismiss } = useConfirmInterrupt(
    store.isRunning,
  );

  const chapterIds = selectedChapterIds ?? chapters.map((c) => c.id);
  const chapterMap = new Map(chapters.map((c) => [c.id, c]));

  const handleStart = useCallback(async () => {
    store.start(chapterIds);
    await runBulkConvert({
      novelId,
      chapterIds,
      autoSave,
      onChapterStart: (chapterId) => {
        store.setCurrentChapter(chapterId);
        store.setChapterStatus(chapterId, "converting");
      },
      onChapterComplete: (result) => {
        store.setChapterStatus(result.chapterId, "done");
        store.addResult(result);
        store.incrementCompleted();
        if (autoSave) store.markSaved([result.chapterId]);
      },
      onChapterError: (error) => {
        store.setChapterStatus(error.chapterId, "error");
        store.addError(error);
        store.incrementCompleted();
      },
      onAllComplete: () => {
        store.finish();
      },
    });
  }, [chapterIds, novelId, autoSave, store]);

  const handleRetry = useCallback(async () => {
    const failedIds = store.errors.map((e) => e.chapterId);
    store.startRetry(failedIds);
    await runBulkConvert({
      novelId,
      chapterIds: failedIds,
      autoSave,
      onChapterStart: (chapterId) => {
        store.setCurrentChapter(chapterId);
        store.setChapterStatus(chapterId, "converting");
      },
      onChapterComplete: (result) => {
        store.setChapterStatus(result.chapterId, "done");
        store.addResult(result);
        store.incrementCompleted();
        if (autoSave) store.markSaved([result.chapterId]);
      },
      onChapterError: (error) => {
        store.setChapterStatus(error.chapterId, "error");
        store.addError(error);
        store.incrementCompleted();
      },
      onAllComplete: () => store.finish(),
    });
  }, [novelId, autoSave, store]);

  const handleSaveAll = useCallback(async () => {
    const unsaved = Array.from(store.results.values()).filter(
      (r) => !store.savedChapterIds.has(r.chapterId),
    );
    if (!unsaved.length) return;
    try {
      const saved = await saveBulkConvertResults(unsaved, novelId);
      store.markSaved(saved);
      toast.success(`Đã lưu ${saved.length} chương`);
    } catch {
      toast.error("Lỗi khi lưu");
    }
  }, [novelId, store]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open && store.isRunning) {
        guard(() => {
          store.reset();
          onOpenChange(false);
        });
      } else if (!open) {
        store.reset();
        onOpenChange(false);
      } else {
        onOpenChange(true);
      }
    },
    [store, guard, onOpenChange],
  );

  // Reset on open
  useEffect(() => {
    if (open) store.reset();
  }, [open, store]);

  const progress =
    store.totalChapters > 0
      ? (store.chaptersCompleted / store.totalChapters) * 100
      : 0;

  const unsavedCount = Array.from(store.results.values()).filter(
    (r) => !store.savedChapterIds.has(r.chapterId),
  ).length;
  const errorCount = store.errors.length;

  return (
    <>
      <ConfirmInterruptDialog
        open={showConfirm}
        onConfirm={confirm}
        onCancel={dismiss}
      />
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convert hàng loạt</DialogTitle>
            <DialogDescription>
              Convert {chapterIds.length} chương bằng từ điển QT (không cần API
              key)
            </DialogDescription>
          </DialogHeader>

          {/* Config */}
          {store.step === "config" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-save"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                />
                <Label htmlFor="auto-save">Tự động lưu sau mỗi chương</Label>
              </div>
            </div>
          )}

          {/* Progress */}
          {store.step === "progress" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Chương {store.chaptersCompleted}/{store.totalChapters}
                </span>
              </div>
              <Progress value={progress} />
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {store.chapterIds.map((id) => {
                    const ch = chapterMap.get(id);
                    const status = store.statuses.get(id) ?? "pending";
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm"
                      >
                        {STATUS_ICONS[status]}
                        <span className="truncate">{ch?.title ?? id}</span>
                        {status === "error" && (
                          <Badge
                            variant="destructive"
                            className="ml-auto text-xs"
                          >
                            Lỗi
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Results */}
          {store.step === "results" && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-sm font-medium text-green-600">
                  Đã convert {store.results.size}/{store.totalChapters} chương
                  {errorCount > 0 && `, ${errorCount} lỗi`}
                </p>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {store.chapterIds.map((id) => {
                    const result = store.results.get(id);
                    const error = store.errors.find((e) => e.chapterId === id);
                    const isSaved = store.savedChapterIds.has(id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm"
                      >
                        {result ? (
                          <CheckCircle2Icon className="size-4 text-green-500" />
                        ) : (
                          <AlertTriangleIcon className="size-4 text-red-500" />
                        )}
                        <span className="truncate">
                          {chapterMap.get(id)?.title ?? id}
                        </span>
                        {result && (
                          <span className="text-muted-foreground ml-auto text-xs">
                            {result.originalLineCount} →{" "}
                            {result.convertedLineCount}
                          </span>
                        )}
                        {isSaved && (
                          <Badge
                            variant="outline"
                            className="text-xs text-green-600"
                          >
                            Đã lưu
                          </Badge>
                        )}
                        {error && (
                          <span className="text-xs text-red-500">
                            {error.message}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            {store.step === "config" && (
              <Button onClick={handleStart} disabled={!engineReady}>
                <ArrowRightLeftIcon className="mr-2 size-4" />
                {engineReady ? "Bắt đầu" : "Đang tải từ điển..."}
              </Button>
            )}
            {store.step === "results" && (
              <div className="flex gap-2">
                {errorCount > 0 && (
                  <Button variant="outline" onClick={handleRetry}>
                    <RotateCcwIcon className="mr-2 size-3.5" />
                    Thử lại ({errorCount})
                  </Button>
                )}
                {unsavedCount > 0 && (
                  <Button onClick={handleSaveAll}>
                    <SaveIcon className="mr-2 size-3.5" />
                    Lưu tất cả ({unsavedCount})
                  </Button>
                )}
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Đóng
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
