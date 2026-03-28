/// <reference types="@webgpu/types" />

/**
 * GPU device limits relevant for model loading.
 */
export interface WebGPULimits {
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
  maxComputeWorkgroupStorageSize: number;
}

export interface WebGPUSupportResult {
  supported: boolean;
  adapterInfo?: GPUAdapterInfo;
  limits?: WebGPULimits;
  error?: string;
}

/**
 * Check if the current browser supports WebGPU and query device limits.
 */
export async function checkWebGPUSupport(): Promise<WebGPUSupportResult> {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return {
      supported: false,
      error:
        "Trình duyệt không hỗ trợ WebGPU. Hãy sử dụng Chrome 113+ hoặc Edge 113+.",
    };
  }
  try {
    const gpu = navigator.gpu as GPU;
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        error: "Không tìm thấy GPU adapter. Hãy kiểm tra driver đồ hoạ.",
      };
    }

    // Request device to get actual limits
    const device = await adapter.requestDevice();
    const limits: WebGPULimits = {
      maxBufferSize: device.limits.maxBufferSize,
      maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
      maxComputeWorkgroupStorageSize:
        device.limits.maxComputeWorkgroupStorageSize,
    };
    device.destroy();

    return { supported: true, adapterInfo: adapter.info, limits };
  } catch (e) {
    return {
      supported: false,
      error: `Lỗi khi kiểm tra WebGPU: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Check if we're in a browser environment.
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined";
}
