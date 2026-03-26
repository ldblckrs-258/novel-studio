"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { ConvertOptions } from "@/lib/workers/qt-engine.types";
import { DEFAULT_CONVERT_OPTIONS } from "@/lib/workers/qt-engine.types";

const SINGLETON_ID = "convert-settings";

export function useConvertSettings(): ConvertOptions {
  const row = useLiveQuery(() => db.convertSettings.get(SINGLETON_ID), []);
  if (!row) return DEFAULT_CONVERT_OPTIONS;
  return {
    nameVsPriority: row.nameVsPriority as ConvertOptions["nameVsPriority"],
    scopePriority: row.scopePriority as ConvertOptions["scopePriority"],
    maxPhraseLength: row.maxPhraseLength,
    vpLengthPriority: row.vpLengthPriority as ConvertOptions["vpLengthPriority"],
    luatNhanMode: row.luatNhanMode as ConvertOptions["luatNhanMode"],
    splitMode: row.splitMode as ConvertOptions["splitMode"],
  };
}

export async function updateConvertSettings(
  patch: Partial<ConvertOptions>,
): Promise<void> {
  const existing = await db.convertSettings.get(SINGLETON_ID);
  if (existing) {
    await db.convertSettings.update(SINGLETON_ID, patch);
  } else {
    await db.convertSettings.put({
      id: SINGLETON_ID,
      ...DEFAULT_CONVERT_OPTIONS,
      ...patch,
    });
  }
}
