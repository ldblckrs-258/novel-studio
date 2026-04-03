"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { DatabaseIcon } from "lucide-react";
import { useNovels } from "@/lib/hooks";
import {
  buildExportPayload,
  exportDatabase,
  previewImportFile,
  importDatabase,
  getStorageStats,
  type StorageStats,
  type ProgressInfo,
  type ConflictMode,
  type ImportPreview
} from "@/lib/db-io";
import { ProgressDialog } from "@/components/progress-dialog";
import { DictionaryManagement } from "@/components/dictionary-management";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { DataSettingsTabs } from "@/components/data-settings/data-settings-tabs";
import { StorageStatsCard } from "@/components/data-settings/storage-stats-card";
import { ExportSettingsCard } from "@/components/data-settings/export-settings-card";
import { ImportSettingsCard } from "@/components/data-settings/import-settings-card";
import { SyncSettingsCard } from "@/components/data-settings/sync-settings-card";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function generateSyncCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function DataSettings() {
  const novels = useNovels();

  // Storage stats
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stats");

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

  // Cloud sync state
  const [syncPassword, setSyncPassword] = useState("");
  const [syncUploading, setSyncUploading] = useState(false);
  const [syncCode, setSyncCode] = useState("");
  const [syncExpiresAt, setSyncExpiresAt] = useState<string | null>(null);
  const [syncDownloadCode, setSyncDownloadCode] = useState("");
  const [syncDownloading, setSyncDownloading] = useState(false);
  const [syncFile, setSyncFile] = useState<File | null>(null);
  const [syncPreview, setSyncPreview] = useState<ImportPreview | null>(null);
  const [syncNeedsPassword, setSyncNeedsPassword] = useState(false);
  const [syncImportPassword, setSyncImportPassword] = useState("");
  const [syncConflictMode, setSyncConflictMode] =
    useState<ConflictMode>("overwrite");
  const [syncProgressBar, setSyncProgressBar] = useState<{
    label: string;
    percentage: number;
    detail?: string;
  } | null>(null);

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
        toast.error(err instanceof Error ? err.message : "Không thể đọc tệp.");
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

  // ─── Cloud sync ───────────────────────────────────────────

  const handleSyncUpload = useCallback(async () => {
    setSyncUploading(true);
    setSyncCode("");
    setSyncExpiresAt(null);
    setSyncProgressBar({
      label: "Đang thu thập dữ liệu",
      percentage: 0,
    });

    try {
      const code = generateSyncCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const payload = await buildExportPayload({
        novelIds: selectedNovelIds.length > 0 ? selectedNovelIds : undefined,
        includeAISettings: includeAI,
        includeConversations,
        includeLargeDictionaryData: false,
        password: syncPassword || undefined,
        onProgress: (info) => {
          setSyncProgressBar({
            label: "Đang thu thập dữ liệu",
            percentage: Math.round(info.percentage * 0.3),
            detail: info.tableName,
          });
        },
        onStageProgress: (info) => {
          if (info.stage === "combine") {
            setSyncProgressBar({
              label: "Đang hợp nhất dữ liệu",
              percentage: 38,
              detail: info.message,
            });
          } else if (info.stage === "encrypt") {
            setSyncProgressBar({
              label: "Đang mã hoá bản sao lưu",
              percentage: 46,
              detail: info.message,
            });
          } else if (info.stage === "finalize") {
            setSyncProgressBar({
              label: "Đang chuẩn bị tải lên",
              percentage: 50,
              detail: info.message,
            });
          }
        },
      });

      const parsedPayload = JSON.parse(payload.json) as unknown;
      const envelope = JSON.stringify({
        version: 1,
        code,
        expiresAt,
        payload: parsedPayload,
      });

      await upload(
        `sync/${code}.json`,
        new Blob([envelope], { type: "application/json" }),
        {
          access: "public",
          handleUploadUrl: "/api/sync/upload",
          contentType: "application/json",
          multipart: true,
          clientPayload: JSON.stringify({ code, expiresAt }),
          onUploadProgress: ({ percentage }) => {
            setSyncProgressBar({
              label: "Tải lên Cloud",
              percentage: 50 + Math.round(percentage * 0.5),
            });
          },
        },
      );

      setSyncCode(code);
      setSyncExpiresAt(expiresAt);
      setSyncProgressBar({
        label: "Đã tải lên hoàn tất",
        percentage: 100,
      });
      toast.success("Đã tải dữ liệu lên cloud.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể tải dữ liệu lên cloud.",
      );
    } finally {
      setSyncUploading(false);
      setTimeout(() => {
        setSyncProgressBar((prev) => (prev?.percentage === 100 ? null : prev));
      }, 1200);
    }
  }, [selectedNovelIds, includeAI, includeConversations, syncPassword]);

  const handleCopySyncCode = useCallback(async () => {
    if (!syncCode) return;
    try {
      await navigator.clipboard.writeText(syncCode);
      toast.success("Đã sao chép mã đồng bộ.");
    } catch {
      toast.error("Không thể sao chép mã.");
    }
  }, [syncCode]);

  const handleSyncDownload = useCallback(async () => {
    const code = syncDownloadCode.trim().toUpperCase();
    if (!/^[0-9A-F]{8}$/.test(code)) {
      toast.error("Mã đồng bộ phải gồm 8 ký tự hex.");
      return;
    }

    setSyncDownloading(true);
    setSyncPreview(null);
    setSyncNeedsPassword(false);
    setSyncImportPassword("");
    setSyncFile(null);
    setSyncProgressBar({
      label: "Xử lý mã đồng bộ",
      percentage: 5,
    });

    try {
      const res = await fetch(`/api/sync/download/${code}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        let message = "Không thể tải dữ liệu đồng bộ.";
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          // ignore parse error and keep generic message
        }
        throw new Error(message);
      }

      const resolved = (await res.json()) as { url?: string; error?: string };
      if (!resolved.url) {
        throw new Error(resolved.error || "Không thể resolve link đồng bộ.");
      }

      const blobRes = await fetch(resolved.url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!blobRes.ok) {
        throw new Error("Không thể tải dữ liệu từ Blob.");
      }
      const totalBytes = Number(blobRes.headers.get("content-length") || 0);
      let raw: string;
      if (blobRes.body) {
        const reader = blobRes.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            if (totalBytes > 0) {
              const pct = Math.min(
                85,
                12 + Math.round((received / totalBytes) * 73),
              );
              setSyncProgressBar({
                label: "Tải về bản sao lưu",
                percentage: pct,
                detail: `${formatFileSize(received)} / ${formatFileSize(totalBytes)}`,
              });
            } else {
              setSyncProgressBar({
                label: "Tải về bản sao lưu",
                percentage: 70,
                detail: `${formatFileSize(received)}`,
              });
            }
          }
        }
        raw = new TextDecoder().decode(
          chunks.length === 1
            ? chunks[0]
            : (() => {
                const merged = new Uint8Array(received);
                let offset = 0;
                for (const chunk of chunks) {
                  merged.set(chunk, offset);
                  offset += chunk.byteLength;
                }
                return merged;
              })(),
        );
      } else {
        raw = await blobRes.text();
      }
      setSyncProgressBar({
        label: "Đang phân tích bản sao lưu",
        percentage: 90,
      });
      let text = raw;

      try {
        const parsed = JSON.parse(raw) as {
          version?: number;
          expiresAt?: string;
          payload?: unknown;
        };
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.version === 1 &&
          typeof parsed.expiresAt === "string" &&
          "payload" in parsed
        ) {
          if (Date.parse(parsed.expiresAt) < Date.now()) {
            throw new Error("Mã đồng bộ đã hết hạn.");
          }
          text = JSON.stringify(parsed.payload);
        }
      } catch (err) {
        if (err instanceof Error && err.message === "Mã đồng bộ đã hết hạn.") {
          throw err;
        }
      }
      setSyncProgressBar({
        label: "Đang chuẩn bị xem trước dữ liệu nhập",
        percentage: 96,
      });

      const file = new File([text], `novel-studio-sync-${code}.json`, {
        type: "application/json",
      });
      setSyncFile(file);

      try {
        const preview = await previewImportFile(file);
        setSyncPreview(preview);
        setSyncProgressBar({
          label: "Đã tải về hoàn tất",
          percentage: 100,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "ENCRYPTED") {
          setSyncNeedsPassword(true);
          setSyncProgressBar({
            label: "Bản sao lưu đã được mã hóa",
            percentage: 100,
            detail: "Nhập mật khẩu để xem trước và import.",
          });
        } else {
          throw err;
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể tải dữ liệu đồng bộ.",
      );
    } finally {
      setSyncDownloading(false);
      setTimeout(() => {
        setSyncProgressBar((prev) => (prev?.percentage === 100 ? null : prev));
      }, 1200);
    }
  }, [syncDownloadCode]);

  const handleSyncDecryptAndPreview = useCallback(async () => {
    if (!syncFile || !syncImportPassword) return;

    try {
      const preview = await previewImportFile(syncFile, syncImportPassword);
      setSyncPreview(preview);
      setSyncNeedsPassword(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể giải mã tệp đồng bộ.",
      );
    }
  }, [syncFile, syncImportPassword]);

  const handleSyncImport = useCallback(async () => {
    if (!syncFile) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setProgress(null);
    setResult(null);
    setProgressOpen(true);

    try {
      await importDatabase(
        syncFile,
        {
          conflictMode: syncConflictMode,
          signal: ac.signal,
          onProgress: setProgress,
        },
        syncImportPassword || undefined,
      );
      setResult({ success: true, message: "Nhập dữ liệu đồng bộ thành công!" });
      loadStats();
      setSyncFile(null);
      setSyncPreview(null);
      setSyncNeedsPassword(false);
      setSyncImportPassword("");
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
  }, [syncFile, syncConflictMode, syncImportPassword, loadStats]);

  // ─── Render ─────────────────────────────────────────────

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <DatabaseIcon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Quản lý dữ liệu
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Xuất, nhập và đồng bộ dữ liệu ứng dụng dưới dạng tệp JSON.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <DataSettingsTabs activeTab={activeTab} />
        <TabsContent value="stats">
          <StorageStatsCard
            stats={stats}
            statsLoading={statsLoading}
            formatFileSize={formatFileSize}
          />
        </TabsContent>

        <TabsContent value="export">
          <ExportSettingsCard
            novels={novels}
            selectedNovelIds={selectedNovelIds}
            includeAI={includeAI}
            includeConversations={includeConversations}
            exportPassword={exportPassword}
            onToggleNovel={toggleNovel}
            onIncludeAIChange={setIncludeAI}
            onIncludeConversationsChange={setIncludeConversations}
            onExportPasswordChange={setExportPassword}
            onExport={handleExport}
          />
        </TabsContent>

        <TabsContent value="import">
          <ImportSettingsCard
            importFile={importFile}
            importPreview={importPreview}
            conflictMode={conflictMode}
            importPassword={importPassword}
            dragActive={dragActive}
            needsPassword={needsPassword}
            fileSizeWarning={fileSizeWarning}
            fileInputRef={fileInputRef}
            formatFileSize={formatFileSize}
            onDragActiveChange={setDragActive}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            onImportPasswordChange={setImportPassword}
            onDecryptAndPreview={handleDecryptAndPreview}
            onConflictModeChange={setConflictMode}
            onImport={handleImport}
          />
        </TabsContent>

        <TabsContent value="sync">
          <SyncSettingsCard
            syncProgressBar={syncProgressBar}
            syncPassword={syncPassword}
            syncUploading={syncUploading}
            syncCode={syncCode}
            syncExpiresAt={syncExpiresAt}
            syncDownloadCode={syncDownloadCode}
            syncDownloading={syncDownloading}
            syncNeedsPassword={syncNeedsPassword}
            syncImportPassword={syncImportPassword}
            syncPreview={syncPreview}
            syncConflictMode={syncConflictMode}
            onSyncPasswordChange={setSyncPassword}
            onSyncUpload={handleSyncUpload}
            onCopySyncCode={handleCopySyncCode}
            onSyncDownloadCodeChange={(value) =>
              setSyncDownloadCode(value.toUpperCase().replace(/[^0-9A-F]/g, ""))
            }
            onSyncDownload={handleSyncDownload}
            onSyncImportPasswordChange={setSyncImportPassword}
            onSyncDecryptAndPreview={handleSyncDecryptAndPreview}
            onSyncConflictModeChange={setSyncConflictMode}
            onSyncImport={handleSyncImport}
          />
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
