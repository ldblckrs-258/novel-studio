"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createNovel } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#78716c", // stone
];

export function CreateNovelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[5]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setAuthor("");
    setSourceUrl("");
    setColor(PRESET_COLORS[5]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const id = await createNovel({
        title: title.trim(),
        description: description.trim(),
        color,
        author: author.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
      });
      toast.success(`Đã tạo "${title.trim()}"`);
      reset();
      onOpenChange(false);
      router.push(`/novels/${id}`);
    } catch {
      toast.error("Tạo tiểu thuyết thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo tiểu thuyết mới</DialogTitle>
          <DialogDescription>
            Bắt đầu một câu chuyện mới từ đầu.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="novel-title">
                Tiêu đề <span className="text-destructive">*</span>
              </Label>
              <Input
                id="novel-title"
                placeholder="Tên tiểu thuyết"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5"
                autoFocus
                required
              />
            </div>

            <div>
              <Label htmlFor="novel-description">Mô tả</Label>
              <Textarea
                id="novel-description"
                placeholder="Mô tả ngắn gọn về câu chuyện..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="novel-author">Tác giả</Label>
              <Input
                id="novel-author"
                placeholder="Tên tác giả"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="novel-source">
                Đường dẫn truyện gốc{" "}
                <span className="text-muted-foreground font-normal">
                  (tùy chọn)
                </span>
              </Label>
              <Input
                id="novel-source"
                type="url"
                placeholder="https://..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Màu sắc</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "size-7 rounded-full border-2 transition-all hover:scale-110",
                      color === c
                        ? "border-foreground ring-2 ring-foreground/20"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
                <label
                  className={cn(
                    "relative flex size-7 cursor-pointer items-center justify-center rounded-full border-2 transition-all hover:scale-110 border-dashed",
                    !PRESET_COLORS.includes(color)
                      ? "border-foreground ring-2 ring-foreground/20"
                      : "border-muted-foreground/30",
                  )}
                  style={{
                    background: !PRESET_COLORS.includes(color)
                      ? color
                      : `transparent`,
                  }}
                  aria-label="Chọn màu tùy chỉnh"
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? "Đang tạo..." : "Tạo tiểu thuyết"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
