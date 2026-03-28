/// <reference types="@webgpu/types" />
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WEBGPU_MODELS, type WebGPUModelInfo } from "@/lib/ai/webgpu-provider";
import {
  checkWebGPUSupport,
  formatBytes,
  type WebGPULimits,
} from "@/lib/ai/webgpu-utils";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DownloadIcon,
  LoaderIcon,
  TrashIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────

type ModelCacheStatus =
  | "unknown"
  | "checking"
  | "available"
  | "downloadable"
  | "unavailable";

interface ModelState {
  cacheStatus: ModelCacheStatus;
  downloading: boolean;
  progress: number;
  deleting: boolean;
  error?: string;
}

type GPUInfo =
  | { state: "checking" }
  | { state: "unsupported"; error: string }
  | { state: "ready"; adapterInfo?: GPUAdapterInfo; limits?: WebGPULimits };

// ─── Cache helpers ───────────────────────────────────────────

const TRANSFORMERS_CACHE = "transformers-cache";

/**
 * Check if a model has cached files in the browser Cache API.
 * Transformers.js stores ONNX shards under URLs like
 * https://huggingface.co/{org}/{model}/resolve/main/{file}
 */
async function isModelCached(modelId: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(TRANSFORMERS_CACHE);
    const requests = await cache.keys();
    return requests.some(
      (req) =>
        req.url.includes(encodeURIComponent(modelId).replace("%2F", "/")) ||
        req.url.includes(modelId),
    );
  } catch {
    return false;
  }
}

/**
 * Delete cached model files from the browser Cache API.
 */
async function deleteModelCache(modelId: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(TRANSFORMERS_CACHE);
    const requests = await cache.keys();
    let deleted = false;
    for (const req of requests) {
      if (req.url.includes(modelId)) {
        await cache.delete(req);
        deleted = true;
      }
    }
    return deleted;
  } catch {
    return false;
  }
}

// ─── Model Row ───────────────────────────────────────────────

