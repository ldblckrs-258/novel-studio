/**
 * Communication bridge between Novel Studio and the Chrome extension.
 *
 * The extension acts as a CORS proxy by loading URLs in real browser tabs,
 * extracting HTML via content script injection, then returning it here.
 */

const STORAGE_KEY = "novel-studio:extension-id";
const TIMEOUT_KEY = "novel-studio:scrape-timeout";

export function getExtensionId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setExtensionId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id.trim());
}

export function getScrapeTimeout(): number {
  if (typeof window === "undefined") return 10000;
  const val = localStorage.getItem(TIMEOUT_KEY);
  return val ? parseInt(val, 10) : 10000;
}

export function setScrapeTimeout(ms: number): void {
  localStorage.setItem(TIMEOUT_KEY, String(ms));
}

// ─── Chrome API typing ─────────────────────────────────────

interface ExtensionResponse {
  ok: boolean;
  html?: string;
  contentText?: string;
  timedOut?: boolean;
  logs?: string[];
  error?: string;
  version?: string;
}

function getChromeRuntime(): {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void,
  ) => void;
} | null {
  // Access the real browser chrome.runtime (not our custom type)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (globalThis as any).chrome;
  if (c?.runtime?.sendMessage) return c.runtime;
  return null;
}

function sendMessage(message: unknown): Promise<ExtensionResponse> {
  return new Promise((resolve, reject) => {
    const runtime = getChromeRuntime();
    if (!runtime) {
      reject(new Error("Chrome extension API not available"));
      return;
    }

    const extensionId = getExtensionId();
    if (!extensionId) {
      reject(new Error("Extension ID chưa được cấu hình"));
      return;
    }

    runtime.sendMessage(extensionId, message, (response: unknown) => {
      if (!response) {
        reject(
          new Error(
            "No response from extension. Is Novel Studio Connector installed?",
          ),
        );
        return;
      }
      resolve(response as ExtensionResponse);
    });
  });
}

/**
 * Fetch a URL through the extension (bypasses CORS + Cloudflare).
 * @param waitSelector - Optional CSS selector to wait for before extracting HTML.
 */
export interface FetchResult {
  html: string;
  contentText?: string;
  timedOut?: boolean;
  logs?: string[];
}

export async function extensionFetch(
  url: string,
  waitSelector?: string,
  clickSelector?: string,
): Promise<FetchResult> {
  const timeout = getScrapeTimeout();
  const response = await sendMessage({ type: "FETCH", url, waitSelector, clickSelector, timeout });
  if (!response.ok) {
    throw new Error(response.error ?? "Extension fetch failed");
  }
  return {
    html: response.html!,
    contentText: response.contentText ?? undefined,
    timedOut: response.timedOut ?? false,
    logs: response.logs,
  };
}

/**
 * Check if the extension is installed and responsive.
 */
export async function isExtensionAvailable(): Promise<boolean> {
  if (!getExtensionId()) return false;

  try {
    const response = await Promise.race([
      sendMessage({ type: "PING" }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 1500),
      ),
    ]);
    return response.ok === true;
  } catch {
    return false;
  }
}
