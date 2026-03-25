"use client";

import { CreateNovelDialog } from "@/components/create-novel-dialog";
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
import { useNovels } from "@/lib/hooks";
import { BookOpenIcon, PlusIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function DashboardPage() {
  const novels = useNovels();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Chào mừng trở lại
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tiếp tục nơi bạn đã dừng lại, hoặc bắt đầu một câu chuyện mới.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          className="cursor-pointer border-dashed transition-colors hover:border-foreground/20 hover:bg-muted/50"
          onClick={() => setCreateOpen(true)}
        >
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <PlusIcon className="size-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Tiểu thuyết mới</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bắt đầu một câu chuyện mới
            </p>
          </CardContent>
        </Card>

        <Link href="/import" className="sm:col-span-1 lg:col-span-2">
          <Card className="h-full cursor-pointer border-dashed transition-colors hover:border-foreground/20 hover:bg-muted/50">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <UploadIcon className="size-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Nhập tiểu thuyết</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tải lên hoặc dán văn bản có sẵn
              </p>
            </CardContent>
          </Card>
        </Link>

        {novels === undefined ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))
        ) : novels.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BookOpenIcon />
                  </EmptyMedia>
                  <EmptyTitle>Thư viện trống</EmptyTitle>
                  <EmptyDescription>
                    Tạo tiểu thuyết đầu tiên hoặc nhập từ nguồn có sẵn.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          novels.slice(0, 5).map((novel) => (
            <Link key={novel.id} href={`/novels/${novel.id}`}>
              <Card className="relative h-full overflow-hidden transition-colors hover:bg-muted/30">
                {novel.color && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: novel.color }}
                  />
                )}
                <CardHeader>
                  <CardTitle>{novel.title}</CardTitle>
                  {novel.author && (
                    <CardDescription>{novel.author}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {novel.genres && novel.genres.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {novel.genres.slice(0, 3).map((g) => (
                        <Badge
                          key={g}
                          variant="secondary"
                          className="text-[11px]"
                        >
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {novel.description || "Chưa có mô tả."}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {novels && novels.length > 0 && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" asChild>
            <a href="/library">Xem tất cả tiểu thuyết</a>
          </Button>
        </div>
      )}

      <CreateNovelDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}