function ModelRow({
  model,
  state,
  onLoad,
  onDelete,
}: {
  model: WebGPUModelInfo;
  state: ModelState;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const isCached = state.cacheStatus === "available";

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{model.name}</span>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {model.sizeLabel}
            </Badge>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              VRAM {model.requirements.vram}
            </Badge>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              RAM {model.requirements.ram}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {model.description}
          </p>
          {model.requirements.note && (
            <p className="mt-0.5 text-[11px] italic text-muted-foreground/60">
              {model.requirements.note}
            </p>
          )}
        </div>

        {/* Status indicator */}
        <div className="shrink-0">
          {state.cacheStatus === "checking" && (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}
          {isCached && (
            <Tooltip>
              <TooltipTrigger asChild>
                <CheckCircleIcon className="size-4 text-green-500" />
              </TooltipTrigger>
              <TooltipContent>Đã tải — sẵn sàng sử dụng</TooltipContent>
            </Tooltip>
          )}
          {state.cacheStatus === "downloadable" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <DownloadIcon className="size-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Chưa tải — cần tải về</TooltipContent>
            </Tooltip>
          )}
          {state.cacheStatus === "unavailable" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <XCircleIcon className="size-4 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>
                Không khả dụng (WebGPU không hỗ trợ)
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {state.downloading && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Đang tải model...</span>
            <span className="font-mono">{state.progress}%</span>
          </div>
          <Progress value={state.progress} className="h-1.5" />
        </div>
      )}

      {/* Error */}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        {!isCached &&
          !state.downloading &&
          state.cacheStatus !== "unavailable" && (
            <Button
              variant="outline"
              size="xs"
              onClick={onLoad}
              disabled={state.cacheStatus === "checking"}
            >
              <DownloadIcon className="size-3" />
              Tải model
            </Button>
          )}
        {isCached && !state.deleting && (
          <Button
            variant="outline"
            size="xs"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <TrashIcon className="size-3" />
            Xóa cache
          </Button>
        )}
        {state.deleting && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderIcon className="size-3 animate-spin" />
            Đang xóa...
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────

export function WebGPUModelManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [gpuInfo, setGpuInfo] = useState<GPUInfo>({ state: "checking" });
  const [modelStates, setModelStates] = useState<Record<string, ModelState>>(
    () =>
      Object.fromEntries(
        WEBGPU_MODELS.map((m) => [
          m.modelId,
          {
            cacheStatus: "checking" as ModelCacheStatus,
            downloading: false,
            progress: 0,
            deleting: false,
          },
        ]),
      ),
  );

  // Check GPU support on mount
  useEffect(() => {
    if (!open) return;
    checkWebGPUSupport().then((result) => {
      setGpuInfo(
        result.supported
          ? {
              state: "ready",
              adapterInfo: result.adapterInfo,
              limits: result.limits,
            }
          : { state: "unsupported", error: result.error ?? "" },
      );
    });
  }, [open]);

  // Check cache status for each model via Cache API
  useEffect(() => {
    if (!open) return;

    WEBGPU_MODELS.forEach(async (m) => {
      try {
        const cached = await isModelCached(m.modelId);
        setModelStates((prev) => ({
          ...prev,
          [m.modelId]: {
            ...prev[m.modelId],
            cacheStatus:
              gpuInfo.state === "unsupported"
                ? "unavailable"
                : cached
                  ? "available"
                  : "downloadable",
          },
        }));
      } catch {
        setModelStates((prev) => ({
          ...prev,
          [m.modelId]: { ...prev[m.modelId], cacheStatus: "unknown" },
        }));
      }
    });
  }, [open, gpuInfo.state]);

  const handleLoad = useCallback(async (modelId: string) => {
    setModelStates((prev) => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        downloading: true,
        progress: 0,
        error: undefined,
      },
    }));

    try {
      const { createWebGPUModelForDownload } = await import(
        "@/lib/ai/webgpu-provider"
      );
      const raw = createWebGPUModelForDownload(modelId);
      await raw.createSessionWithProgress((progress) => {
        setModelStates((prev) => ({
          ...prev,
          [modelId]: {
            ...prev[modelId],
            progress: Math.round(progress * 100),
          },
        }));
      });

      setModelStates((prev) => ({
        ...prev,
        [modelId]: {
          ...prev[modelId],
          downloading: false,
          progress: 100,
          cacheStatus: "available",
        },
      }));
    } catch (err) {
      setModelStates((prev) => ({
        ...prev,
        [modelId]: {
          ...prev[modelId],
          downloading: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }, []);

  const handleDelete = useCallback(async (modelId: string) => {
    setModelStates((prev) => ({
      ...prev,
      [modelId]: { ...prev[modelId], deleting: true, error: undefined },
    }));

    try {
      await deleteModelCache(modelId);
      setModelStates((prev) => ({
        ...prev,
        [modelId]: {
          ...prev[modelId],
          deleting: false,
          cacheStatus: "downloadable",
        },
      }));
    } catch (err) {
      setModelStates((prev) => ({
        ...prev,
        [modelId]: {
          ...prev[modelId],
          deleting: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quản lý Model WebGPU</DialogTitle>
          <DialogDescription>
            Tải trước hoặc xóa cache model AI trên trình duyệt.
          </DialogDescription>
        </DialogHeader>

        {/* GPU info */}
        <div className="mb-2">
          {gpuInfo.state === "checking" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderIcon className="size-3 animate-spin" />
              Đang kiểm tra GPU...
            </div>
          )}
          {gpuInfo.state === "ready" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircleIcon className="size-3 text-green-500" />
                <span>WebGPU sẵn sàng</span>
                {gpuInfo.adapterInfo?.description && (
                  <span className="truncate text-muted-foreground/70">
                    — {gpuInfo.adapterInfo.description}
                  </span>
                )}
              </div>
              {gpuInfo.limits && (
                <div className="flex gap-3 text-[11px] text-muted-foreground/70 font-mono">
                  <span>
                    maxBufferSize:{" "}
                    {formatBytes(gpuInfo.limits.maxBufferSize)}
                  </span>
                  <span>
                    maxStorageBuffer:{" "}
                    {formatBytes(gpuInfo.limits.maxStorageBufferBindingSize)}
                  </span>
                </div>
              )}
            </div>
          )}
          {gpuInfo.state === "unsupported" && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-xs">
              <div className="flex items-center gap-2 text-destructive">
                <XCircleIcon className="size-3" />
                WebGPU không khả dụng
              </div>
              <p className="mt-1 text-muted-foreground">{gpuInfo.error}</p>
            </div>
          )}
        </div>

        {/* Model list */}
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {WEBGPU_MODELS.map((model) => (
            <ModelRow
              key={model.modelId}
              model={model}
              state={
                modelStates[model.modelId] ?? {
                  cacheStatus: "unknown",
                  downloading: false,
                  progress: 0,
                  deleting: false,
                }
              }
              onLoad={() => handleLoad(model.modelId)}
              onDelete={() => handleDelete(model.modelId)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact inline badge showing WebGPU status for provider cards.
 */
export function WebGPUStatusBadge() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    checkWebGPUSupport().then((r) => setSupported(r.supported));
  }, []);

  if (supported === null) return null;

  return supported ? (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <span className="size-1.5 rounded-full bg-green-500" />
      WebGPU
    </Badge>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 text-[10px] text-amber-500">
          <AlertTriangleIcon className="size-2.5" />
          WebGPU
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        WebGPU không được hỗ trợ trên trình duyệt này
      </TooltipContent>
    </Tooltip>
  );
}
