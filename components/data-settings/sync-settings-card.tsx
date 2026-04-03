"use client";

import {
  CloudDownloadIcon,
  CloudUploadIcon,
  CopyIcon,
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
import {
  TABLE_LABELS,
  type ConflictMode,
  type ImportPreview,
} from "@/lib/db-io";
import { SyncProgressCard } from "./sync-progress-card";

type SyncProgress = {
  label: string;
  percentage: number;
  detail?: string;
};

type SyncSettingsCardProps = {
  syncProgressBar: SyncProgress | null;
  syncPassword: string;
  syncUploading: boolean;
  syncCode: string;
  syncExpiresAt: string | null;
  syncDownloadCode: string;
  syncDownloading: boolean;
  syncNeedsPassword: boolean;
  syncImportPassword: string;
  syncPreview: ImportPreview | null;
  syncConflictMode: ConflictMode;
  onSyncPasswordChange: (value: string) => void;
  onSyncUpload: () => void;
  onCopySyncCode: () => void;
  onSyncDownloadCodeChange: (value: string) => void;
  onSyncDownload: () => void;
  onSyncImportPasswordChange: (value: string) => void;
  onSyncDecryptAndPreview: () => void;
  onSyncConflictModeChange: (mode: ConflictMode) => void;
  onSyncImport: () => void;
};

export function SyncSettingsCard({
  syncProgressBar,
  syncPassword,
  syncUploading,
  syncCode,
  syncExpiresAt,
  syncDownloadCode,
  syncDownloading,
  syncNeedsPassword,
  syncImportPassword,
  syncPreview,
  syncConflictMode,
  onSyncPasswordChange,
  onSyncUpload,
  onCopySyncCode,
  onSyncDownloadCodeChange,
  onSyncDownload,
  onSyncImportPasswordChange,
  onSyncDecryptAndPreview,
  onSyncConflictModeChange,
  onSyncImport,
}: SyncSettingsCardProps) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CloudUploadIcon className="size-5 text-primary" />
          Đồng bộ cloud
        </CardTitle>
        <CardDescription>
          Tải bản sao lưu lên cloud bằng mã chia sẻ 8 ký tự.
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          Giới hạn tải lên: tối đa 3 lần mỗi ngày. Mỗi mã đồng bộ có hiệu lực
          trong 15 phút.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {syncProgressBar && <SyncProgressCard progress={syncProgressBar} />}

        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <Label className="text-sm font-medium">Tải lên cloud</Label>
            <p className="text-sm text-muted-foreground">
              Không đồng bộ dữ liệu từ điển lớn để giảm dung lượng.
            </p>
          </div>
          <div>
            <Label className="flex items-center gap-2 text-sm font-medium">
              <LockKeyholeIcon className="size-4 text-muted-foreground" />
              Mật khẩu bảo vệ (khuyến nghị)
            </Label>
            <Input
              type="password"
              value={syncPassword}
              onChange={(e) => onSyncPasswordChange(e.target.value)}
              placeholder="Nhập mật khẩu để mã hoá bản đồng bộ"
              className="mt-2"
            />
          </div>
          <Button
            onClick={onSyncUpload}
            disabled={syncUploading}
            className="w-full sm:w-auto"
          >
            <CloudUploadIcon className="mr-2 size-4" />
            {syncUploading ? "Đang tải lên..." : "Tải lên cloud"}
          </Button>

          {syncCode && syncExpiresAt && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">Mã đồng bộ</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="font-mono text-lg font-semibold tracking-widest">
                  {`${syncCode.slice(0, 4)} ${syncCode.slice(4)}`}
                </code>
                <Button variant="outline" size="sm" onClick={onCopySyncCode}>
                  <CopyIcon className="mr-2 size-3.5" />
                  Sao chép
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Hết hạn: {new Date(syncExpiresAt).toLocaleString("vi-VN")}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div>
            <Label className="text-sm font-medium">Nhập từ mã đồng bộ</Label>
            <p className="text-sm text-muted-foreground">
              Nhập mã 8 ký tự để tải dữ liệu từ cloud.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={syncDownloadCode}
              onChange={(e) => onSyncDownloadCodeChange(e.target.value)}
              maxLength={8}
              placeholder="A3F2BC91"
              className="font-mono uppercase"
            />
            <Button
              onClick={onSyncDownload}
              disabled={syncDownloading || syncDownloadCode.length !== 8}
            >
              <CloudDownloadIcon className="mr-2 size-4" />
              {syncDownloading ? "Đang tải..." : "Tải về"}
            </Button>
          </div>

          {syncNeedsPassword && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-sm font-medium">
                Dữ liệu đã mã hoá, nhập mật khẩu
              </Label>
              <Input
                type="password"
                value={syncImportPassword}
                onChange={(e) => onSyncImportPasswordChange(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && onSyncDecryptAndPreview()
                }
              />
              <Button onClick={onSyncDecryptAndPreview} size="sm">
                Giải mã và xem trước
              </Button>
            </div>
          )}

          {syncPreview && (
            <>
              <div className="space-y-2 rounded-lg border p-4">
                <p className="font-medium">Xem trước nội dung</p>
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(syncPreview.counts)
                    .filter(([, count]) => count > 0)
                    .map(([table, count]) => (
                      <div key={table} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">
                          {TABLE_LABELS[table] || table}
                        </span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Phiên bản DB: {syncPreview.meta.dbVersion} | Xuất lúc:{" "}
                  {new Date(syncPreview.meta.exportedAt).toLocaleString(
                    "vi-VN",
                  )}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">Xử lý trùng lặp</Label>
                <Select
                  value={syncConflictMode}
                  onValueChange={(v) =>
                    onSyncConflictModeChange(v as ConflictMode)
                  }
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overwrite">Ghi đè tất cả</SelectItem>
                    <SelectItem value="skip">Bỏ qua nếu tồn tại</SelectItem>
                    <SelectItem value="keep-both">
                      Giữ cả hai (tạo bản sao)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={onSyncImport} className="w-full sm:w-auto">
                <UploadIcon className="mr-2 size-4" />
                Nhập dữ liệu đồng bộ
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
