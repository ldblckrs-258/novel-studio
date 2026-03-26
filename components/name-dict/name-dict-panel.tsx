"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { NAME_ENTRY_CATEGORIES, type NameEntry } from "@/lib/db";
import {
  createNameEntry,
  deleteNameEntry,
  updateNameEntry,
  useGlobalNameEntries,
  useMergedNameEntries,
  useNovelNameEntries,
} from "@/lib/hooks/use-name-entries";
import { useNovel } from "@/lib/hooks/use-novels";
import {
  useNameDictPanel,
  type ScopeFilter,
} from "@/lib/stores/name-dict-panel";
import { cn } from "@/lib/utils";
import {
  BookTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Edit3Icon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

const PAGE_SIZE = 50;

export function NameDictPanel() {
  const {
    isOpen,
    activeNovelId,
    searchQuery,
    categoryFilter,
    scopeFilter,
    close,
    setSearchQuery,
    setCategoryFilter,
    setScopeFilter,
  } = useNameDictPanel();
  const isMobile = useIsMobile();
  const novel = useNovel(activeNovelId ?? undefined);
  const mergedEntries = useMergedNameEntries(activeNovelId ?? undefined);
  const novelEntries = useNovelNameEntries(activeNovelId ?? undefined);
  const globalEntries = useGlobalNameEntries();

  const [page, setPage] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<NameEntry | null>(null);
  const [newChinese, setNewChinese] = useState("");
  const [newVietnamese, setNewVietnamese] = useState("");
  const [newCategory, setNewCategory] = useState<string>("nhân vật");
  const [newScope, setNewScope] = useState<"novel" | "global">("novel");

  // When on a novel page: merged (global + novel). Otherwise: global only.
  const isNovelContext = !!activeNovelId;
  const allEntries = isNovelContext
    ? (mergedEntries ?? [])
    : (globalEntries ?? []);

  // Pre-compute global chinese keys for O(1) override check
  const globalChineseSet = useMemo(
    () => new Set((globalEntries ?? []).map((g) => g.chinese)),
    [globalEntries],
  );

  // Count active filters (scope filter only relevant in novel context)
  const activeFilterCount =
    (categoryFilter ? 1 : 0) +
    (isNovelContext && scopeFilter !== "all" ? 1 : 0);

  // Filter entries
  const filtered = useMemo(() => {
    if (
      !searchQuery &&
      !categoryFilter &&
      (scopeFilter === "all" || !isNovelContext)
    )
      return allEntries;
    return allEntries.filter((e) => {
      const matchesSearch =
        !searchQuery ||
        e.chinese.includes(searchQuery) ||
        e.vietnamese.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !categoryFilter || e.category === categoryFilter;
      const matchesScope =
        !isNovelContext ||
        scopeFilter === "all" ||
        (scopeFilter === "novel" && e.scope !== "global") ||
        (scopeFilter === "global" && e.scope === "global");
      return matchesSearch && matchesCategory && matchesScope;
    });
  }, [allEntries, searchQuery, categoryFilter, scopeFilter, isNovelContext]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(0);
  };
  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value === "all" ? null : value);
    setPage(0);
  };
  const handleScopeChange = (value: ScopeFilter) => {
    setScopeFilter(value);
    setPage(0);
  };
  const clearFilters = () => {
    setCategoryFilter(null);
    setScopeFilter("all");
    setPage(0);
  };

  const handleAdd = async () => {
    if (!newChinese.trim() || !newVietnamese.trim()) return;
    const scope =
      newScope === "novel" && activeNovelId ? activeNovelId : "global";
    await createNameEntry({
      scope,
      chinese: newChinese.trim(),
      vietnamese: newVietnamese.trim(),
      category: newCategory,
    });
    setNewChinese("");
    setNewVietnamese("");
    setAddDialogOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingEntry || !newChinese.trim() || !newVietnamese.trim()) return;
    await updateNameEntry(editingEntry.id, {
      chinese: newChinese.trim(),
      vietnamese: newVietnamese.trim(),
      category: newCategory,
    });
    setEditingEntry(null);
  };

  const handleDelete = async (id: string) => {
    await deleteNameEntry(id);
  };

  const openEditDialog = (entry: NameEntry) => {
    setEditingEntry(entry);
    setNewChinese(entry.chinese);
    setNewVietnamese(entry.vietnamese);
    setNewCategory(entry.category);
  };

  const panelContent = (
    <>
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <BookTextIcon className="size-4" />
          <h3 className="text-sm font-medium">Từ điển tên</h3>
          <Badge variant="outline" className="text-xs">
            {novel ? novel.title : "Chung"}
          </Badge>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={close}>
          <XIcon className="size-4" />
        </Button>
      </header>

      {/* Search + filter + add */}
      <div className="flex gap-1.5 border-b p-3">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
          <Input
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Filter popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              className="relative size-8"
              title="Bộ lọc"
            >
              <FilterIcon className="size-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="space-y-3">
              {/* Scope filter — only in novel context */}
              {isNovelContext && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Phạm vi</Label>
                  <div className="flex gap-1">
                    {(
                      [
                        ["all", "Tất cả"],
                        ["novel", "Riêng"],
                        ["global", "Chung"],
                      ] as const
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        variant={scopeFilter === value ? "default" : "outline"}
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={() => handleScopeChange(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Loại</Label>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant={!categoryFilter ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleCategoryChange("all")}
                  >
                    Tất cả
                  </Button>
                  {NAME_ENTRY_CATEGORIES.map((cat) => (
                    <Button
                      key={cat}
                      variant={categoryFilter === cat ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs capitalize"
                      onClick={() => handleCategoryChange(cat)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Clear */}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={clearFilters}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="icon-sm"
          className="size-8"
          onClick={() => {
            setNewChinese("");
            setNewVietnamese("");
            setNewCategory("nhân vật");
            setNewScope(isNovelContext ? "novel" : "global");
            setAddDialogOpen(true);
          }}
          title="Thêm mục"
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1 border-b px-3 py-2">
          {scopeFilter !== "all" && (
            <Badge variant="secondary" className="h-5 gap-1 pr-1 text-[10px]">
              {scopeFilter === "novel" ? "Riêng" : "Chung"}
              <button
                onClick={() => handleScopeChange("all")}
                className="hover:text-foreground ml-0.5 rounded-full"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {categoryFilter && (
            <Badge
              variant="secondary"
              className="h-5 gap-1 pr-1 text-[10px] capitalize"
            >
              {categoryFilter}
              <button
                onClick={() => handleCategoryChange("all")}
                className="hover:text-foreground ml-0.5 rounded-full"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Entries list — paginated */}
      <ScrollArea className="h-[calc(100dvh-152px)]">
        <div className="divide-y">
          {pagedEntries.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {searchQuery || categoryFilter || scopeFilter !== "all"
                ? "Không tìm thấy kết quả"
                : "Chưa có mục nào"}
            </p>
          )}
          {pagedEntries.map((entry) => {
            const isNovelEntry = entry.scope !== "global";
            const isOverriding =
              isNovelEntry && globalChineseSet.has(entry.chinese);
            return (
              <div
                key={entry.id}
                className="group flex items-center gap-2 px-4 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "font-mono",
                        isNovelEntry
                          ? "font-semibold"
                          : "text-muted-foreground",
                      )}
                    >
                      {entry.chinese}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span
                      className={cn(
                        isNovelEntry ? "" : "text-muted-foreground text-xs",
                      )}
                    >
                      {entry.vietnamese}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className="h-4 px-1 text-[10px] capitalize"
                    >
                      {entry.category}
                    </Badge>
                    {!isNovelEntry && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[10px]"
                      >
                        Chung
                      </Badge>
                    )}
                    {isOverriding && (
                      <Badge variant="default" className="h-4 px-1 text-[10px]">
                        Ghi đè
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEditDialog(entry)}
                    className="size-6"
                  >
                    <Edit3Icon className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(entry.id)}
                    className="size-6"
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Pagination footer */}
      <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
        <span className="text-muted-foreground text-xs">
          {filtered.length} mục
          {isNovelContext
            ? ` (${(novelEntries ?? []).length} riêng, ${(globalEntries ?? []).length} chung)`
            : ""}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              {page + 1}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog
        open={addDialogOpen || !!editingEntry}
        onOpenChange={(open) => {
          if (!open) {
            setAddDialogOpen(false);
            setEditingEntry(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Chỉnh sửa mục" : "Thêm mục mới"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Trung văn</Label>
              <Input
                value={newChinese}
                onChange={(e) => setNewChinese(e.target.value)}
                placeholder="林枫"
              />
            </div>
            <div className="space-y-1">
              <Label>Tiếng Việt</Label>
              <Input
                value={newVietnamese}
                onChange={(e) => setNewVietnamese(e.target.value)}
                placeholder="Lâm Phong"
              />
            </div>
            <div className="space-y-1">
              <Label>Loại</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NAME_ENTRY_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingEntry && activeNovelId && (
              <div className="space-y-1">
                <Label>Phạm vi</Label>
                <Select
                  value={newScope}
                  onValueChange={(v) => setNewScope(v as "novel" | "global")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novel">Riêng tiểu thuyết</SelectItem>
                    <SelectItem value="global">Chung (toàn cục)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setEditingEntry(null);
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={editingEntry ? handleUpdate : handleAdd}
              disabled={!newChinese.trim() || !newVietnamese.trim()}
            >
              {editingEntry ? "Lưu" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // Mobile: Sheet
  if (isMobile) {
    return (
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[85vw] bg-card p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Từ điển tên</SheetTitle>
            <SheetDescription>Bảng từ điển tên nhân vật</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{panelContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: gap spacer + fixed container
  return (
    <div className="hidden md:block">
      <div
        className={cn(
          "relative bg-transparent transition-[width] duration-200 ease-linear",
          isOpen ? "w-[360px]" : "w-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-10 hidden h-svh w-[360px] border-l bg-card transition-[right] duration-200 ease-linear md:flex",
          !isOpen && "right-[calc(360px*-1)]",
        )}
      >
        <div className="flex size-full flex-col">{panelContent}</div>
      </div>
    </div>
  );
}
