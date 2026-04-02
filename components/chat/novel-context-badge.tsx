"use client";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { updateConversation } from "@/lib/hooks";
import { useChatPanel } from "@/lib/stores/chat-panel";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpenIcon, XIcon } from "lucide-react";

export function NovelContextBadge() {
  const {
    attachedNovelId,
    attachedChapterId,
    activeConversationId,
    detachNovel,
  } = useChatPanel();

  const novel = useLiveQuery(
    () => (attachedNovelId ? db.novels.get(attachedNovelId) : undefined),
    [attachedNovelId],
  );

  const chapter = useLiveQuery(
    () => (attachedChapterId ? db.chapters.get(attachedChapterId) : undefined),
    [attachedChapterId],
  );

  if (!attachedNovelId || !novel) return null;

  const handleDetach = async () => {
    detachNovel();
    if (activeConversationId) {
      await updateConversation(activeConversationId, {
        novelId: undefined,
        chapterId: undefined,
      });
    }
  };

  const label = chapter
    ? `${novel.title} (Ch .${chapter.order + 1})`
    : novel.title;

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-t bg-muted/30 px-3 py-1.5">
      <BookOpenIcon className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs text-muted-foreground" title={label}>
        {label}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="ml-auto size-5 shrink-0"
        onClick={handleDetach}
        title="Gỡ tiểu thuyết đính kèm"
      >
        <XIcon className="size-3" />
      </Button>
    </div>
  );
}
