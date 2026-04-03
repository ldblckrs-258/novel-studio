"use client";

import {
  BookTextIcon,
  CloudIcon,
  DatabaseIcon,
  DownloadIcon,
  UploadIcon,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type DataSettingsTabsProps = {
  activeTab: string;
};

export function DataSettingsTabs({ activeTab }: DataSettingsTabsProps) {
  return (
    <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-xl bg-muted/50 p-1.5 sm:grid-cols-5 group-data-horizontal/tabs:h-auto">
      <TabsTrigger value="stats" className="gap-1.5 rounded-lg py-1">
        <DatabaseIcon className="size-3" />
        <span
          className={cn(
            activeTab === "stats" ? "inline" : "hidden",
            "sm:inline",
          )}
        >
          Thống kê
        </span>
      </TabsTrigger>
      <TabsTrigger value="export" className="gap-1.5 rounded-lg py-1">
        <DownloadIcon className="size-3" />
        <span
          className={cn(
            activeTab === "export" ? "inline" : "hidden",
            "sm:inline",
          )}
        >
          Xuất
        </span>
      </TabsTrigger>
      <TabsTrigger value="import" className="gap-1.5 rounded-lg py-1">
        <UploadIcon className="size-3" />
        <span
          className={cn(
            activeTab === "import" ? "inline" : "hidden",
            "sm:inline",
          )}
        >
          Nhập
        </span>
      </TabsTrigger>
      <TabsTrigger value="sync" className="gap-1.5 rounded-lg py-1">
        <CloudIcon className="size-3" />
        <span
          className={cn(
            activeTab === "sync" ? "inline" : "hidden",
            "sm:inline",
          )}
        >
          Đồng bộ
        </span>
      </TabsTrigger>
      <TabsTrigger
        value="dictionary"
        className="col-span-3 gap-1.5 rounded-lg py-1 sm:col-span-1"
      >
        <BookTextIcon className="size-3" />
        <span
          className={cn(
            activeTab === "dictionary" ? "inline" : "hidden",
            "sm:inline",
          )}
        >
          Từ điển
        </span>
      </TabsTrigger>
    </TabsList>
  );
}
