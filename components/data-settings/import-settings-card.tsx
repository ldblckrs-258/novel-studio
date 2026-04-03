"use client";

import type React from "react";
import {
  AlertTriangleIcon,
  FileSearchIcon,
  LockKeyholeIcon,
  UploadIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENT_DB_VERSION, TABLE_LABELS, type ConflictMode, type ImportPreview } from "@/lib/db-io";
import { cn } from "@/lib/utils";

type ImportSettingsCardProps = {
  importFile: File | null;
  importPreview: ImportPreview | null;
  conflictMode: ConflictMode;
  importPassword: string;
  dragActive: boolean;
  needsPassword: boolean;
  fileSizeWarning: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  formatFileSize: (bytes: number) => string;
  onDragActiveChange: (active: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportPasswordChange: (value: string) => void;
  onDecryptAndPreview: () => void;
  onConflictModeChange: (value: ConflictMode) => void;
  onImport: () => void;
};

export function ImportSettingsCard({
  importFile,
  importPreview,
  conflictMode,
  importPassword,
  dragActive,
  needsPassword,
  fileSizeWarning,
  fileInputRef,
  formatFileSize,
  onDragActiveChange,
  onDrop,
  onFileSelect,
  onImportPasswordChange,
  onDecryptAndPreview,
  onConflictModeChange,
  onImport,
}: ImportSettingsCardProps) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UploadIcon className="size-5 text-primary" />
          Nhập dữ liệu
        </CardTitle>
        <CardDescription>Khôi phục dữ liệu từ tệp sao lưu JSON.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-8",
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            importFile && !dragActive && "border-primary/50 bg-primary/5",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            onDragActiveChange(true);
          }}
          onDragLeave={() => onDragActiveChange(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Kéo thả tệp JSON vào đây hoặc nhấn để chọn tệp
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
            onChange={onFileSelect}
          />
        </div>

        {fileSizeWarning && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            Tệp có kích thước lớn. Quá trình nhập có thể mất vài phút.
          </div>
        )}

        {needsPassword && (
          <div className="space-y-2 rounded-xl border p-4">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <LockKeyholeIcon className="size-4 text-muted-foreground" />
              Tệp được mã hoá, vui lòng nhập mật khẩu
            </Label>
            <Input
              type="password"
              value={importPassword}
              onChange={(e) => onImportPasswordChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onDecryptAndPreview()}
            />
            <Button onClick={onDecryptAndPreview} size="sm">
              Giải mã và xem trước
            </Button>
          </div>
        )}

        {importPreview && (
          <div className="space-y-3 rounded-xl border p-4">
            <p className="flex items-center gap-2 font-medium">
              <FileSearchIcon className="size-4 text-muted-foreground" />
              Xem trước nội dung
            </p>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {Object.entries(importPreview.counts)
                .filter(([, count]) => count > 0)
                .map(([table, count]) => (
                  <div key={table} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {TABLE_LABELS[table] || table}
                    </span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Phiên bản DB: {importPreview.meta.dbVersion} | Xuất lúc:{" "}
              {new Date(importPreview.meta.exportedAt).toLocaleString("vi-VN")}
            </p>
            {importPreview.meta.dbVersion > CURRENT_DB_VERSION && (
              <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangleIcon className="size-3.5" />
                Tệp từ phiên bản mới hơn, có thể xảy ra lỗi tương thích.
              </p>
            )}
          </div>
        )}

        {importPreview && (
          <div className="rounded-xl border p-4">
            <Label className="text-sm font-medium">Xử lý trùng lặp</Label>
            <Select value={conflictMode} onValueChange={(v) => onConflictModeChange(v as ConflictMode)}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overwrite">Ghi đè tất cả</SelectItem>
                <SelectItem value="skip">Bỏ qua nếu tồn tại</SelectItem>
                <SelectItem value="keep-both">Giữ cả hai (tạo bản sao)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {importPreview && (
          <Button onClick={onImport} className="w-full sm:w-auto">
            <UploadIcon className="mr-2 size-4" />
            Nhập dữ liệu
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
