"use client";

import { ConvertConfig } from "@/components/convert-config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useConvertSettings } from "@/lib/hooks/use-convert-settings";
import {
  getMergedNameDict,
  useMergedNameEntries,
} from "@/lib/hooks/use-name-entries";
import { convertText, useQTEngineReady } from "@/lib/hooks/use-qt-engine";
import {
  createSceneVersion,
  ensureInitialVersion,
} from "@/lib/hooks/use-scene-versions";
import { updateScene, useScenes } from "@/lib/hooks/use-scenes";
import {
  CheckCircle2Icon,
  GitCompareArrowsIcon,
  Loader2Icon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { TranslateResult } from "./translate-mode";

interface ConvertSummary {
  originalLines: number;
  convertedLines: number;
  nameCount: number;
  oldTitle: string | null;
  newTitle: string | null;
}

export function ConvertMode({
  content,
  novelId,
  chapterId,
  chapterTitle,
  onTranslated,
  onRevert,
  renderFooter,
}: {
  content: string;
  novelId: string;
  chapterId: string;
  chapterTitle: string;
  onTranslated: (result: TranslateResult) => void;
  onRevert: () => void;
  renderFooter: (node: React.ReactNode) => void;
}) {
  const [isConverting, setIsConverting] = useState(false);
  const [summary, setSummary] = useState<ConvertSummary | null>(null);
  const [useNameDict, setUseNameDict] = useState(true);
  const [convertTitle, setConvertTitle] = useState(true);
  const scenes = useScenes(chapterId);
  const mergedEntries = useMergedNameEntries(novelId);
  const engineReady = useQTEngineReady();
  const convertOptions = useConvertSettings();

  const handleConvert = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Không có nội dung để convert");
      return;
    }
    setIsConverting(true);
    setSummary(null);
    try {
      const nameDict = useNameDict
        ? await getMergedNameDict(novelId)
        : undefined;
      const result = await convertText(content, {
        novelNames: nameDict,
        options: convertOptions,
      });

      // Convert chapter title if enabled
      let newTitle: string | undefined;
      if (convertTitle && chapterTitle.trim()) {
        const titleResult = await convertText(chapterTitle, {
          novelNames: nameDict,
          options: convertOptions,
        });
        newTitle = titleResult.plainText.trim();
      }

      // Save version before overwriting
      if (scenes?.length) {
        const scene = scenes[0];
        await ensureInitialVersion(scene.id, novelId, content);
        await createSceneVersion(
          scene.id,
          novelId,
          "qt-convert",
          result.plainText,
        );
        await updateScene(scene.id, { content: result.plainText });
      }

      // Apply to textarea
      onTranslated({ content: result.plainText, title: newTitle });

      setSummary({
        originalLines: content.split("\n").length,
        convertedLines: result.plainText.split("\n").length,
        nameCount: nameDict?.length ?? 0,
        oldTitle: convertTitle ? chapterTitle : null,
        newTitle: newTitle ?? null,
      });

      toast.success("Đã convert và áp dụng");
    } catch (err) {
      console.error("Convert failed:", err);
      toast.error("Lỗi khi convert");
    } finally {
      setIsConverting(false);
    }
  }, [
    content,
    novelId,
    chapterTitle,
    convertTitle,
    useNameDict,
    scenes,
    onTranslated,
    convertOptions,
  ]);

  const handleReConvert = useCallback(() => {
    onRevert();
    setSummary(null);
  }, [onRevert]);

  // Footer
  useEffect(() => {
    if (isConverting) {
      renderFooter(null);
      return;
    }
    if (summary) {
      renderFooter(
        <Button onClick={handleReConvert} variant="outline" className="w-full">
          <GitCompareArrowsIcon className="mr-1.5 size-3.5" />
          Convert lại
        </Button>,
      );
      return;
    }
    renderFooter(
      <Button
        className="w-full"
        onClick={handleConvert}
        disabled={!content.trim() || !engineReady}
      >
        <GitCompareArrowsIcon className="mr-1.5 size-3.5" />
        {!engineReady ? "Đang tải từ điển..." : "Convert chương"}
      </Button>,
    );
    return () => renderFooter(null);
  }, [
    isConverting,
    summary,
    handleConvert,
    handleReConvert,
    renderFooter,
    content,
    engineReady,
  ]);

  const showConfig = !isConverting && !summary;

  return (
    <div className="space-y-4">
      {/* Config */}
      {showConfig && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="convert-title"
              checked={convertTitle}
              onCheckedChange={(v) => setConvertTitle(v === true)}
            />
            <Label htmlFor="convert-title" className="cursor-pointer text-xs">
              Convert tiêu đề chương
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="convert-use-name-dict"
              checked={useNameDict}
              onCheckedChange={(v) => setUseNameDict(v === true)}
            />
            <Label
              htmlFor="convert-use-name-dict"
              className="cursor-pointer text-xs"
            >
              Sử dụng từ điển tên ({(mergedEntries ?? []).length} mục)
            </Label>
          </div>
          <ConvertConfig />
        </div>
      )}

      {/* Converting indicator */}
      {isConverting && (
        <div className="flex items-center gap-2 py-4">
          <Loader2Icon className="size-4 animate-spin" />
          <span className="text-muted-foreground text-sm">Đang convert...</span>
        </div>
      )}

      {/* Summary */}
      {summary && !isConverting && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2Icon className="size-4 shrink-0" />
            <span className="text-xs font-medium">
              Đã convert và áp dụng thành công
            </span>
          </div>

          <div className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-xs">
            {summary.newTitle && (
              <div>
                <span className="text-muted-foreground">Tiêu đề: </span>
                <span className="text-muted-foreground/60 line-through">
                  {summary.oldTitle}
                </span>
                {" → "}
                <span className="font-medium">{summary.newTitle}</span>
              </div>
            )}
            <div className="text-muted-foreground">
              {summary.originalLines} dòng gốc → {summary.convertedLines} dòng
              convert
              {summary.convertedLines !== summary.originalLines && (
                <span
                  className={
                    summary.convertedLines > summary.originalLines
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }
                >
                  {" "}
                  ({summary.convertedLines > summary.originalLines ? "+" : ""}
                  {summary.convertedLines - summary.originalLines})
                </span>
              )}
            </div>
            {summary.nameCount > 0 && (
              <div className="text-muted-foreground">
                Sử dụng {summary.nameCount} mục từ điển tên
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
