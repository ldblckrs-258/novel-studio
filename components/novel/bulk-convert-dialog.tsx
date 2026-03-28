"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LineEditor } from "@/components/ui/line-editor";
import { Progress } from "@/components/ui/progress";
import { ConvertConfig } from "@/components/convert-config";
import { db, type Chapter } from "@/lib/db";
import { useConvertSettings } from "@/lib/hooks/use-convert-settings";
import { useExcludedNamesList } from "@/lib/hooks/use-excluded-names";
import { getMergedNameDict } from "@/lib/hooks/use-name-entries";
import { convertBatch } from "@/lib/hooks/use-qt-engine";
import {
  createSceneVersion,
  ensureInitialVersion,
} from "@/lib/hooks/use-scene-versions";
import { updateScene } from "@/lib/hooks/use-scenes";
import type { ConvertOptions } from "@/lib/workers/qt-engine.types";
import {
  CheckCircle2Icon,
  Loader2Icon,
  SkipForwardIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

interface ChapterResult {
  chapterId: string;
  sceneId: string;
  title: string;
  original: string;
  output: string;
}

type ReviewStatus = "pending" | "approved" | "skipped";

export function BulkConvertDialog({
  open,
  onOpenChange,
  novelId,
  chapterIds,
  chapters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  chapterIds: string[];
  chapters: Chapter[];
}) {
  const [step, setStep] = useState<
    "config" | "processing" | "review" | "done"
  >("config");
  const [results, setResults] = useState<ChapterResult[]>([]);
  const [reviewStatuses, setReviewStatuses] = useState<
    Map<string, ReviewStatus>
  >(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  const convertOptions = useConvertSettings();
  const rejectedAutoNames = useExcludedNamesList(novelId);

  const selectedChapters = useMemo(
    () => chapters.filter((c) => chapterIds.includes(c.id)),
    [chapters, chapterIds],
  );

  const handleStart = useCallback(async () => {
    setStep("processing");
    setProcessedCount(0);
    setResults([]);

    try {
      const nameDict = await getMergedNameDict(novelId);
      const mergedOptions: ConvertOptions = {
        ...convertOptions,
        rejectedAutoNames,
      };

      const scenes = await db.scenes
        .where("[novelId+isActive]")
        .equals([novelId, 1])
        .toArray();

      const sceneMap = new Map(scenes.map((s) => [s.chapterId, s]));

      const items: Array<{ itemId: string; text: string }> = [];
      const chapterInfo = new Map<
        string,
        { title: string; sceneId: string }
      >();

      for (const ch of selectedChapters) {
        const scene = sceneMap.get(ch.id);
        if (scene?.content) {
          items.push({ itemId: ch.id, text: scene.content });
          chapterInfo.set(ch.id, { title: ch.title, sceneId: scene.id });
        }
      }

      if (items.length === 0) {
        toast.info("Không có chương nào có nội dung");
        setStep("config");
        return;
      }

      const batchResults: ChapterResult[] = [];

      await convertBatch(items, {
        novelNames: nameDict,
        options: mergedOptions,
        onProgress: (itemId, _segments, plainText) => {
          const info = chapterInfo.get(itemId);
          const originalScene = scenes.find(
            (s) => s.chapterId === itemId && s.isActive === 1,
          );
          if (info && originalScene) {
            batchResults.push({
              chapterId: itemId,
              sceneId: info.sceneId,
              title: info.title,
              original: originalScene.content,
              output: plainText,
            });
          }
          setProcessedCount((c) => c + 1);
        },
      });

      const changed = batchResults.filter((r) => r.output !== r.original);

      if (changed.length === 0) {
        toast.info("Không có thay đổi nào");
        setStep("config");
        return;
      }

      setResults(changed);
      setReviewStatuses(
        new Map(
          changed.map((r) => [r.chapterId, "pending" as ReviewStatus]),
        ),
      );
      setCurrentIndex(0);
      setStep("review");
    } catch (err) {
      console.error("Bulk convert failed:", err);
      toast.error("Lỗi khi convert hàng loạt");
      setStep("config");
    }
  }, [novelId, selectedChapters, convertOptions, rejectedAutoNames]);

  const handleApprove = useCallback(() => {
    const current = results[currentIndex];
    if (!current) return;
    setReviewStatuses((prev) => {
      const next = new Map(prev);
      next.set(current.chapterId, "approved");
      return next;
    });
    if (currentIndex < results.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [results, currentIndex]);

  const handleSkip = useCallback(() => {
    const current = results[currentIndex];
    if (!current) return;
    setReviewStatuses((prev) => {
      const next = new Map(prev);
      next.set(current.chapterId, "skipped");
      return next;
    });
    if (currentIndex < results.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [results, currentIndex]);

  const handleApproveAll = useCallback(() => {
    setReviewStatuses((prev) => {
      const next = new Map(prev);
      for (const [id, status] of next) {
        if (status === "pending") next.set(id, "approved");
      }
      return next;
    });
  }, []);

  const approvedCount = useMemo(
    () =>
      Array.from(reviewStatuses.values()).filter((s) => s === "approved")
        .length,
    [reviewStatuses],
  );
  const skippedCount = useMemo(
    () =>
      Array.from(reviewStatuses.values()).filter((s) => s === "skipped")
        .length,
    [reviewStatuses],
  );
  const pendingCount = useMemo(
    () =>
      Array.from(reviewStatuses.values()).filter((s) => s === "pending")
        .length,
    [reviewStatuses],
  );

  const handleApplyAll = useCallback(async () => {
    setIsApplying(true);
    try {
      const approved = results.filter(
        (r) => reviewStatuses.get(r.chapterId) === "approved",
      );
      for (const result of approved) {
        await ensureInitialVersion(
          result.sceneId,
          novelId,
          result.original,
        );
        await createSceneVersion(
          result.sceneId,
          novelId,
          "qt-convert",
          result.output,
        );
        await updateScene(result.sceneId, { content: result.output });
      }
      toast.success(`Đã áp dụng convert cho ${approved.length} chương`);
      setStep("done");
    } catch (err) {
      console.error("Apply failed:", err);
      toast.error("Lỗi khi áp dụng");
    } finally {
      setIsApplying(false);
    }
  }, [results, reviewStatuses, novelId]);

  const handleClose = () => {
    setStep("config");
    setResults([]);
    setReviewStatuses(new Map());
    setCurrentIndex(0);
    onOpenChange(false);
  };

  const currentResult = results[currentIndex];
  const allReviewed = pendingCount === 0 && results.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Convert hàng loạt</DialogTitle>
        </DialogHeader>

        {/* Config step */}
        {step === "config" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Convert <strong>{chapterIds.length}</strong> chương đã chọn
              bằng từ điển QT.
            </p>

            <ConvertConfig />

            <Button onClick={handleStart} className="w-full">
              Bắt đầu convert ({chapterIds.length} chương)
            </Button>
          </div>
        )}

        {/* Processing step */}
        {step === "processing" && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-2">
              <Loader2Icon className="size-5 animate-spin" />
              <span className="text-sm">
                Đang convert... {processedCount}/{chapterIds.length}
              </span>
            </div>
            <Progress value={(processedCount / chapterIds.length) * 100} />
          </div>
        )}

        {/* Review step */}
        {step === "review" && currentResult && (
          <div className="space-y-3">
            {/* Progress info */}
            <div className="flex items-center text-xs text-muted-foreground">
              <span>
                Chương {currentIndex + 1}/{results.length}:{" "}
                <strong className="text-foreground">
                  {currentResult.title}
                </strong>
              </span>
            </div>

            <LineEditor
              value={currentResult.output}
              onChange={() => {}}
              readOnly
              className="h-[50vh]"
            />

            {/* Review summary */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">
                {approvedCount} áp dụng
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {skippedCount} bỏ qua
              </span>
              <span>{pendingCount} chưa xem</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleSkip}
              >
                <SkipForwardIcon className="mr-1 size-3" />
                Bỏ qua
              </Button>
              <Button size="sm" className="flex-1" onClick={handleApprove}>
                <CheckCircle2Icon className="mr-1 size-3" />
                Áp dụng
              </Button>
            </div>

            {pendingCount > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleApproveAll}
              >
                Áp dụng tất cả còn lại ({pendingCount})
              </Button>
            )}

            {allReviewed && (
              <Button
                className="w-full"
                onClick={handleApplyAll}
                disabled={isApplying || approvedCount === 0}
              >
                {isApplying ? (
                  <>
                    <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                    Đang áp dụng...
                  </>
                ) : (
                  `Xác nhận áp dụng ${approvedCount} chương`
                )}
              </Button>
            )}
          </div>
        )}

        {/* Done step */}
        {step === "done" && (
          <>
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2Icon className="size-10 shrink-0 text-emerald-500" />
              <div>
                <p className="text-center text-xl font-serif font-bold text-emerald-500 dark:text-emerald-400">
                  Hoàn thành!
                </p>
                <p className="mt-3">
                  Đã áp dụng convert cho {approvedCount} chương, bỏ qua{" "}
                  {skippedCount} chương.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Đóng</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
