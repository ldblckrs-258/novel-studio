"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteChapterPlan, updateChapterPlan } from "@/lib/hooks";
import type { ChapterPlan, ChapterPlanScene } from "@/lib/db";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

function SceneEditor({
  scene,
  index,
  onChange,
  onDelete,
}: {
  scene: ChapterPlanScene;
  index: number;
  onChange: (updated: ChapterPlanScene) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2 pt-1 pb-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tiêu đề</Label>
          <Input
            value={scene.title}
            onChange={(e) => onChange({ ...scene, title: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Địa điểm</Label>
          <Input
            value={scene.location ?? ""}
            onChange={(e) =>
              onChange({ ...scene, location: e.target.value || undefined })
            }
            className="h-7 text-xs"
            placeholder="Tùy chọn"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Tóm tắt phân cảnh
        </Label>
        <Textarea
          value={scene.summary}
          onChange={(e) => onChange({ ...scene, summary: e.target.value })}
          rows={3}
          className="text-xs resize-y"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Nhân vật (phẩy)
          </Label>
          <Input
            value={scene.characters.join(", ")}
            onChange={(e) =>
              onChange({
                ...scene,
                characters: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="h-7 text-xs"
            placeholder="A, B, C"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tâm trạng</Label>
          <Input
            value={scene.mood ?? ""}
            onChange={(e) =>
              onChange({ ...scene, mood: e.target.value || undefined })
            }
            className="h-7 text-xs"
            placeholder="Tùy chọn"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2Icon className="h-3 w-3 mr-1" />
          Xóa phân cảnh {index + 1}
        </Button>
      </div>
    </div>
  );
}

export function EditChapterPlanDialog({
  plan,
  open,
  onOpenChangeAction,
}: {
  plan: ChapterPlan | null;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [directions, setDirections] = useState<string[]>([]);
  const [outline, setOutline] = useState("");
  const [scenes, setScenes] = useState<ChapterPlanScene[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setTitle(plan.title ?? "");
      setDirections(plan.directions.length > 0 ? plan.directions : [""]);
      setOutline(plan.outline ?? "");
      setScenes(plan.scenes ?? []);
    }
  }, [plan]);

  if (!plan) return null;

  const handleDirectionChange = (i: number, value: string) => {
    setDirections((prev) => prev.map((d, idx) => (idx === i ? value : d)));
  };

  const handleDirectionDelete = (i: number) => {
    setDirections((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length > 0 ? next : [""];
    });
  };

  const handleSceneChange = (i: number, updated: ChapterPlanScene) => {
    setScenes((prev) => prev.map((s, idx) => (idx === i ? updated : s)));
  };

  const handleSceneDelete = (i: number) => {
    setScenes((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleAddScene = () => {
    setScenes((prev) => [
      ...prev,
      {
        title: "",
        summary: "",
        characters: [],
        location: undefined,
        mood: undefined,
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateChapterPlan(plan.id, {
        title: title.trim() || undefined,
        directions: directions.map((d) => d.trim()).filter(Boolean),
        outline: outline.trim(),
        scenes,
      });
      onOpenChangeAction(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b">
          <DialogTitle>
            Chỉnh sửa — Chương {plan.chapterOrder}
            {title ? `: ${title}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div
          className="overflow-y-auto px-6 py-4 space-y-5"
          style={{ maxHeight: "calc(90vh - 140px)" }}
        >
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tiêu đề chương</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Chương ${plan.chapterOrder}`}
              className="h-8"
            />
          </div>

          {/* Directions */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Hướng đi</Label>
            <div className="space-y-2">
              {directions.map((d, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Textarea
                    value={d}
                    onChange={(e) => handleDirectionChange(i, e.target.value)}
                    rows={2}
                    className="text-xs resize-y flex-1"
                    placeholder={`Hướng đi ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDirectionDelete(i)}
                    disabled={directions.length === 1 && d === ""}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDirections((prev) => [...prev, ""])}
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              Thêm hướng đi
            </Button>
          </div>

          {/* Outline */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tóm tắt giàn ý</Label>
            <Textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              rows={4}
              className="text-xs resize-y"
              placeholder="Tóm tắt tổng quan chương..."
            />
          </div>

          {/* Scenes */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Phân cảnh ({scenes.length})
            </Label>
            {scenes.length > 0 ? (
              <Accordion type="multiple" className="border rounded-md divide-y">
                {scenes.map((scene, i) => (
                  <AccordionItem key={i} value={String(i)} className="border-0">
                    <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline rounded-none">
                      <span className="font-medium mr-1">{i + 1}.</span>
                      <span className="text-muted-foreground truncate flex-1">
                        {scene.title || `(chưa đặt tên)`}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 border-t">
                      <SceneEditor
                        scene={scene}
                        index={i}
                        onChange={(updated) => handleSceneChange(i, updated)}
                        onDelete={() => handleSceneDelete(i)}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="text-xs text-muted-foreground">
                Chưa có phân cảnh.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleAddScene}
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              Thêm phân cảnh
            </Button>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t m-0 flex !justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={saving}
            onClick={async () => {
              await deleteChapterPlan(plan.id);
              toast.success(`Đã xóa chương ${plan.chapterOrder}`);
              onOpenChangeAction(false);
            }}
          >
            <Trash2Icon className="h-3.5 w-3.5 mr-1" />
            Xóa
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChangeAction(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
