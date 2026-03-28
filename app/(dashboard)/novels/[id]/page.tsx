"use client";

import { AnalysisDialog } from "@/components/analysis-dialog";
import { BulkConvertDialog } from "@/components/novel/bulk-convert-dialog";
import { BulkReplaceDialog } from "@/components/novel/bulk-replace-dialog";
import { BulkTranslateDialog } from "@/components/bulk-translate-dialog";
import { EditNovelDialog } from "@/components/edit-novel-dialog";
import { EditableText } from "@/components/novel/editable-text";
import { ChaptersTab } from "@/components/novel/chapters-tab";
import { CharactersTab } from "@/components/novel/characters-tab";
import { WorldBuildingTab } from "@/components/novel/world-building-tab";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteNovel,
  updateNovel,
  useChapterAnalysisStatus,
  useChapters,
  useCharacters,
  useNovel,
  useNovelScenes,
} from "@/lib/hooks";
import { exportNovel, downloadNovelJson } from "@/lib/novel-io";
import {
  DownloadIcon,
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type AnalysisMode = "full" | "incremental" | "selected";

export default function NovelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "chapters";
  const novel = useNovel(id);
  const chapters = useChapters(id);
  const scenes = useNovelScenes(id);
  const analysisStatuses = useChapterAnalysisStatus(id);
  const characters = useCharacters(id);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("full");
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateChapterIds, setTranslateChapterIds] = useState<string[]>([]);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceChapterIds, setReplaceChapterIds] = useState<string[]>([]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertChapterIds, setConvertChapterIds] = useState<string[]>([]);

  // Word counts
  const chapterWordCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!scenes) return map;
    for (const s of scenes) {
      map.set(s.chapterId, (map.get(s.chapterId) ?? 0) + s.wordCount);
    }
    return map;
  }, [scenes]);

  const totalWords = useMemo(
    () => scenes?.reduce((sum, s) => sum + s.wordCount, 0) ?? 0,
    [scenes],
  );

  const handleAnalyze = (mode: AnalysisMode, chapterIds?: string[]) => {
    setAnalysisMode(mode);
    setSelectedChapterIds(chapterIds ?? []);
    setAnalysisOpen(true);
  };

  const handleTranslate = (chapterIds: string[]) => {
    setTranslateChapterIds(chapterIds);
    setTranslateOpen(true);
  };

  const handleReplace = (chapterIds: string[]) => {
    setReplaceChapterIds(chapterIds);
    setReplaceOpen(true);
  };

  const handleConvert = (chapterIds: string[]) => {
    setConvertChapterIds(chapterIds);
    setConvertOpen(true);
  };

  const handleExport = async () => {
    if (!novel) return;
    try {
      const data = await exportNovel(novel.id);
      downloadNovelJson(data);
      toast.success(`Đã xuất "${novel.title}"`);
    } catch {
      toast.error("Xuất tiểu thuyết thất bại");
    }
  };

  const handleDelete = async () => {
    if (!novel) return;
    try {
      await deleteNovel(novel.id);
      toast.success(`Đã xóa "${novel.title}"`);
      router.push("/library");
    } catch {
      toast.error("Xóa tiểu thuyết thất bại");
    }
  };

  // Loading
  if (novel === undefined) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-4 h-4 w-96" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (!novel) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <p className="text-muted-foreground">Không tìm thấy tiểu thuyết.</p>
      </main>
    );
  }

  const needsAnalysisCount =
    analysisStatuses?.filter((s) => s.status !== "analyzed").length ?? 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              {novel.color && (
                <div
                  className="mt-1 size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: novel.color }}
                />
              )}
              <h1 className="font-heading text-3xl font-bold tracking-tight">
                {novel.title}
              </h1>
            </div>

            {/* Meta line */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {novel.author && <span>{novel.author}</span>}
              {novel.sourceUrl && novel.author && (
                <span className="text-muted-foreground/40">·</span>
              )}
              {novel.sourceUrl && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <a
                    href={novel.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Truyện gốc
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </>
              )}
            </div>

            {novel.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {novel.description}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditOpen(true)}
                >
                  <PencilIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chỉnh sửa</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleExport}>
                  <DownloadIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Xuất file</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Xóa</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Synopsis */}
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Tóm tắt
          </p>
          <EditableText
            value={novel.synopsis ?? ""}
            onSave={(v) => updateNovel(novel.id, { synopsis: v })}
            placeholder="Chưa có tóm tắt. Chạy phân tích hoặc nhấn để viết..."
            multiline
            displayClassName="text-sm leading-relaxed"
          />
        </div>

        {/* Stats + Genres + Tags */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{chapters?.length ?? 0} chương</Badge>
          <Badge variant="outline">{totalWords.toLocaleString()} từ</Badge>
          <Badge variant="outline">{characters?.length ?? 0} nhân vật</Badge>
          {novel.genres?.map((g: string) => (
            <Badge key={g} variant="default">
              {g}
            </Badge>
          ))}
          {novel.tags?.map((t: string) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams.toString());
          if (value === "chapters") {
            params.delete("tab");
          } else {
            params.set("tab", value);
          }
          const query = params.toString();
          router.replace(`${pathname}${query ? `?${query}` : ""}`, {
            scroll: false,
          });
        }}
      >
        <TabsList className="w-full justify-center">
          <TabsTrigger value="chapters">
            Chương
            {chapters && chapters.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({chapters.length})
              </span>
            )}
            {needsAnalysisCount > 0 && (
              <span className="inline-flex size-2 rounded-full bg-amber-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="world-building">Thế giới quan</TabsTrigger>
          <TabsTrigger value="characters">
            Nhân vật
            {characters && characters.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({characters.length})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="world-building" className="mt-4">
          <WorldBuildingTab novel={novel} />
        </TabsContent>

        <TabsContent value="characters" className="mt-4">
          <CharactersTab characters={characters ?? []} novelId={id} />
        </TabsContent>

        <TabsContent value="chapters" className="mt-4">
          <ChaptersTab
            novelId={id}
            chapters={chapters ?? []}
            analysisStatuses={analysisStatuses}
            wordCounts={chapterWordCounts}
            onAnalyze={handleAnalyze}
            onTranslate={handleTranslate}
            onReplace={handleReplace}
            onConvert={handleConvert}
          />
        </TabsContent>
      </Tabs>

      {/* Bulk translate dialog */}
      <BulkTranslateDialog
        open={translateOpen}
        onOpenChange={setTranslateOpen}
        novelId={id}
        selectedChapterIds={translateChapterIds}
        chapters={chapters ?? []}
      />

      {/* Bulk replace dialog */}
      <BulkReplaceDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        novelId={id}
        chapterIds={replaceChapterIds}
        chapters={chapters ?? []}
      />

      {/* Bulk convert dialog */}
      <BulkConvertDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        novelId={id}
        chapterIds={convertChapterIds}
        chapters={chapters ?? []}
      />

      {/* Analysis dialog */}
      <AnalysisDialog
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        novelId={id}
        mode={analysisMode}
        selectedChapterIds={
          analysisMode === "selected" ? selectedChapterIds : undefined
        }
        totalChapters={chapters?.length ?? 0}
      />

      {/* Edit dialog */}
      <EditNovelDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        novel={novel}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tiểu thuyết?</AlertDialogTitle>
            <AlertDialogDescription>
              Tiểu thuyết <strong>&ldquo;{novel.title}&rdquo;</strong> cùng toàn
              bộ chương, cảnh, nhân vật và ghi chú sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
