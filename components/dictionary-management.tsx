"use client";

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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NAME_ENTRY_CATEGORIES,
  type DictSource,
  type NameEntry,
} from "@/lib/db";
import {
  exportDictSource,
  importDictFile,
  loadDictFromPublic,
  useDictMeta,
} from "@/lib/hooks/use-dict-entries";
import {
  bulkImportNameEntries,
  createNameEntry,
  deleteNameEntriesByScope,
  deleteNameEntry,
  updateNameEntry,
  useGlobalNameEntries,
  type DuplicateMode,
} from "@/lib/hooks/use-name-entries";
import { formatRelativeTime } from "@/lib/scene-version-utils";
import {
  BookTextIcon,
  DownloadIcon,
  Edit3,
  FileUpIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const ALL_SOURCES: DictSource[] = [
  "vietphrase",
  "names",
  "names2",
  "phienam",
  "luatnhan",
];

const DICT_SOURCE_LABELS: Record<DictSource, string> = {
  vietphrase: "VietPhrase",
  names: "Names",
  names2: "Names2",
  phienam: "Phiên âm",
  luatnhan: "Luật nhân",
};

/** Build page numbers with ellipsis: [0, 1, "ellipsis", 8, 9] */
function getPageRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const pages: (number | "ellipsis")[] = [];
  // Always show first page
  pages.push(0);

  if (current > 2) pages.push("ellipsis");

  // Pages around current
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 3) pages.push("ellipsis");

  // Always show last page
  pages.push(total - 1);

  return pages;
}

const DICT_SOURCE_DESC: Record<DictSource, string> = {
  vietphrase: "Từ điển chính Hán-Việt",
  names: "Tên nhân vật, địa danh",
  names2: "Tên bổ sung",
  phienam: "Phiên âm ký tự đơn",
  luatnhan: "Luật nhân xưng {0}",
};

