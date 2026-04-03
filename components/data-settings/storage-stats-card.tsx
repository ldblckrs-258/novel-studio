"use client";

import { DatabaseIcon, HardDriveIcon, LayersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CURRENT_DB_VERSION, TABLE_LABELS, type StorageStats } from "@/lib/db-io";

type StorageStatsCardProps = {
  stats: StorageStats | null;
  statsLoading: boolean;
  formatFileSize: (bytes: number) => string;
};

export function StorageStatsCard({
  stats,
  statsLoading,
  formatFileSize,
}: StorageStatsCardProps) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DatabaseIcon className="size-5 text-primary" />
          Thống kê lưu trữ
        </CardTitle>
        <CardDescription>Tổng quan dữ liệu hiện có trong trình duyệt.</CardDescription>
      </CardHeader>
      <CardContent>
        {statsLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải thống kê...</p>
        ) : stats ? (
          <div className="space-y-5">
            {stats.storageUsage != null && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-background p-2">
                    <HardDriveIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Dung lượng sử dụng</span>
                      <span className="font-medium">
                        {formatFileSize(stats.storageUsage)}
                        {stats.storageQuota
                          ? ` / ${formatFileSize(stats.storageQuota)}`
                          : ""}
                      </span>
                    </div>
                    {stats.storageQuota && (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
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
              </div>
            )}

            <div className="rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LayersIcon className="size-4" />
                  Tổng số bản ghi
                </div>
                <Badge variant="secondary">
                  {stats.totalRecords.toLocaleString("vi-VN")}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {Object.entries(stats.tableCounts)
                  .filter(([, count]) => count > 0)
                  .map(([table, count]) => (
                    <div key={table} className="flex items-center justify-between gap-2">
                      <span className="truncate text-muted-foreground">
                        {TABLE_LABELS[table] || table}
                      </span>
                      <span className="tabular-nums font-medium">
                        {count.toLocaleString("vi-VN")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Phiên bản DB: {CURRENT_DB_VERSION}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Không thể tải thống kê.</p>
        )}
      </CardContent>
    </Card>
  );
}
