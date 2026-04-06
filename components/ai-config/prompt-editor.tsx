"use client";

import { Button } from "@/components/ui/button";
import { LineEditor } from "@/components/ui/line-editor";
import { cn } from "@/lib/utils";
import { RotateCcwIcon } from "lucide-react";

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  onReset?: () => void;
  isCustom?: boolean;
  placeholder?: string;
  className?: string;
}

export function PromptEditor({
  value,
  onChange,
  onReset,
  isCustom = false,
  placeholder,
  className,
}: PromptEditorProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {onReset && (
        <div className="flex items-center justify-end -mt-7.25">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1 text-xs",
              isCustom
                ? "text-muted-foreground hover:text-foreground"
                : "invisible",
            )}
            onClick={onReset}
            disabled={!isCustom}
          >
            <RotateCcwIcon className="h-3 w-3" />
            Khôi phục mặc định
          </Button>
        </div>
      )}
      <LineEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-[max(calc(100svh-420px),300px)] bg-background"
        contentFont="text-xs leading-5"
        gutterFont="text-xs leading-5"
        xmlColors
      />
      {!isCustom && (
        <p className="text-xs text-muted-foreground">
          Đang dùng prompt mặc định. Chỉnh sửa để tùy biến.
        </p>
      )}
    </div>
  );
}
