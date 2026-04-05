"use client";

import { AddChapterDialog } from "@/components/add-chapter-dialog";
import { BulkAddChaptersDialog } from "@/components/bulk-add-chapters-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { HighlightedText } from "@/components/ui/highlighted-text";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Chapter } from "@/lib/db";
import { fuzzyMatch } from "@/lib/fuzzy";
import { deleteChapter, type ChapterAnalysisStatus } from "@/lib/hooks";
import { useDebouncedValue } from "@/lib/hooks/use-debounce";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BookOpenIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  ClockIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  LanguagesIcon,
  PencilIcon,
  PlusIcon,
  ReplaceAllIcon,
  SearchIcon,
  TrashIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  ChapterAnalysisStatus,
  { icon: React.ElementType; label: string; className: string }
> = {
  analyzed: {
    icon: CheckCircleIcon,
    label: "Đã phân tích",
    className: "text-green-500",
  },
  stale: {
    icon: ClockIcon,
    label: "Đã sửa đổi",
    className: "text-amber-500",
  },
  unanalyzed: {
    icon: CircleDashedIcon,
    label: "Chưa phân tích",
    className: "text-muted-foreground",
  },
};

function formatDateTime(date: Date | undefined) {
  if (!date) return null;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeFull(date: Date | undefined) {
  if (!date) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ChaptersTab({
  novelId,
  chapters,
  analysisStatuses,
  wordCounts,
  onAnalyze,
  onTranslate,
  onReplace,
  onConvert,
}: {
  novelId: string;
  chapters: Chapter[];
  analysisStatuses:
    | { chapterId: string; status: ChapterAnalysisStatus }[]
    | undefined;
  wordCounts: Map<string, number>;
  onAnalyze: (
    mode: "full" | "incremental" | "selected",
    selectedIds?: string[],
  ) => void;
  onTranslate: (chapterIds: string[]) => void;
  onReplace?: (chapterIds: string[]) => void;
  onConvert?: (chapterIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Chapter | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 350);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const statusMap = useMemo(() => {
    const map = new Map<string, ChapterAnalysisStatus>();
    if (analysisStatuses) {
      for (const s of analysisStatuses) {
        map.set(s.chapterId, s.status);
      }
    }
    return map;
  }, [analysisStatuses]);

  /** Chapters filtered by fuzzy query, with pre-computed match indices. */
  const filteredChapters = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      return chapters.map((ch) => ({ chapter: ch, indices: [] as number[] }));
    }
    const results: { chapter: Chapter; indices: number[] }[] = [];
    for (const ch of chapters) {
      const { matched, indices } = fuzzyMatch(q, ch.title);
      if (matched) results.push({ chapter: ch, indices });
    }
    return results;
  }, [chapters, debouncedQuery]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filteredChapters.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 52,
    overscan: 10,
    gap: 4,
  });

  const getStatus = (chapterId: string): ChapterAnalysisStatus =>
    statusMap.get(chapterId) ?? "unanalyzed";

  const needsAnalysisCount =
    analysisStatuses?.filter((s) => s.status !== "analyzed").length ?? 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const filteredIds = filteredChapters.map((f) => f.chapter.id);
    const allFilteredSelected = filteredIds.every((id) => selected.has(id));
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) next.delete(id);
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...filteredIds]));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteChapter(deleteTarget.id);
      toast.success("Đã xóa chương");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="max-w-full overflow-x-hidden">
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon className="size-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Thêm chương</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
          <FileTextIcon className="size-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Thêm nhiều</span>
        </Button>
        <div className="ml-auto flex gap-1.5 sm:gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={selected.size === 0}
                title={
                  selected.size === 0
                    ? "Chọn ít nhất một chương để xử lý"
                    : `Xử lý (${selected.size})`
                }
              >
                <WrenchIcon className="size-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Xử lý</span>({selected.size})
                <ChevronDownIcon className="ml-1 size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => onAnalyze("selected", Array.from(selected))}
              >
                <SearchIcon className="size-3.5" />
                Phân tích đã chọn
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => onTranslate(Array.from(selected))}
              >
                <LanguagesIcon className="size-3.5" />
                Dịch đã chọn
              </button>
              {onReplace && (
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() => onReplace(Array.from(selected))}
                >
                  <ReplaceAllIcon className="size-3.5" />
                  Thay thế đã chọn
                </button>
              )}
              {onConvert && (
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() => onConvert(Array.from(selected))}
                >
                  <GitCompareArrowsIcon className="size-3.5" />
                  Convert đã chọn
                </button>
              )}
            </PopoverContent>
          </Popover>
          {needsAnalysisCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAnalyze("incremental")}
              title={`Phân tích còn lại (${needsAnalysisCount})`}
            >
              <SearchIcon className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">
                Phân tích còn lại ({needsAnalysisCount})
              </span>
              <span className="sm:hidden">{needsAnalysisCount}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAnalyze("full")}
            title="Phân tích tất cả"
          >
            <SearchIcon className="size-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Phân tích tất cả</span>
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-3 mx-1">
        <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm chương..."
          className="h-8 pl-8 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      {/* Chapter list */}
      {chapters.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Chưa có chương nào. Thêm mới hoặc nhập tiểu thuyết.
        </p>
      ) : (
        <>
          {/* Header row — hidden on mobile since layout changes */}
          <div className="hidden min-w-0 items-center gap-2 px-3 pb-2 text-xs text-muted-foreground sm:flex">
            <Checkbox
              checked={
                filteredChapters.length > 0 &&
                filteredChapters.every((f) => selected.has(f.chapter.id))
              }
              onCheckedChange={toggleAll}
              className="size-3.5 shrink-0"
            />
            <span className="w-8 shrink-0">#</span>
            <span className="min-w-0 flex-1">Tiêu đề</span>
            <span className="w-14 shrink-0 text-right">Số từ</span>
            <span className="hidden w-20 shrink-0 text-right lg:block">
              Chỉnh sửa
            </span>
            <span className="hidden w-20 shrink-0 text-right lg:block">
              Phân tích
            </span>
            <span className="w-6 shrink-0 lg:hidden" />
            <span className="w-[4.5rem] shrink-0" />
          </div>

          {/* Virtualized chapter list */}
          <div
            ref={scrollContainerRef}
            className="h-[calc(100svh-320px)] min-h-[300px] overflow-auto"
          >
            {filteredChapters.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Không tìm thấy chương nào khớp với &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const { chapter: ch, indices } =
                    filteredChapters[virtualRow.index];
                  const status = getStatus(ch.id);
                  const statusCfg = STATUS_CONFIG[status];
                  const StatusIcon = statusCfg.icon;
                  const isExpanded = expandedId === ch.id;

                  return (
                    <div
                      key={ch.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="rounded-lg border">
                        {/* Mobile: two-line layout */}
                        <div className="sm:hidden">
                          <div
                            role="button"
                            tabIndex={0}
                            className="flex w-full cursor-pointer items-center gap-2 px-3 pt-2 pb-1 text-left"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : ch.id)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setExpandedId(isExpanded ? null : ch.id);
                              }
                            }}
                          >
                            <Checkbox
                              checked={selected.has(ch.id)}
                              onCheckedChange={() => toggleSelect(ch.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="size-3.5 shrink-0"
                            />
                            <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                              {ch.order + 1}
                            </span>
                            {isExpanded ? (
                              <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              <HighlightedText
                                text={ch.title}
                                indices={indices}
                              />
                            </span>
                          </div>
                          <div className="flex items-center gap-1 px-3 pb-1.5 pl-[3.75rem]">
                            <span className="text-xs text-muted-foreground">
                              {(wordCounts.get(ch.id) ?? 0).toLocaleString()} từ
                            </span>
                            <StatusIcon
                              className={`ml-1 size-3 ${statusCfg.className}`}
                            />
                            <div className="ml-auto flex gap-0.5">
                              <Button variant="ghost" size="icon-xs" asChild>
                                <Link
                                  href={`/novels/${novelId}/read/${ch.order + 1}`}
                                >
                                  <BookOpenIcon className="size-3.5" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon-xs" asChild>
                                <Link
                                  href={`/novels/${novelId}/chapters/${ch.id}`}
                                >
                                  <PencilIcon className="size-3.5" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDeleteTarget(ch)}
                              >
                                <TrashIcon className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Desktop: single-line layout */}
                        <div className="hidden min-w-0 items-center gap-2 px-3 py-2 sm:flex">
                          <Checkbox
                            checked={selected.has(ch.id)}
                            onCheckedChange={() => toggleSelect(ch.id)}
                            className="size-3.5 shrink-0"
                          />
                          <span className="w-8 shrink-0 text-center text-xs text-muted-foreground">
                            {ch.order + 1}
                          </span>
                          <button
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : ch.id)
                            }
                          >
                            {isExpanded ? (
                              <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate font-medium">
                              <HighlightedText
                                text={ch.title}
                                indices={indices}
                              />
                            </span>
                          </button>
                          <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                            {(wordCounts.get(ch.id) ?? 0).toLocaleString()}
                          </span>

                          {/* Edited time — only on wide screens */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground lg:block">
                                {formatDateTime(ch.updatedAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {formatDateTimeFull(ch.updatedAt)}
                            </TooltipContent>
                          </Tooltip>

                          {/* Analyzed time — only on wide screens */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`hidden w-20 shrink-0 items-center justify-end gap-1 text-xs lg:flex ${statusCfg.className}`}
                              >
                                <StatusIcon className="size-3" />
                                {ch.analyzedAt
                                  ? formatDateTime(ch.analyzedAt)
                                  : statusCfg.label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {ch.analyzedAt
                                ? `${statusCfg.label} — ${formatDateTimeFull(ch.analyzedAt)}`
                                : statusCfg.label}
                            </TooltipContent>
                          </Tooltip>

                          {/* Compact status icon when date columns are hidden */}
                          <span className="flex w-6 shrink-0 justify-end lg:hidden">
                            <StatusIcon
                              className={`size-3.5 ${statusCfg.className}`}
                            />
                          </span>
                          <div className="flex w-[4.5rem] shrink-0 justify-end gap-0.5">
                            <Button variant="ghost" size="icon-xs" asChild>
                              <Link
                                href={`/novels/${novelId}/read/${ch.order + 1}`}
                              >
                                <BookOpenIcon className="size-3.5" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon-xs" asChild>
                              <Link
                                href={`/novels/${novelId}/chapters/${ch.id}`}
                              >
                                <PencilIcon className="size-3.5" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setDeleteTarget(ch)}
                            >
                              <TrashIcon className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Collapsible summary */}
                        {isExpanded && ch.summary && (
                          <div className="border-t px-4 py-2 sm:px-10">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {ch.summary}
                            </p>
                          </div>
                        )}
                        {isExpanded && !ch.summary && (
                          <div className="border-t px-4 py-2 sm:px-10">
                            <p className="text-xs italic text-muted-foreground">
                              Chưa có tóm tắt — chạy phân tích để tạo.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <AddChapterDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        novelId={novelId}
        nextOrder={chapters.length}
      />

      <BulkAddChaptersDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        novelId={novelId}
        nextOrder={chapters.length}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa chương</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa &quot;{deleteTarget?.title}&quot; và toàn bộ nội dung?
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
    </div>
  );
}
