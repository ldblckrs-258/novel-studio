"use client";

import { getOrCreateWritingSettings } from "@/lib/hooks";
import { useEffect, useState } from "react";
import { ConfigEditor } from "./config-editor";
import { ConfigTree } from "./config-tree";
import type { ConfigItemId } from "./types";

const GLOBAL_DEFAULT_ID = "global-default";

const AUTOWRITE_ITEMS = new Set<ConfigItemId>([
  "autowrite-setup",
  "autowrite-context",
  "autowrite-direction",
  "autowrite-outline",
  "autowrite-writer",
  "autowrite-review",
  "autowrite-rewrite",
]);

export function AIConfigPage() {
  const [selected, setSelected] = useState<ConfigItemId>("global-instruction");

  // Ensure global-default WritingSettings record exists when navigating to autowrite items
  useEffect(() => {
    if (AUTOWRITE_ITEMS.has(selected)) {
      void getOrCreateWritingSettings(GLOBAL_DEFAULT_ID);
    }
  }, [selected]);

  return (
    <div className="flex h-full min-h-0">
      {/* Left tree panel */}
      <aside className="w-64 shrink-0 overflow-y-auto border-r bg-muted/20">
        <div className="sticky top-0 border-b bg-background/80 px-3 py-2.5 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Cấu hình
          </p>
        </div>
        <ConfigTree selected={selected} onSelect={setSelected} />
      </aside>

      {/* Right editor panel */}
      <main className="min-w-0 flex-1">
        <ConfigEditor key={selected} item={selected} />
      </main>
    </div>
  );
}
