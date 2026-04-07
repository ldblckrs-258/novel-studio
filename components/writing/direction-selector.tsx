"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { DirectionOption } from "@/lib/writing/types";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

const DIRECTION_TYPE_LABELS: Record<string, { label: string; color: string }> =
  {
    action: {
      label: "Hành động",
      color: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    "character-development": {
      label: "Nhân vật",
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    "plot-twist": {
      label: "Bất ngờ",
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    "world-building": {
      label: "Thế giới",
      color: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    resolution: {
      label: "Giải quyết",
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
  };

export function DirectionSelector({
  options,
  recommendedOptionIds,
  onConfirm,
  onRegenerateAction,
  isLoading,
}: {
  options: DirectionOption[];
  recommendedOptionIds?: string[];
  onConfirm: (selectedDirections: string[]) => void;
  onRegenerateAction?: () => void;
  isLoading?: boolean;
}) {
  const recommended = new Set(recommendedOptionIds ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customDirections, setCustomDirections] = useState<DirectionOption[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const allOptions = [...options, ...customDirections];

  const toggleOption = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustomDirection = () => {
    const text = customInput.trim();
    if (!text) return;
    const id = `custom-${Date.now()}`;
    const newDir: DirectionOption = {
      id,
      title: "Tùy chỉnh",
      description: text,
      characters: [],
      plotImpact: "",
      type: "character-development",
    };
    setCustomDirections((prev) => [...prev, newDir]);
    setSelected((prev) => new Set(prev).add(id));
    setCustomInput("");
    setShowCustom(false);
  };

  const handleConfirm = () => {
    const directions = allOptions
      .filter((o) => selected.has(o.id))
      .map((o) => `${o.title}: ${o.description}`);
    if (directions.length === 0) return;
    onConfirm(directions);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Chọn hướng đi cho chương mới</h3>
        {onRegenerateAction && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerateAction}
            disabled={isLoading}
            className="h-7 gap-1 text-xs text-muted-foreground"
          >
            <RefreshCwIcon className="h-3 w-3" />
            Tạo lại
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {allOptions.map((option) => {
          const typeConf = option.type
            ? DIRECTION_TYPE_LABELS[option.type]
            : undefined;
          return (
          <Card
            key={option.id}
            className={`cursor-pointer transition-colors gap-2 ${
              selected.has(option.id)
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => toggleOption(option.id)}
          >
            <CardHeader className="px-4">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary flex items-center justify-center"
                  aria-checked={selected.has(option.id)}
                >
                  {selected.has(option.id) && (
                    <svg
                      className="h-3 w-3 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {option.title}
                    </CardTitle>
                    {recommended.has(option.id) && (
                      <span className="rounded-full bg-linear-to-r from-purple-600 via-pink-600 to-red-600 px-2 py-0.5 text-[10px] font-medium text-white">
                        Gợi ý AI
                      </span>
                    )}
                    {typeConf && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeConf.color}`}
                      >
                        {typeConf.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="flex flex-wrap gap-1.5">
                {option.characters.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground italic">
                {option.plotImpact}
              </p>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {showCustom ? (
        <div className="space-y-2">
          <Textarea
            placeholder="Mô tả hướng đi tùy chỉnh..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={addCustomDirection}
              disabled={!customInput.trim()}
            >
              <PlusIcon className="h-3.5 w-3.5 mr-1" />
              Thêm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCustom(false);
                setCustomInput("");
              }}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCustom(true)}
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Thêm hướng đi tùy chỉnh
        </Button>
      )}

      <Button
        onClick={handleConfirm}
        disabled={isLoading || selected.size === 0}
        className="w-full"
      >
        Xác nhận ({selected.size} hướng đi)
      </Button>
    </div>
  );
}
