"use client";

import { CreateNovelDialog } from "@/components/create-novel-dialog";
import { EditNovelDialog } from "@/components/edit-novel-dialog";
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
import { Card, CardContent } from "@/components/ui/card";
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
  PencilIcon,
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
  const [editTarget, setEditTarget] = useState<Novel | null>(null);

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
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-3/4 w-full rounded-lg bg-muted" />
              <div className="mt-2 space-y-1.5 px-0.5">
                <div className="h-3 w-4/5 rounded bg-muted" />
                <div className="h-2.5 w-3/5 rounded bg-muted" />
              </div>
            </div>
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
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {paginated.map((novel) => (
                <div
                  key={novel.id}
                  className="group cursor-pointer"
                  onClick={() => router.push(`/novels/${novel.id}`)}
                >
                  {/* Book cover — 2:3 ratio */}
                  <div className="relative aspect-3/4 w-full overflow-hidden rounded-lg bg-muted shadow-sm transition-shadow group-hover:shadow-md">
                    {novel.coverImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={novel.coverImage}
                          alt={novel.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        {novel.color && (
                          <div
                            className="absolute inset-x-0 bottom-0 h-1"
                            style={{ backgroundColor: novel.color }}
                          />
                        )}
                      </>
                    ) : (
                      /* Placeholder with accent color + title */
                      <div
                        className="flex h-full flex-col justify-center items-center p-3 font-serif"
                        style={{
                          background: novel.color
                            ? `linear-gradient(160deg, ${novel.color}20 0%, ${novel.color}99 100%)`
                            : undefined,
                        }}
                      >
                        <p className="line-clamp-3 text-sm font-semibold leading-snug text-foreground/80">
                          {novel.title}
                        </p>
                        {novel.author && (
                          <p className="mt-1 truncate text-[10px] text-muted-foreground">
                            {novel.author}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Genre badges overlay */}
                    {novel.genres && novel.genres.length > 0 && (
                      <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-linear-to-t from-black/60 to-transparent p-2 pt-4">
                        {novel.genres.slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="rounded-sm bg-black/40 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white/90 backdrop-blur-sm"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Hover actions */}
                    <div
                      className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <NovelActions
                        novel={novel}
                        onEdit={setEditTarget}
                        onExport={handleExport}
                        onDelete={setDeleteTarget}
                      />
                    </div>
                  </div>

                  {/* Info below cover */}
                  <div className="mt-2 px-0.5">
                    <p className="line-clamp-2 text-xs font-medium leading-snug">
                      {novel.title}
                    </p>
                    {novel.author && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {novel.author}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/50">
                      {formatDate(novel.updatedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {view === "list" && (
            <div className="flex flex-col gap-1.5">
              {paginated.map((novel) => (
                <Card
                  key={novel.id}
                  className="group cursor-pointer transition-colors hover:bg-muted/30 py-0"
                  onClick={() => router.push(`/novels/${novel.id}`)}
                >
                  <CardContent className="flex items-center gap-3 py-2.5 px-3">
                    {/* Thumbnail — 2:3 ratio, h-12 */}
                    <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-muted">
                      {novel.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={novel.coverImage}
                          alt={novel.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: novel.color
                              ? `linear-gradient(160deg, ${novel.color}44 0%, ${novel.color}bb 100%)`
                              : undefined,
                          }}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {novel.title}
                      </p>
                      {novel.author && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {novel.author}
                        </p>
                      )}
                    </div>

                    {novel.genres && novel.genres.length > 0 && (
                      <div className="hidden shrink-0 gap-1 sm:flex">
                        {novel.genres.slice(0, 2).map((g) => (
                          <Badge
                            key={g}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {g}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <span className="shrink-0 text-[11px] text-muted-foreground/50">
                      {formatDate(novel.updatedAt)}
                    </span>

                    <div onClick={(e) => e.stopPropagation()}>
                      <NovelActions
                        novel={novel}
                        onEdit={setEditTarget}
                        onExport={handleExport}
                        onDelete={setDeleteTarget}
                      />
                    </div>
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

      {editTarget && (
        <EditNovelDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          novel={editTarget}
        />
      )}
    </main>
  );
}

// ─── Novel actions dropdown ─────────────────────────────────

function NovelActions({
  novel,
  onEdit,
  onExport,
  onDelete,
}: {
  novel: Novel;
  onEdit: (novel: Novel) => void;
  onExport: (novel: Novel) => void;
  onDelete: (novel: Novel) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onEdit(novel)}
          >
            <PencilIcon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Chỉnh sửa</TooltipContent>
      </Tooltip>
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
