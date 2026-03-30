"use client";

import { CreateNovelDialog } from "@/components/create-novel-dialog";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Novel } from "@/lib/db";
import { deleteNovel, useNovels } from "@/lib/hooks";
import { downloadNovelJson, exportNovel, importNovel } from "@/lib/novel-io";
import {
  BookOpenIcon,
  DownloadIcon,
  GridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type SortField = "updatedAt" | "createdAt" | "title";
type SortDirection = "asc" | "desc";
type ViewMode = "grid" | "list";

const ITEMS_PER_PAGE = 12;

const SORT_OPTIONS: {
  value: `${SortField}-${SortDirection}`;
  label: string;
}[] = [
  { value: "updatedAt-desc", label: "Cập nhật gần nhất" },
  { value: "updatedAt-asc", label: "Cập nhật cũ nhất" },
  { value: "createdAt-desc", label: "Mới tạo nhất" },
  { value: "createdAt-asc", label: "Cũ nhất" },
  { value: "title-asc", label: "Tên A → Z" },
  { value: "title-desc", label: "Tên Z → A" },
];

function sortNovels(
  novels: Novel[],
  field: SortField,
  direction: SortDirection,
) {
  return [...novels].sort((a, b) => {
    let cmp: number;
    if (field === "title") {
      cmp = a.title.localeCompare(b.title, "vi");
    } else {
      cmp = a[field].getTime() - b[field].getTime();
    }
    return direction === "asc" ? cmp : -cmp;
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LibraryPage() {
  const novels = useNovels();
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] =
    useState<`${SortField}-${SortDirection}`>("updatedAt-desc");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Novel | null>(null);

  const genres = useMemo(() => {
    if (!novels) return [];
    const set = new Set<string>();
    for (const n of novels) {
      if (n.genre) set.add(n.genre);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [novels]);

  const filtered = useMemo(() => {
    if (!novels) return [];

    let result = novels;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q),
      );
    }

    if (genreFilter !== "all") {
      result = result.filter((n) => n.genre === genreFilter);
    }

    const [field, direction] = sort.split("-") as [SortField, SortDirection];
    result = sortNovels(result, field, direction);

    return result;
  }, [novels, search, genreFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const handleGenre = (value: string) => {
    setGenreFilter(value);
    setPage(1);
  };
  const handleSort = (value: string) => {
    setSort(value as `${SortField}-${SortDirection}`);
    setPage(1);
  };

  const handleExport = useCallback(async (novel: Novel) => {
    try {
      const data = await exportNovel(novel.id);
      downloadNovelJson(data);
      toast.success(`Đã xuất "${novel.title}"`);
    } catch {
      toast.error("Xuất tiểu thuyết thất bại.");
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteNovel(deleteTarget.id);
      toast.success(`Đã xóa "${deleteTarget.title}"`);
    } catch {
      toast.error("Xóa tiểu thuyết thất bại.");
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset so the same file can be re-selected
      e.target.value = "";
      try {
        await importNovel(file);
        toast.success("Đã nhập tiểu thuyết thành công!");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Nhập tiểu thuyết thất bại.",
        );
      }
    },
    [],
  );

  // Loading state
  if (novels === undefined) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="mb-6 flex gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-44" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex sm:items-end justify-between gap-4 flex-col sm:flex-row">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Thư viện
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {novels.length} tiểu thuyết
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => importInputRef.current?.click()}
          >
            <UploadIcon className="size-4" />
            Nhập sách
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Tạo mới
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm tiểu thuyết..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 pr-8"
          />
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        {genres.length > 0 && (
          <Select value={genreFilter} onValueChange={handleGenre}>
            <SelectTrigger>
              <SelectValue placeholder="Thể loại" />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value="all">Tất cả thể loại</SelectItem>
              {genres.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={sort} onValueChange={handleSort}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as ViewMode)}
          variant="outline"
          size="sm"
          className="ml-auto"
        >
          <ToggleGroupItem value="grid" aria-label="Dạng lưới">
            <GridIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Dạng danh sách">
            <ListIcon className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Empty states */}
      {novels.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpenIcon />
                </EmptyMedia>
                <EmptyTitle>Thư viện trống</EmptyTitle>
                <EmptyDescription>
                  Tạo tiểu thuyết đầu tiên hoặc nhập từ nguồn có sẵn.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>Không tìm thấy kết quả</EmptyTitle>
                <EmptyDescription>
                  Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grid view */}
          {view === "grid" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginated.map((novel) => (
                <Card
                  key={novel.id}
                  className="relative group cursor-pointer h-full overflow-hidden transition-colors hover:bg-muted/30"
                  onClick={() => router.push(`/novels/${novel.id}`)}
                >
                  {novel.color && (
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: novel.color }}
                    />
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-1">
                        {novel.title}
                      </CardTitle>
                      <NovelActions
                        novel={novel}
                        onExport={handleExport}
                        onDelete={setDeleteTarget}
                      />
                    </div>
                    {novel.author && (
                      <CardDescription>{novel.author}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {novel.genres && novel.genres.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {novel.genres.slice(0, 3).map((g) => (
                          <Badge
                            key={g}
                            variant="secondary"
                            className="text-[11px]"
                          >
                            {g}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {novel.description || "Chưa có mô tả."}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground/60">
                      Cập nhật {formatDate(novel.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* List view */}
          {view === "list" && (
            <div className="flex flex-col gap-2">
              {paginated.map((novel) => (
                <Card
                  key={novel.id}
                  className="group cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => router.push(`/novels/${novel.id}`)}
                >
                  <CardContent className="flex items-center gap-4 py-3">
                    {novel.color && (
                      <div
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: novel.color }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {novel.title}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {novel.description || "Chưa có mô tả."}
                      </p>
                    </div>
                    {novel.genres && novel.genres.length > 0 && (
                      <div className="flex shrink-0 gap-1">
                        {novel.genres.slice(0, 3).map((g) => (
                          <Badge
                            key={g}
                            variant="secondary"
                            className="text-[11px]"
                          >
                            {g}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground/60">
                      {formatDate(novel.updatedAt)}
                    </span>
                    <NovelActions
                      novel={novel}
                      onExport={handleExport}
                      onDelete={setDeleteTarget}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} /{" "}
                {filtered.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      text="Trước"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-disabled={currentPage === 1}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {paginationRange(currentPage, totalPages).map((item, i) =>
                    item === "..." ? (
                      <PaginationItem key={`e-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          isActive={item === currentPage}
                          onClick={() => setPage(item)}
                          className="cursor-pointer"
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      text="Sau"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      aria-disabled={currentPage === totalPages}
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tiểu thuyết?</AlertDialogTitle>
            <AlertDialogDescription>
              Tiểu thuyết <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong>{" "}
              cùng toàn bộ chương, cảnh, nhân vật và ghi chú sẽ bị xóa vĩnh
              viễn.
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

      <CreateNovelDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}

// ─── Novel actions dropdown ─────────────────────────────────

function NovelActions({
  novel,
  onExport,
  onDelete,
}: {
  novel: Novel;
  onExport: (novel: Novel) => void;
  onDelete: (novel: Novel) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onExport(novel)}
          >
            <DownloadIcon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Xuất JSON</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(novel)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Xóa</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ─── Pagination helper ──────────────────────────────────────

function paginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
