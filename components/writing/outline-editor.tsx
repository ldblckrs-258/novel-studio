"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OutlineScene } from "@/lib/writing/types";
import { CheckIcon, PenLineIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

interface EditableScene extends OutlineScene {
  isEditing: boolean;
}

export function OutlineEditor({
  chapterTitle,
  synopsis,
  scenes: initialScenes,
  onApprove,
  onRegenerateAction,
  isLoading,
}: {
  chapterTitle: string;
  synopsis: string;
  scenes: OutlineScene[];
  onApprove: (scenes: OutlineScene[]) => void;
  onRegenerateAction?: () => void;
  isLoading?: boolean;
}) {
  const [scenes, setScenes] = useState<EditableScene[]>(() =>
    initialScenes.map((s) => ({ ...s, isEditing: false })),
  );

  const toggleEdit = (index: number) => {
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, isEditing: !s.isEditing } : s)),
    );
  };

  const updateScene = (
    index: number,
    field: keyof OutlineScene,
    value: string | string[] | number,
  ) => {
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const handleApprove = () => {
    const cleaned = scenes.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ isEditing, ...scene }) => scene,
    );
    onApprove(cleaned);
  };

  const totalWords = scenes.reduce((sum, s) => sum + s.wordCountTarget, 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{chapterTitle}</h3>
          {onRegenerateAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerateAction}
              disabled={isLoading}
              className="h-7 shrink-0 gap-1 text-xs text-muted-foreground"
            >
              <RefreshCwIcon className="h-3 w-3" />
              Tạo lại
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{synopsis}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Tổng: ~{totalWords} từ &middot; {scenes.length} phân cảnh
        </p>
      </div>


      <div className="space-y-3">
        {scenes.map((scene, i) => (
          <Card key={i}>
            <CardHeader className="px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {i + 1}.{" "}
                  {scene.isEditing ? (
                    <Input
                      value={scene.title}
                      onChange={(e) => updateScene(i, "title", e.target.value)}
                      className="inline-block h-7 w-auto text-sm font-medium"
                    />
                  ) : (
                    scene.title
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    ~{scene.wordCountTarget} từ
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-6"
                    onClick={() => toggleEdit(i)}
                  >
                    {!scene.isEditing ? (
                      <PenLineIcon className="h-3 w-3" />
                    ) : (
                      <CheckIcon className="h-3 w-3 text-green-600" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-0 space-y-2">
              {scene.isEditing ? (
                <Textarea
                  value={scene.summary}
                  onChange={(e) => updateScene(i, "summary", e.target.value)}
                  rows={3}
                  className="text-xs"
                />
              ) : (
                <p className="text-xs text-muted-foreground">{scene.summary}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {scene.characters.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs"
                  >
                    {c}
                  </span>
                ))}
                {scene.mood && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs">
                    {scene.mood}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={handleApprove} disabled={isLoading} className="w-full">
        <PenLineIcon className="h-4 w-4 mr-2" />
        Duyệt & Bắt đầu viết
      </Button>
    </div>
  );
}
