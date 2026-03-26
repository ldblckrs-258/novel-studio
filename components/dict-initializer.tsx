"use client";

import { useEffect } from "react";
import { loadDictDataForWorker } from "@/lib/hooks/use-dict-entries";
import {
  initQTEngineWithData,
  setDictLoadProgress,
  setDictLoadPhase,
  setDictLoadError,
} from "@/lib/hooks/use-qt-engine";

export function DictInitializer() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setDictLoadPhase("loading");

        // Load dict data (from cache or parallel fetch — no IDB roundtrip)
        const dictData = await loadDictDataForWorker((source, percent) => {
          if (!cancelled) setDictLoadProgress(source, percent);
        });

        if (cancelled) return;

        // Init worker directly with the data we already have
        setDictLoadPhase("initializing");
        await initQTEngineWithData(dictData);
      } catch (err) {
        console.error("Dict initialization failed:", err);
        if (!cancelled) {
          setDictLoadError(
            err instanceof Error ? err.message : "Lỗi không xác định",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