export function DictionaryManagement() {
  const dictMeta = useDictMeta();
  const globalEntries = useGlobalNameEntries();
  const [isReloading, setIsReloading] = useState(false);
  const [replacingSource, setReplacingSource] = useState<DictSource | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<NameEntry | null>(null);
  const [newChinese, setNewChinese] = useState("");
  const [newVietnamese, setNewVietnamese] = useState("");
  const [newCategory, setNewCategory] = useState<string>("nhân vật");
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCategory, setImportCategory] = useState<string>("nhân vật");
  const [importDuplicateMode, setImportDuplicateMode] =
    useState<DuplicateMode>("skip");
  const [importPending, setImportPending] = useState<Array<{
    chinese: string;
    vietnamese: string;
  }> | null>(null);
  const [importSourceLabel, setImportSourceLabel] = useState("");
  const nameFileInputRef = useRef<HTMLInputElement>(null);

  // Filter entries
  const filteredEntries = (globalEntries ?? []).filter((e) => {
    const matchesSearch =
      !searchQuery ||
      e.chinese.includes(searchQuery) ||
      e.vietnamese.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || e.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleReloadDicts = async () => {
    setIsReloading(true);
    try {
      await loadDictFromPublic();
      toast.success("Đã tải lại từ điển QT");
    } catch {
      toast.error("Lỗi khi tải từ điển");
    } finally {
      setIsReloading(false);
    }
  };

  const handleDownload = async (source: DictSource) => {
    try {
      await exportDictSource(source);
    } catch {
      toast.error("Lỗi khi xuất file");
    }
  };

  const handleReplaceClick = (source: DictSource) => {
    setReplacingSource(source);
    // Trigger file input after state update
    setTimeout(() => replaceInputRef.current?.click(), 0);
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingSource) return;
    try {
      const count = await importDictFile(file, replacingSource);
      toast.success(
        `Đã thay thế ${DICT_SOURCE_LABELS[replacingSource]} với ${count.toLocaleString()} mục`,
      );
    } catch {
      toast.error("Lỗi khi nhập file");
    }
    setReplacingSource(null);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const handleAddEntry = async () => {
    if (!newChinese.trim() || !newVietnamese.trim()) return;
    await createNameEntry({
      scope: "global",
      chinese: newChinese.trim(),
      vietnamese: newVietnamese.trim(),
      category: newCategory,
    });
    setNewChinese("");
    setNewVietnamese("");
    setAddDialogOpen(false);
    toast.success("Đã thêm mục mới");
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry || !newChinese.trim() || !newVietnamese.trim()) return;
    await updateNameEntry(editingEntry.id, {
      chinese: newChinese.trim(),
      vietnamese: newVietnamese.trim(),
      category: newCategory,
    });
    setEditingEntry(null);
    toast.success("Đã cập nhật");
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteNameEntry(id);
    toast.success("Đã xóa");
  };

  const handleClearGlobalNames = async () => {
    await deleteNameEntriesByScope("global");
    toast.success("Đã xóa tất cả tên chung");
  };

  const parseDictLines = (text: string) => {
    const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
    return clean
      .split(/\r?\n/)
      .map((line) => {
        const idx = line.indexOf("=");
        if (idx < 1) return null;
        return {
          chinese: line.slice(0, idx).trim(),
          vietnamese: line.slice(idx + 1).trim(),
        };
      })
      .filter(
        (e): e is { chinese: string; vietnamese: string } =>
          !!e && !!e.chinese && !!e.vietnamese,
      );
  };

  const openImportDialog = (
    entries: Array<{ chinese: string; vietnamese: string }>,
    label: string,
  ) => {
    setImportPending(entries);
    setImportSourceLabel(label);
    setImportCategory("nhân vật");
    setImportDuplicateMode("skip");
    setImportDialogOpen(true);
  };

  const handleImportFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const entries = parseDictLines(text);
      if (entries.length === 0) {
        toast.error("File không hợp lệ (định dạng: 中文=tiếng việt)");
        return;
      }
      openImportDialog(
        entries,
        `${file.name} (${entries.length.toLocaleString()} mục)`,
      );
    };
    reader.readAsText(file);
    if (nameFileInputRef.current) nameFileInputRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPending) return;
    try {
      const result = await bulkImportNameEntries(
        "global",
        importPending,
        importCategory,
        importDuplicateMode,
      );
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} mới`);
      if (result.replaced > 0) parts.push(`${result.replaced} cập nhật`);
      if (result.skipped > 0) parts.push(`${result.skipped} bỏ qua`);
      toast.success(`Đã nhập: ${parts.join(", ")}`);
    } catch {
      toast.error("Lỗi khi nhập dữ liệu");
    }
    setImportDialogOpen(false);
    setImportPending(null);
  };

  const handleImportQTNames = async () => {
    try {
      const [resp1, resp2] = await Promise.all([
        fetch("/dict/names.txt"),
        fetch("/dict/names2.txt"),
      ]);
      const [text1, text2] = await Promise.all([resp1.text(), resp2.text()]);

      const entries = [...parseDictLines(text1), ...parseDictLines(text2)];
      openImportDialog(
        entries,
        `QT Names (${entries.length.toLocaleString()} mục)`,
      );
    } catch {
      toast.error("Lỗi khi đọc file QT Names");
    }
  };

  const openEditDialog = (entry: NameEntry) => {
    setEditingEntry(entry);
    setNewChinese(entry.chinese);
    setNewVietnamese(entry.vietnamese);
    setNewCategory(entry.category);
  };

  // Paginate
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const pagedEntries = filteredEntries.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input
        type="file"
        accept=".txt"
        ref={replaceInputRef}
        className="hidden"
        onChange={handleReplaceFile}
      />
      <input
        type="file"
        accept=".txt"
        ref={nameFileInputRef}
        className="hidden"
        onChange={handleImportFromFile}
      />

      {/* Dict Status — per source breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookTextIcon className="size-4" />
                Từ điển QT
              </CardTitle>
              <CardDescription>
                {dictMeta
                  ? `Cập nhật ${formatRelativeTime(new Date(dictMeta.loadedAt))}`
                  : "Chưa tải"}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReloadDicts}
              disabled={isReloading}
            >
              <RefreshCwIcon className="mr-2 size-3.5" />
              {isReloading ? "Đang tải..." : "Tải lại tất cả"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nguồn</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead className="text-right">Số mục</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_SOURCES.map((source) => {
                  const count = dictMeta?.sources[source] ?? 0;
                  return (
                    <TableRow key={source}>
                      <TableCell className="font-medium">
                        {DICT_SOURCE_LABELS[source]}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {DICT_SOURCE_DESC[source]}
                      </TableCell>
                      <TableCell className="text-right">
                        {count > 0 ? (
                          <Badge variant="secondary">
                            {count.toLocaleString()}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDownload(source)}
                            disabled={count === 0}
                            title={`Tải xuống ${DICT_SOURCE_LABELS[source]}`}
                          >
                            <DownloadIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleReplaceClick(source)}
                            title={`Thay thế ${DICT_SOURCE_LABELS[source]}`}
                          >
                            <FileUpIcon className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Global Name Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Từ điển tên chung</CardTitle>
              <CardDescription>
                {(globalEntries ?? []).length.toLocaleString()} mục
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleImportQTNames}>
                <DownloadIcon className="mr-2 size-3.5" />
                Nhập QT Names
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => nameFileInputRef.current?.click()}
              >
                <FileUpIcon className="mr-2 size-3.5" />
                Nhập từ file
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setNewChinese("");
                  setNewVietnamese("");
                  setNewCategory("nhân vật");
                  setAddDialogOpen(true);
                }}
              >
                <PlusIcon className="mr-2 size-3.5" />
                Thêm
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search & filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
              <Input
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                className="pl-8"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {NAME_ENTRY_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(globalEntries ?? []).length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClearGlobalNames}
                title="Xóa tất cả"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Table */}
          {pagedEntries.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Trung</TableHead>
                      <TableHead className="w-[35%]">Việt</TableHead>
                      <TableHead className="w-[20%]">Loại</TableHead>
                      <TableHead className="w-[15%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-sm">
                          {entry.chinese}
                        </TableCell>
                        <TableCell>{entry.vietnamese}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {entry.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditDialog(entry)}
                            >
                              <Edit3 className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteEntry(entry.id)}
                            >
                              <Trash2Icon className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm w-[180px]">
                    Trang {page + 1}/{totalPages} ({filteredEntries.length} mục)
                  </span>
                  <Pagination className="flex-1 justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          text="Trước"
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                          aria-disabled={page === 0}
                          className={
                            page === 0
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>

                      {getPageRange(page, totalPages).map((p, i) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`e${i}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={p === page}
                              onClick={() => setPage(p)}
                              className="cursor-pointer"
                            >
                              {p + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}

                      <PaginationItem>
                        <PaginationNext
                          text="Sau"
                          onClick={() =>
                            setPage((p) => Math.min(totalPages - 1, p + 1))
                          }
                          aria-disabled={page >= totalPages - 1}
                          className={
                            page >= totalPages - 1
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
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {searchQuery || categoryFilter !== "all"
                ? "Không tìm thấy kết quả"
                : 'Chưa có mục nào. Nhấn "Thêm mục" hoặc "Nhập từ QT Names" để bắt đầu.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
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
              onClick={editingEntry ? handleUpdateEntry : handleAddEntry}
              disabled={!newChinese.trim() || !newVietnamese.trim()}
            >
              {editingEntry ? "Lưu" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Confirmation Dialog */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setImportDialogOpen(false);
            setImportPending(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập từ điển tên</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-muted-foreground text-sm">
              Nguồn:{" "}
              <span className="text-foreground font-medium">
                {importSourceLabel}
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Loại mặc định</Label>
              <Select value={importCategory} onValueChange={setImportCategory}>
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

            <div className="space-y-1">
              <Label className="text-xs font-medium">Xử lý trùng lặp</Label>
              <div className="flex gap-2">
                <Button
                  variant={
                    importDuplicateMode === "skip" ? "default" : "outline"
                  }
                  size="sm"
                  className="flex-1"
                  onClick={() => setImportDuplicateMode("skip")}
                >
                  Giữ bản cũ
                </Button>
                <Button
                  variant={
                    importDuplicateMode === "replace" ? "default" : "outline"
                  }
                  size="sm"
                  className="flex-1"
                  onClick={() => setImportDuplicateMode("replace")}
                >
                  Ghi đè bản mới
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {importDuplicateMode === "skip"
                  ? "Bỏ qua các mục đã tồn tại (giữ nguyên bản dịch cũ)"
                  : "Cập nhật bản dịch mới cho các mục đã tồn tại"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportPending(null);
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleConfirmImport}>
              Nhập {importPending?.length.toLocaleString()} mục
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
