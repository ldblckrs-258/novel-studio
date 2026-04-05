"use client";

import { ChapterSelectDialog } from "@/components/reader/chapter-select-dialog";
import { SentenceRenderer } from "@/components/reader/sentence-renderer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useChapters, useNovel, useScenes } from "@/lib/hooks";
import { useMediaSession } from "@/lib/hooks/use-media-session";
import { useReaderPanel } from "@/lib/stores/reader-panel";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

function ChapterContent({
  chapterId,
  readerOpen,
  chapterHeader,
}: {
  chapterId: string;
  readerOpen: boolean;
  chapterHeader?: string;
}) {
  const scenes = useScenes(chapterId);
  if (!scenes) return <Skeleton className="h-64 w-full" />;
  const text = scenes.map((s) => s.content).join("\n\n");

  if (!text) {
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
        <p className="italic text-muted-foreground">
          Chương này chưa có nội dung.
        </p>
      </div>
    );
  }

  if (readerOpen) {
    const ttsContent = chapterHeader ? `${chapterHeader}\n\n${text}` : text;
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <SentenceRenderer content={ttsContent} />
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
      {text}
    </div>
  );
}

export default function ReadingView() {
  const { id, order } = useParams<{ id: string; order: string }>();
  const router = useRouter();
  const novel = useNovel(id);
  const chapters = useChapters(id);
  const isReaderOpen = useReaderPanel((s) => s.isOpen);

  // order is 1-based in the URL → convert to 0-based index
  const orderNum = parseInt(order, 10);
  const requestedIndex = isNaN(orderNum) || orderNum < 1 ? 0 : orderNum - 1;
  const clampedIndex = chapters
    ? Math.min(requestedIndex, Math.max(0, chapters.length - 1))
    : requestedIndex;

  const chapter = chapters?.[clampedIndex];
  const hasPrev = clampedIndex > 0;
  const hasNext = chapters ? clampedIndex < chapters.length - 1 : false;

  const navigateTo = (index: number) => {
    router.push(`/novels/${id}/read/${index + 1}`);
  };

  // Redirect to valid order if out of range
  useEffect(() => {
    if (!chapters || chapters.length === 0) return;
    if (isNaN(orderNum) || clampedIndex !== requestedIndex) {
      router.replace(`/novels/${id}/read/${clampedIndex + 1}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters?.length, clampedIndex, requestedIndex, orderNum, id, router]);

  // Sync store whenever the chapter changes (URL is source of truth here)
  useEffect(() => {
    if (!novel || !chapters || chapters.length === 0) return;
    useReaderPanel.getState().setNovelContext({
      novelId: id,
      novelTitle: novel.title,
      totalChapters: chapters.length,
      chapterIndex: clampedIndex,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, novel?.title, chapters?.length, clampedIndex]);

  // Keep chapter title in sync
  useEffect(() => {
    if (chapter?.title) {
      useReaderPanel.getState().setChapterTitle(chapter.title);
    }
  }, [chapter?.title]);

  useMediaSession({
    novelTitle: novel?.title ?? "",
    chapterTitle: chapter?.title ?? "",
    chapterNumber: clampedIndex + 1,
    hasPrev,
    hasNext,
    onPrev: () => useReaderPanel.getState().prevChapter(),
    onNext: () => useReaderPanel.getState().nextChapter(),
  });

  if (novel === undefined || !chapters) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (!novel) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <p className="text-muted-foreground">Không tìm thấy tiểu thuyết.</p>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100svh-3rem)] flex-col overflow-hidden px-6 py-4">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/novels/${id}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          {novel.title}
        </span>
        {chapter && (
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            title="Chỉnh sửa chương"
          >
            <Link href={`/novels/${id}/chapters/${chapter.id}`}>
              <PencilIcon className="size-4" />
            </Link>
          </Button>
        )}
        <ChapterSelectDialog
          chapters={chapters}
          currentIndex={clampedIndex}
          onSelect={navigateTo}
        />
      </div>

      {/* Chapter content */}
      {chapter && (
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-3xl pb-12">
            <h2 className="mb-6 text-center font-heading text-2xl font-bold">
              {chapter.title}
            </h2>
            <ChapterContent
              chapterId={chapter.id}
              readerOpen={isReaderOpen}
              chapterHeader={`Chương ${clampedIndex + 1}: ${chapter.title}`}
            />
          </div>
        </ScrollArea>
      )}

      {/* Navigation */}
      <div className="flex shrink-0 items-center justify-between border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => navigateTo(clampedIndex - 1)}
        >
          <ChevronLeftIcon className="mr-1 size-4" />
          Trước
        </Button>
        <span className="text-xs text-muted-foreground">
          {clampedIndex + 1} / {chapters.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => navigateTo(clampedIndex + 1)}
        >
          Tiếp
          <ChevronRightIcon className="ml-1 size-4" />
        </Button>
      </div>
    </main>
  );
}
