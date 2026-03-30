"use client";

import { navConfig } from "@/components/app-sidebar";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDashboardStats,
  useRecentChapters,
  useTopNovelsByChapters,
} from "@/lib/hooks";
import {
  BookOpenIcon,
  FileTextIcon,
  PenLineIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
}

const QUICK_NAV_HREFS = [
  "/library",
  "/import",
  "/convert",
  "/settings/providers",
  "/settings/data",
];
const QUICK_NAV = navConfig.filter((item) =>
  QUICK_NAV_HREFS.includes(item.href),
);

export default function DashboardPage() {
  const stats = useDashboardStats();
  const recentChapters = useRecentChapters(8);
  const topNovels = useTopNovelsByChapters(5);

  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl overflow-hidden px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Chào mừng trở lại
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tổng quan không gian sáng tác của bạn.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats === undefined ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-4">
                <div className="h-3 w-16 rounded bg-muted" />
                <div className="mt-2 h-7 w-12 rounded bg-muted" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Tiểu thuyết"
              value={stats.novelCount}
              icon={BookOpenIcon}
            />
            <StatCard
              label="Chương"
              value={stats.chapterCount}
              icon={FileTextIcon}
            />
            <StatCard
              label="Tổng từ"
              value={stats.wordCount}
              icon={PenLineIcon}
            />
            <StatCard
              label="Nhân vật"
              value={stats.characterCount}
              icon={UsersIcon}
            />
          </>
        )}
      </div>

      {/* Main content: 2/3 + 1/3 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent chapters — left 2/3 */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Chương gần đây</CardTitle>
            <CardDescription>
              Các chương được chỉnh sửa gần nhất
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentChapters === undefined ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : recentChapters.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>Chưa có chương nào</EmptyTitle>
                  <EmptyDescription>
                    Tạo tiểu thuyết và thêm chương để bắt đầu.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-1">
                {recentChapters.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/novels/${ch.novelId}/chapters/${ch.id}`}
                    className="flex items-center gap-3 overflow-hidden rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    {ch.novelColor && (
                      <div
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: ch.novelColor }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ch.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ch.novelTitle}
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block">
                      {ch.wordCount.toLocaleString()} từ
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground/60">
                      {formatRelative(ch.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Top novels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrophyIcon className="size-4 text-amber-500" />
                Top tiểu thuyết
              </CardTitle>
              <CardDescription>Theo số chương</CardDescription>
            </CardHeader>
            <CardContent>
              {topNovels === undefined ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : topNovels.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Chưa có dữ liệu
                </p>
              ) : (
                <div className="space-y-1">
                  {topNovels.map((item, i) => (
                    <Link
                      key={item.novel.id}
                      href={`/novels/${item.novel.id}`}
                      className="flex items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {item.novel.title}
                      </span>
                      <Badge variant="secondary" className="text-[11px]">
                        {item.chapterCount} ch.
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick nav */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Truy cập nhanh</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                {QUICK_NAV.map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    asChild
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      {item.title}
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">
            {formatNumber(value)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
