"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { updateNovel } from "@/lib/hooks";
import { type Novel } from "@/lib/db";
import { cn } from "@/lib/utils";
import { PlusIcon, XIcon } from "lucide-react";

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

export function EditNovelDialog({
  open,
  onOpenChange,
  novel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novel: Novel;
}) {
  const [title, setTitle] = useState(novel.title);
  const [description, setDescription] = useState(novel.description);
  const [author, setAuthor] = useState(novel.author ?? "");
  const [sourceUrl, setSourceUrl] = useState(novel.sourceUrl ?? "");
  const [color, setColor] = useState(novel.color ?? PRESET_COLORS[5]);
  const [genres, setGenres] = useState<string[]>(novel.genres ?? []);
  const [tags, setTags] = useState<string[]>(novel.tags ?? []);
  const [saving, setSaving] = useState(false);

  // Sync state when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(novel.title);
      setDescription(novel.description);
      setAuthor(novel.author ?? "");
      setSourceUrl(novel.sourceUrl ?? "");
      setColor(novel.color ?? PRESET_COLORS[5]);
      setGenres(novel.genres ?? []);
      setTags(novel.tags ?? []);
    }
  }, [open, novel]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      await updateNovel(novel.id, {
        title: title.trim(),
        description: description.trim(),
        color,
        author: author.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        genres,
        tags,
      });

      toast.success("Đã cập nhật tiểu thuyết");
      onOpenChange(false);
    } catch {
      toast.error("Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tiểu thuyết</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin tiểu thuyết.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-novel-title">
                Tiêu đề <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-novel-title"
                placeholder="Tên tiểu thuyết"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5"
                autoFocus
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-novel-description">Mô tả</Label>
              <Textarea
                id="edit-novel-description"
                placeholder="Mô tả ngắn gọn về câu chuyện..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="edit-novel-author">Tác giả</Label>
              <Input
                id="edit-novel-author"
                placeholder="Tên tác giả"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="edit-novel-source">
                Đường dẫn truyện gốc{" "}
                <span className="text-muted-foreground font-normal">
                  (tùy chọn)
                </span>
              </Label>
              <Input
                id="edit-novel-source"
                type="url"
                placeholder="https://..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="mt-1.5"
              />
            </div>

            {/* Genres */}
            <div>
              <Label>Thể loại</Label>
              <BadgeListEditor
                values={genres}
                onChange={setGenres}
                variant="default"
              />
            </div>

            {/* Tags */}
            <div>
              <Label>Nhãn</Label>
              <BadgeListEditor
                values={tags}
                onChange={setTags}
                variant="secondary"
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
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
                <label
                  className={cn(
                    "relative flex size-7 cursor-pointer items-center justify-center rounded-full border-2 transition-all hover:scale-110",
                    !PRESET_COLORS.includes(color)
                      ? "border-foreground ring-2 ring-foreground/20"
                      : "border-muted-foreground/30"
                  )}
                  style={{
                    background: !PRESET_COLORS.includes(color)
                      ? color
                      : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
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
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline badge list editor ───────────────────────────────

function BadgeListEditor({
  values,
  onChange,
  variant = "default",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  variant?: "default" | "secondary" | "outline";
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setNewValue("");
    setAdding(false);
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {values.map((v, i) => (
        <Badge key={`${v}-${i}`} variant={variant} className="gap-1 pr-1">
          {v}
          <button
            type="button"
            onClick={() => handleRemove(i)}
            className="ml-0.5 rounded-sm p-0.5 opacity-50 transition-opacity hover:opacity-100"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      {adding ? (
        <Input
          ref={inputRef}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
            if (e.key === "Escape") {
              setNewValue("");
              setAdding(false);
            }
          }}
          onBlur={handleAdd}
          placeholder="Nhập và nhấn Enter"
          className="h-6 w-32 text-xs"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-6 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          Thêm
        </button>
      )}
    </div>
  );
}
