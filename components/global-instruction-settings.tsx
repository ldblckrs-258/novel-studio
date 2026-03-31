"use client";

import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDebouncedCallback } from "@/lib/hooks/use-debounce";
import { useChatSettings, updateChatSettings } from "@/lib/hooks";
import { useEffect, useRef, useState } from "react";

export function GlobalInstructionSettings() {
  const settings = useChatSettings();
  const [value, setValue] = useState("");
  const initialized = useRef(false);

  // Sync from DB on initial load (useLiveQuery is async)
  useEffect(() => {
    if (!initialized.current && settings.globalSystemInstruction !== undefined) {
      setValue(settings.globalSystemInstruction ?? "");
      initialized.current = true;
    }
  }, [settings.globalSystemInstruction]);

  const save = useDebouncedCallback((v: string) => {
    updateChatSettings({
      globalSystemInstruction: v.trim() || undefined,
    });
  }, 600);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    initialized.current = true;
    setValue(e.target.value);
    save.run(e.target.value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chỉ thị hệ thống chung</CardTitle>
        <CardDescription>
          Chỉ thị này được thêm vào đầu mọi system prompt — cả trò chuyện và
          phân tích. Sử dụng cho tùy chọn ngôn ngữ, giọng điệu, hoặc ràng buộc
          cần luôn áp dụng. Tự động lưu khi chỉnh sửa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="VD: Luôn trả lời bằng Tiếng Việt. Sử dụng giọng văn trang trọng."
          value={value}
          onChange={handleChange}
          className="min-h-[100px] font-mono text-sm"
        />
      </CardContent>
    </Card>
  );
}
