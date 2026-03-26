"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  BookTextIcon,
  DatabaseIcon,
  DownloadIcon,
  HardDriveIcon,
  UploadIcon,
} from "lucide-react";
import { useNovels } from "@/lib/hooks";
import {
  exportDatabase,
  previewImportFile,
  importDatabase,
  getStorageStats,
  TABLE_LABELS,
  CURRENT_DB_VERSION,
  type StorageStats,
  type ProgressInfo,
  type ConflictMode,
  type ImportPreview,
} from "@/lib/db-io";
import { ProgressDialog } from "@/components/progress-dialog";
import { DictionaryManagement } from "@/components/dictionary-management";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function DataSettings() {
  const novels = useNovels();

  // Storage stats
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await getStorageStats());
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Export state
  const [selectedNovelIds, setSelectedNovelIds] = useState<string[]>([]);
  const [includeAI, setIncludeAI] = useState(true);
  const [includeConversations, setIncludeConversations] = useState(true);
  const [exportPassword, setExportPassword] = useState("");

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [conflictMode, setConflictMode] = useState<ConflictMode>("overwrite");
  const [importPassword, setImportPassword] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  // Progress state
  const [progressOpen, setProgressOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileSizeWarning = importFile
    ? importFile.size > 10 * 1024 * 1024
    : false;

  // ─── Export ─────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    const ac = new AbortController();
    abortRef.current = ac;
    setProgress(null);
    setResult(null);
    setProgressOpen(true);

    try {
      await exportDatabase({
        novelIds: selectedNovelIds.length > 0 ? selectedNovelIds : undefined,
        includeAISettings: includeAI,
        includeConversations,
        password: exportPassword || undefined,
        signal: ac.signal,
        onProgress: setProgress,
      });
      setResult({ success: true, message: "Xuất dữ liệu thành công!" });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setResult({ success: false, message: "Đã huỷ xuất dữ liệu." });
      } else {
        setResult({
          success: false,
          message: err instanceof Error ? err.message : "Lỗi không xác định.",
        });
      }
    }
  }, [selectedNovelIds, includeAI, includeConversations, exportPassword]);

  // ─── Import file handling ─────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setImportFile(file);
    setImportPreview(null);
    setNeedsPassword(false);
    setImportPassword("");

    try {
      const preview = await previewImportFile(file);
      setImportPreview(preview);
    } catch (err) {
      if (err instanceof Error && err.message === "ENCRYPTED") {
        setNeedsPassword(true);
      } else {
        toast.error(
          err instanceof Error ? err.message : "Không thể đọc tệp.",
        );
        setImportFile(null);
      }
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!file.name.endsWith(".json")) {
        toast.error("Chỉ chấp nhận tệp JSON.");
        return;
      }
      processFile(file);
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      processFile(file);
    },
    [processFile],
  );

  const handleDecryptAndPreview = useCallback(async () => {
    if (!importFile || !importPassword) return;
    try {
      const preview = await previewImportFile(importFile, importPassword);
      setImportPreview(preview);
      setNeedsPassword(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể giải mã tệp.",
      );
    }
  }, [importFile, importPassword]);

  // ─── Import ─────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!importFile) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setProgress(null);
    setResult(null);
    setProgressOpen(true);

    try {
      await importDatabase(
        importFile,
        { conflictMode, signal: ac.signal, onProgress: setProgress },
        importPassword || undefined,
      );
      setResult({ success: true, message: "Nhập dữ liệu thành công!" });
      loadStats();
      // Reset import state
      setImportFile(null);
      setImportPreview(null);
      setNeedsPassword(false);
      setImportPassword("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setResult({ success: false, message: "Đã huỷ nhập dữ liệu." });
      } else {
        setResult({
          success: false,
          message: err instanceof Error ? err.message : "Lỗi không xác định.",
        });
      }
    }
  }, [importFile, conflictMode, importPassword, loadStats]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleCloseProgress = useCallback(() => {
    setProgressOpen(false);
    setResult(null);
    setProgress(null);
  }, []);

  // ─── Novel selection helpers ────────────────────────────

  const toggleNovel = useCallback((novelId: string, checked: boolean) => {
    setSelectedNovelIds((prev) =>
      checked ? [...prev, novelId] : prev.filter((id) => id !== novelId),
    );
  }, []);

  // ─── Render ─────────────────────────────────────────────

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Quản lý dữ liệu
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Xuất và nhập dữ liệu ứng dụng dưới dạng tệp JSON.
        </p>
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">
            <DatabaseIcon className="size-3.5" />
            Thống kê
          </TabsTrigger>
          <TabsTrigger value="export">
            <DownloadIcon className="size-3.5" />
            Xuất
          </TabsTrigger>
          <TabsTrigger value="import">
            <UploadIcon className="size-3.5" />
            Nhập
          </TabsTrigger>
          <TabsTrigger value="dictionary">
            <BookTextIcon className="size-3.5" />
            Từ điển
          </TabsTrigger>
        </TabsList>

        {/* ─── Stats Tab ─────────────────────────────────────── */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Thống kê lưu trữ</CardTitle>
              <CardDescription>
                Tổng quan dữ liệu hiện có trong trình duyệt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <p className="text-sm text-muted-foreground">Đang tải...</p>
              ) : stats ? (
                <div className="space-y-4">
                  {/* Storage usage */}
                  {stats.storageUsage != null && (
                    <div className="flex items-center gap-3">
                      <HardDriveIcon className="size-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Dung lượng sử dụng</span>
                          <span className="font-medium">
                            {formatFileSize(stats.storageUsage)}
                            {stats.storageQuota
                              ? ` / ${formatFileSize(stats.storageQuota)}`
                              : ""}
                          </span>
                        </div>
                        {stats.storageQuota && (
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.min((stats.storageUsage / stats.storageQuota) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Record counts */}
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Tổng số bản ghi
                      </span>
                      <Badge variant="secondary">
                        {stats.totalRecords.toLocaleString("vi-VN")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {Object.entries(stats.tableCounts)
                        .filter(([, count]) => count > 0)
                        .map(([table, count]) => (
                          <div
                            key={table}
                            className="flex items-center justify-between"
                          >
                            <span className="text-muted-foreground">
                              {TABLE_LABELS[table] || table}
                            </span>
                            <span className="tabular-nums">
                              {count.toLocaleString("vi-VN")}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Phiên bản DB: {CURRENT_DB_VERSION}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Không thể tải thống kê.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Export Tab ────────────────────────────────────── */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Xuất dữ liệu</CardTitle>
              <CardDescription>
                Tải về bản sao lưu dữ liệu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Novel picker */}
              <div>
                <Label className="text-sm font-medium">
                  Chọn tiểu thuyết
                </Label>
                <p className="mb-2 text-sm text-muted-foreground">
                  Để trống để xuất toàn bộ dữ liệu.
                </p>
                {novels && novels.length > 0 ? (
                  <div className="space-y-2">
                    {novels.map((novel) => (
                      <label
                        key={novel.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedNovelIds.includes(novel.id)}
                          onCheckedChange={(checked) =>
                            toggleNovel(novel.id, !!checked)
                          }
                        />
                        <span>{novel.title}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    Chưa có tiểu thuyết.
                  </p>
                )}
              </div>

              {/* AI settings toggle */}
              {selectedNovelIds.length === 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">
                      Bao gồm cài đặt AI
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Nhà cung cấp, mô hình, và cài đặt phân tích.
                    </p>
                  </div>
                  <Switch
                    checked={includeAI}
                    onCheckedChange={setIncludeAI}
                  />
                </div>
              )}

              {/* Conversations toggle */}
              {selectedNovelIds.length === 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">
                      Bao gồm hội thoại
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Lịch sử chat AI.
                    </p>
                  </div>
                  <Switch
                    checked={includeConversations}
                    onCheckedChange={setIncludeConversations}
                  />
                </div>
              )}

              {/* Password */}
              <div>
                <Label className="text-sm font-medium">
                  Mật khẩu bảo vệ (tuỳ chọn)
                </Label>
                <Input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Để trống nếu không cần mã hoá"
                  className="mt-1"
                />
                {exportPassword && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Không thể khôi phục nếu quên mật khẩu.
                  </p>
                )}
              </div>

              <Button onClick={handleExport}>
                <DownloadIcon className="mr-2 size-4" />
                Xuất dữ liệu
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Import Tab ────────────────────────────────────── */}
        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>Nhập dữ liệu</CardTitle>
              <CardDescription>
                Khôi phục dữ liệu từ tệp sao lưu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <div
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25",
                  importFile &&
                    !dragActive &&
                    "border-primary/50 bg-primary/5",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Kéo thả tệp JSON vào đây hoặc nhấp để chọn
                </p>
                {importFile && (
                  <Badge variant="secondary">
                    {importFile.name} ({formatFileSize(importFile.size)})
                  </Badge>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* File size warning */}
              {fileSizeWarning && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Tệp có kích thước lớn. Quá trình nhập có thể mất vài phút.
                </p>
              )}

              {/* Password prompt */}
              {needsPassword && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Tệp được mã hoá. Nhập mật khẩu:
                  </Label>
                  <Input
                    type="password"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleDecryptAndPreview()
                    }
                  />
                  <Button onClick={handleDecryptAndPreview} size="sm">
                    Giải mã
                  </Button>
                </div>
              )}

              {/* Preview */}
              {importPreview && (
                <div className="space-y-2 rounded-lg border p-4">
                  <p className="font-medium">Xem trước nội dung:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(importPreview.counts)
                      .filter(([, count]) => count > 0)
                      .map(([table, count]) => (
                        <div key={table} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {TABLE_LABELS[table] || table}
                          </span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Phiên bản DB: {importPreview.meta.dbVersion} | Xuất lúc:{" "}
                    {new Date(importPreview.meta.exportedAt).toLocaleString(
                      "vi-VN",
                    )}
                  </p>
                  {importPreview.meta.dbVersion > CURRENT_DB_VERSION && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Tệp từ phiên bản mới hơn. Có thể xảy ra lỗi.
                    </p>
                  )}
                </div>
              )}

              {/* Conflict resolution */}
              {importPreview && (
                <div>
                  <Label className="text-sm font-medium">
                    Xử lý trùng lặp
                  </Label>
                  <Select
                    value={conflictMode}
                    onValueChange={(v) => setConflictMode(v as ConflictMode)}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overwrite">
                        Ghi đè tất cả
                      </SelectItem>
                      <SelectItem value="skip">
                        Bỏ qua nếu tồn tại
                      </SelectItem>
                      <SelectItem value="keep-both">
                        Giữ cả hai (tạo bản sao)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Import button */}
              {importPreview && (
                <Button onClick={handleImport}>
                  <UploadIcon className="mr-2 size-4" />
                  Nhập dữ liệu
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Dictionary Tab ──────────────────────────────────── */}
        <TabsContent value="dictionary">
          <DictionaryManagement />
        </TabsContent>
      </Tabs>

      {/* ─── Progress Dialog ──────────────────────────────── */}
      <ProgressDialog
        open={progressOpen}
        title={
          progress?.phase === "export"
            ? "Đang xuất dữ liệu..."
            : "Đang nhập dữ liệu..."
        }
        progress={progress}
        result={result}
        onCancel={handleCancel}
        onClose={handleCloseProgress}
      />
    </main>
  );
}
