import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  QTWorkerRequest,
  QTWorkerResponse,
  ConvertSegment,
  ConvertOptions,
  DictPair,
} from "@/lib/workers/qt-engine.types";
import { getDictEntriesForWorker } from "./use-dict-entries";

// ─── Reactive status store ───────────────────────────────────

export type DictLoadPhase = "idle" | "loading" | "initializing" | "ready" | "error";

interface QTEngineStatus {
  ready: boolean;
  phase: DictLoadPhase;
  loadingSource: string;
  loadingPercent: number;
  errorMessage: string | null;
  setReady: (ready: boolean) => void;
  setLoading: (source: string, percent: number) => void;
  setPhase: (phase: DictLoadPhase) => void;
  setError: (message: string) => void;
}

const useQTEngineStore = create<QTEngineStatus>((set) => ({
  ready: false,
  phase: "idle",
  loadingSource: "",
  loadingPercent: 0,
  errorMessage: null,
  setReady: (ready) => set({ ready, phase: ready ? "ready" : "idle" }),
  setLoading: (source, percent) => set({ phase: "loading", loadingSource: source, loadingPercent: percent }),
  setPhase: (phase) => set({ phase }),
  setError: (message) => set({ phase: "error", errorMessage: message }),
}));

/** React hook — triggers re-render when engine ready state changes */
export function useQTEngineReady(): boolean {
  return useQTEngineStore((s) => s.ready);
}

/** React hook — get full loading status for progress UI */
export function useQTEngineStatus() {
  return useQTEngineStore(
    useShallow((s) => ({
      phase: s.phase,
      loadingSource: s.loadingSource,
      loadingPercent: s.loadingPercent,
      errorMessage: s.errorMessage,
    })),
  );
}

/** Non-hook setters for use in DictInitializer */
export function setDictLoadProgress(source: string, percent: number) {
  useQTEngineStore.getState().setLoading(source, percent);
}
export function setDictLoadPhase(phase: DictLoadPhase) {
  useQTEngineStore.getState().setPhase(phase);
}
export function setDictLoadError(message: string) {
  useQTEngineStore.getState().setError(message);
}

// ─── Singleton Worker ────────────────────────────────────────

let worker: Worker | null = null;
let isReady = false;
let initPromise: Promise<void> | null = null;
const pendingCallbacks = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    onProgress?: (
      itemId: string,
      segments: ConvertSegment[],
      plainText: string,
    ) => void;
  }
>();

function send(msg: QTWorkerRequest) {
  worker?.postMessage(msg);
}

function handleMessage(event: MessageEvent<QTWorkerResponse>) {
  const msg = event.data;

  switch (msg.type) {
    case "ready":
      isReady = true;
      useQTEngineStore.getState().setReady(true);
      break;

    case "result": {
      const cb = pendingCallbacks.get(msg.id);
      if (cb) {
        pendingCallbacks.delete(msg.id);
        cb.resolve({ segments: msg.segments, plainText: msg.plainText });
      }
      break;
    }

    case "batch-progress": {
      const cb = pendingCallbacks.get(msg.id);
      cb?.onProgress?.(msg.itemId, msg.segments, msg.plainText);
      break;
    }

    case "batch-complete": {
      const cb = pendingCallbacks.get(msg.id);
      if (cb) {
        pendingCallbacks.delete(msg.id);
        cb.resolve(undefined);
      }
      break;
    }

    case "error": {
      const cb = pendingCallbacks.get(msg.id);
      if (cb) {
        pendingCallbacks.delete(msg.id);
        cb.reject(new Error(msg.message));
      }
      break;
    }
  }
}

// ─── Public API ──────────────────────────────────────────────

/** Internal: create worker and send dict data */
function startWorker(
  dictData: Record<string, Array<{ chinese: string; vietnamese: string }>>,
): Promise<void> {
  worker = new Worker(
    new URL("@/lib/workers/qt-engine.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = handleMessage;

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Worker init timeout")),
      30_000,
    );

    const origHandler = worker!.onmessage;
    worker!.onmessage = (event: MessageEvent<QTWorkerResponse>) => {
      if (event.data.type === "ready") {
        clearTimeout(timeout);
        isReady = true;
        useQTEngineStore.getState().setReady(true);
        worker!.onmessage = origHandler;
        resolve();
      } else if (event.data.type === "error") {
        clearTimeout(timeout);
        reject(new Error(event.data.message));
      }
    };

    send({ type: "init", dictData });
  });
}

/** Init engine by reading dict data from IDB (fallback path) */
export async function initQTEngine(): Promise<void> {
  if (isReady) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dictData = await getDictEntriesForWorker();
    await startWorker(dictData);
  })();

  return initPromise;
}

/** Init engine with pre-loaded dict data (fast path — skips IDB read) */
export async function initQTEngineWithData(
  dictData: Record<string, Array<{ chinese: string; vietnamese: string }>>,
): Promise<void> {
  if (isReady) return;
  if (initPromise) return initPromise;

  initPromise = startWorker(dictData);
  return initPromise;
}

export function isQTEngineReady(): boolean {
  return isReady;
}

export async function convertText(
  text: string,
  opts?: { novelNames?: DictPair[]; globalNames?: DictPair[]; options?: ConvertOptions },
): Promise<{ segments: ConvertSegment[]; plainText: string }> {
  if (!isReady) await initQTEngine();

  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    send({
      type: "convert",
      id,
      text,
      novelNames: opts?.novelNames,
      globalNames: opts?.globalNames,
      options: opts?.options,
    });
  });
}

export async function convertBatch(
  items: Array<{ itemId: string; text: string }>,
  opts?: {
    novelNames?: DictPair[];
    globalNames?: DictPair[];
    options?: ConvertOptions;
    onProgress?: (
      itemId: string,
      segments: ConvertSegment[],
      plainText: string,
    ) => void;
  },
): Promise<void> {
  if (!isReady) await initQTEngine();

  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      onProgress: opts?.onProgress,
    });
    send({
      type: "convert-batch",
      id,
      items,
      novelNames: opts?.novelNames,
      globalNames: opts?.globalNames,
      options: opts?.options,
    });
  });
}

export function terminateQTEngine(): void {
  worker?.terminate();
  worker = null;
  isReady = false;
  initPromise = null;
  pendingCallbacks.clear();
  useQTEngineStore.getState().setReady(false);
}
