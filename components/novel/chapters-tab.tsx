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
import { deleteChapter, type ChapterAnalysisStatus } from "@/lib/hooks";
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
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

  const getStatus = (chapterId: string): ChapterAnalysisStatus =>
    analysisStatuses?.find((s) => s.chapterId === chapterId)?.status ??
    "unanalyzed";

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
    if (selected.size === chapters.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(chapters.map((c) => c.id)));
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
      <div className="mb-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon className="size-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Thêm chương</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
          <FileTextIcon className="size-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Thêm nhiều</span>
        </Button>
        <div className="ml-auto flex gap-1.5 sm:gap-2">
          {selected.size > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <WrenchIcon className="size-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Xử lý</span>
                  ({selected.size})
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
          )}
          {needsAnalysisCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAnalyze("incremental")}
              title={`Phân tích còn lại (${needsAnalysisCount})`}
            >
              <SearchIcon className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Phân tích còn lại ({needsAnalysisCount})</span>
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

      {/* Chapter list */}
      {chapters.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Chưa có chương nào. Thêm mới hoặc nhập tiểu thuyết.
        </p>
      ) : (
        <div className="space-y-1">
          {/* Header row — hidden on mobile since layout changes */}
          <div className="hidden min-w-0 items-center gap-2 px-3 py-1 text-xs text-muted-foreground sm:flex">
            <Checkbox
              checked={selected.size === chapters.length && chapters.length > 0}
              onCheckedChange={toggleAll}
              className="size-3.5 shrink-0"
            />
            <span className="w-8 shrink-0">#</span>
            <span className="min-w-0 flex-1">Tiêu đề</span>
            <span className="w-14 shrink-0 text-right">Số từ</span>
            <span className="hidden w-20 shrink-0 text-right lg:block">Chỉnh sửa</span>
            <span className="hidden w-20 shrink-0 text-right lg:block">Phân tích</span>
            <span className="w-6 shrink-0 lg:hidden" />
            <span className="w-[4.5rem] shrink-0" />
          </div>

          {chapters.map((ch) => {
            const status = getStatus(ch.id);
            const statusCfg = STATUS_CONFIG[status];
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedId === ch.id;

            return (
              <div key={ch.id} className="rounded-lg border">
                {/* Mobile: two-line layout */}
                <div className="sm:hidden">
                  <button
                    className="flex w-full items-center gap-2 px-3 pt-2 pb-1 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : ch.id)}
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
                      {ch.title}
                    </span>
                  </button>
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
                          href={`/novels/${novelId}/read?chapter=${ch.order}`}
                        >
                          <BookOpenIcon className="size-3.5" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon-xs" asChild>
                        <Link href={`/novels/${novelId}/chapters/${ch.id}`}>
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
                    onClick={() => setExpandedId(isExpanded ? null : ch.id)}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-medium">{ch.title}</span>
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
                    <StatusIcon className={`size-3.5 ${statusCfg.className}`} />
                  </span>
                  <div className="flex w-[4.5rem] shrink-0 justify-end gap-0.5">
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link
                        href={`/novels/${novelId}/read?chapter=${ch.order}`}
                      >
                        <BookOpenIcon className="size-3.5" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link href={`/novels/${novelId}/chapters/${ch.id}`}>
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
            );
          })}
        </div>
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
