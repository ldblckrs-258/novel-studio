"use client";

import { DownloadIcon, LockKeyholeIcon, SparklesIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type NovelItem = {
  id: string;
  title: string;
};

type ExportSettingsCardProps = {
  novels: NovelItem[] | undefined;
  selectedNovelIds: string[];
  includeAI: boolean;
  includeConversations: boolean;
  exportPassword: string;
  onToggleNovel: (novelId: string, checked: boolean) => void;
  onIncludeAIChange: (checked: boolean) => void;
  onIncludeConversationsChange: (checked: boolean) => void;
  onExportPasswordChange: (value: string) => void;
  onExport: () => void;
};

export function ExportSettingsCard({
  novels,
  selectedNovelIds,
  includeAI,
  includeConversations,
  exportPassword,
  onToggleNovel,
  onIncludeAIChange,
  onIncludeConversationsChange,
  onExportPasswordChange,
  onExport,
}: ExportSettingsCardProps) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DownloadIcon className="size-5 text-primary" />
          Xuất dữ liệu
        </CardTitle>
        <CardDescription>Tải về bản sao lưu dữ liệu để lưu trữ an toàn.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border p-4">
          <Label className="text-sm font-medium">Chọn tiểu thuyết</Label>
          <p className="mb-3 text-sm text-muted-foreground">Để trống để xuất toàn bộ dữ liệu.</p>
          {novels && novels.length > 0 ? (
            <div className="space-y-2">
              {novels.map((novel) => (
                <label
                  key={novel.id}
                  className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm transition hover:border-border hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selectedNovelIds.includes(novel.id)}
                    onCheckedChange={(checked) => onToggleNovel(novel.id, !!checked)}
                  />
                  <span className="truncate">{novel.title}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">Chưa có tiểu thuyết.</p>
          )}
        </div>

        {selectedNovelIds.length === 0 && (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <Label className="text-sm font-medium">Bao gồm cài đặt AI</Label>
                <p className="text-sm text-muted-foreground">
                  Nhà cung cấp, mô hình và cấu hình phân tích.
                </p>
              </div>
              <Switch checked={includeAI} onCheckedChange={onIncludeAIChange} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <Label className="text-sm font-medium">Bao gồm hội thoại AI</Label>
                <p className="text-sm text-muted-foreground">Lịch sử trò chuyện với AI.</p>
              </div>
              <Switch
                checked={includeConversations}
                onCheckedChange={onIncludeConversationsChange}
              />
            </div>
          </>
        )}

        <div className="rounded-xl border p-4">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <LockKeyholeIcon className="size-4 text-muted-foreground" />
            Mật khẩu bảo vệ (tuỳ chọn)
          </Label>
          <Input
            type="password"
            value={exportPassword}
            onChange={(e) => onExportPasswordChange(e.target.value)}
            placeholder="Để trống nếu không cần mã hoá"
            className="mt-2"
          />
          {exportPassword && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Không thể khôi phục nếu quên mật khẩu.
            </p>
          )}
        </div>

        <Button onClick={onExport} className="w-full sm:w-auto">
          <SparklesIcon className="mr-2 size-4" />
          Xuất dữ liệu
        </Button>
      </CardContent>
    </Card>
  );
}
