import {
  transformersJS,
  type TransformersJSLanguageModel,
  type TransformersJSModelSettings,
} from "@browser-ai/transformers-js";
import {
  extractJsonMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";

/**
 * Curated list of tested WebGPU models (confirmed working with v3 + q4f16).
 */
export interface WebGPUModelInfo {
  modelId: string;
  name: string;
  sizeLabel: string;
  description: string;
  requirements: {
    vram: string;
    ram: string;
    note?: string;
  };
}

export const WEBGPU_MODELS: WebGPUModelInfo[] = [
  {
    modelId: "onnx-community/Qwen3-0.6B-ONNX",
    name: "Qwen3 0.6B",
    sizeLabel: "~570 MB",
    description: "Model nhẹ, hỗ trợ tiếng Việt và reasoning cơ bản",
    requirements: {
      vram: "≥ 1 GB",
      ram: "≥ 4 GB",
      note: "Chạy được trên hầu hết laptop có GPU tích hợp",
    },
  },
  {
    modelId: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
    name: "Llama 3.2 1B Instruct",
    sizeLabel: "~700 MB",
    description: "Model nhỏ gọn, ổn định (recommended)",
    requirements: {
      vram: "≥ 2 GB",
      ram: "≥ 4 GB",
      note: "GPU tích hợp Intel/AMD hoặc GPU rời entry-level",
    },
  },
  {
    modelId: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
    name: "DeepSeek R1 Distill 1.5B",
    sizeLabel: "~1.4 GB",
    description:
      "Model suy luận mạnh nhưng không hỗ trợ Tiếng Việt, lưu ý khi sử dụng",
    requirements: {
      vram: "≥ 3 GB",
      ram: "≥ 6 GB",
      note: "Có thể cần GPU rời hoặc Apple Silicon",
    },
  },
];

// ─── Singleton worker ────────────────────────────────────────

let workerInstance: Worker | null = null;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("./webgpu-worker.ts", import.meta.url),
      { type: "module" },
    );
  }
  return workerInstance;
}

// ─── Model factory ───────────────────────────────────────────

/**
 * Create a LanguageModel backed by WebGPU inference in a Web Worker.
 * Uses @browser-ai/transformers-js as Vercel AI SDK bridge.
 */
export function createWebGPUModel(
  modelId: string,
  settings?: Partial<TransformersJSModelSettings>,
): LanguageModel {
  const model = transformersJS(modelId, {
    device: "webgpu",
    dtype: "q4f16",
    worker: getWorker(),
    ...settings,
  });

  return wrapLanguageModel({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: model as any,
    middleware: extractJsonMiddleware(),
  });
}

/**
 * Create a standalone model instance for downloading/caching only.
 * Uses CPU (wasm) to avoid GPU memory conflicts with loaded models.
 */
export function createWebGPUModelForDownload(
  modelId: string,
  settings?: Partial<TransformersJSModelSettings>,
): TransformersJSLanguageModel {
  return transformersJS(modelId, {
    device: "wasm",
    dtype: "q4f16",
    ...settings,
  });
}

/**
 * Terminate the shared worker and release GPU memory.
 */
export function terminateWebGPUWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}
