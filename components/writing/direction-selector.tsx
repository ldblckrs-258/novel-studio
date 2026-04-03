"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { DirectionOption } from "@/lib/writing/types";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

export function DirectionSelector({
  options,
  onConfirm,
  onRegenerateAction,
  isLoading,
}: {
  options: DirectionOption[];
  onConfirm: (selectedDirections: string[]) => void;
  onRegenerateAction?: () => void;
  isLoading?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customDirection, setCustomDirection] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const toggleOption = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const directions = options
      .filter((o) => selected.has(o.id))
      .map((o) => `${o.title}: ${o.description}`);
    if (customDirection.trim()) {
      directions.push(customDirection.trim());
    }
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
        {options.map((option) => (
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
                    <svg className="h-3 w-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-sm font-medium">
                    {option.title}
                  </CardTitle>
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
        ))}
      </div>

      {showCustom ? (
        <Textarea
          placeholder="Mô tả hướng đi tùy chỉnh..."
          value={customDirection}
          onChange={(e) => setCustomDirection(e.target.value)}
          rows={3}
        />
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
        disabled={isLoading || (selected.size === 0 && !customDirection.trim())}
        className="w-full"
      >
        Xác nhận ({selected.size + (customDirection.trim() ? 1 : 0)} hướng đi)
      </Button>
    </div>
  );
}
