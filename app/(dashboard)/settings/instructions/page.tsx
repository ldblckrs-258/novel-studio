"use client";

import { AIConfigPage } from "@/components/ai-config/ai-config-page";

export default function InstructionsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-6 py-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Cài đặt AI
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cấu hình mô hình, nhà cung cấp và system prompt cho từng tính năng AI.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <AIConfigPage />
      </div>
    </div>
  );
}
