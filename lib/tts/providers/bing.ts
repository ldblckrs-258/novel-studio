import { registerProvider } from "./registry";
import type { PlaybackOptions, TTSOptions, TTSProvider, Voice } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BING_WS_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const PROXY_WS_URL =
  "wss://103.82.20.93/bing/consumer/speech/synthesize/readaloud/edge/v1";
const KEY_SERVER_URL = "http://103.82.20.93/io/s1213/edgeTTSClientKey";
const TIMEOUT_MS = 10_000;
const MAX_RETRY_ATTEMPTS = 3;
const IDLE_TIMEOUT_MS = 300_000; // 5 minutes
const CLEANUP_INTERVAL_MS = 180_000; // 3 minutes

// ---------------------------------------------------------------------------
// Module-level state (shared across all BingTTS instances)
// ---------------------------------------------------------------------------

let sharedConnection: WebSocket | null = null;
let connectionInUse = false;
const activeRequests = new Map<string, RequestContext>();
const requestQueue: RequestContext[] = [];
let sharedWebsocketAudio: WebsocketAudio | null = null;

// Auth key caching
let cachedKey: string | null = null;
let keyExpiresAt: Date | null = null;

// Idle connection cleanup
let cleanupTimerId: ReturnType<typeof setInterval> | null = null;

/** Detect Edge browser. */
function isEdgeBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes("Edg/");
}

/** Get the appropriate WebSocket URL. */
function getServerUrl(): string {
  return isEdgeBrowser() ? BING_WS_URL : PROXY_WS_URL;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a 32-char hex UUID for request tracking. */
function createUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let uuid = "";
  for (let i = 0; i < 16; i++) {
    const hex = bytes[i].toString(16);
    uuid += hex.length < 2 ? "0" + hex : hex;
  }
  return uuid;
}

/** Fetch (or reuse) the Bing TTS access key. */
async function getAccessKey(): Promise<string> {
  if (cachedKey && keyExpiresAt && new Date() < keyExpiresAt) {
    return cachedKey;
  }
  const response = await fetch(KEY_SERVER_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch access key: ${response.statusText}`);
  }
  cachedKey = (await response.text()).trim();
  keyExpiresAt = new Date(Date.now() + 60_000); // 1-minute TTL
  return cachedKey;
}

/**
 * Convert a rate/pitch value (0.5–5.0) to the Bing SSML relative-percentage
 * format, e.g. `"+50%"` for 1.5, `"-25%"` for 0.75.
 */
function toRelativePercentage(value: number): string {
  const pct = (value - 1) * 100;
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/** Build an SSML payload for Bing TTS. */
function createSSML(
  text: string,
  options: { voiceName?: string; rate?: number; pitch?: number } = {},
): string {
  const voiceName =
    options.voiceName ??
    "Microsoft Server Speech Text to Speech Voice (vi-VN, HoaiMyNeural)";
  const rate = toRelativePercentage(options.rate ?? 1.0);
  const pitch = toRelativePercentage(options.pitch ?? 1.0);
  const volume = "+50%";

  // Escape XML special chars
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>` +
    `<voice name='${voiceName}'>` +
    `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
    escaped +
    `</prosody></voice></speak>`
  );
}

/** Build the speech.config JSON message. */
function createConfig(): string {
  return JSON.stringify({
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: "false",
            wordBoundaryEnabled: "false",
          },
          outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        },
      },
    },
  });
}

/** Periodically close idle shared connections. */
function cleanupSharedConnection(): void {
  if (sharedConnection && !connectionInUse) {
    if (sharedConnection.readyState === WebSocket.OPEN) {
      const lastUsed = (sharedConnection as WebSocketWithMeta)._lastUsed ?? 0;
      if (!lastUsed || Date.now() - lastUsed > IDLE_TIMEOUT_MS) {
        sharedConnection.close(1000, "Idle timeout");
        sharedConnection = null;
      }
    } else {
      sharedConnection = null;
    }
  }
}

function ensureCleanupTimer(): void {
  if (cleanupTimerId === null) {
    cleanupTimerId = setInterval(cleanupSharedConnection, CLEANUP_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebSocketWithMeta extends WebSocket {
  _lastUsed?: number;
}

interface RequestContext {
  uuid: string;
  text: string;
  options: { voiceName?: string; rate?: number; pitch?: number };
  audioChunks: ArrayBuffer[];
  turnEndReceived: boolean;
  finishTimeout: ReturnType<typeof setTimeout> | null;
  retryCount: number;
  onAudioReady: (blob: Blob) => void;
  onError: (error: Error) => void;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// WebsocketAudio — manages WebSocket connections and audio chunk reassembly
// ---------------------------------------------------------------------------

class WebsocketAudio {
  private connection: WebSocketWithMeta | null = null;

  static getSharedInstance(): WebsocketAudio {
    if (!sharedWebsocketAudio) {
      sharedWebsocketAudio = new WebsocketAudio();
    }
    return sharedWebsocketAudio;
  }

  /**
   * Synthesise `text` via the Bing TTS WebSocket and return the resulting
   * audio as a Blob.
   */
  async speak(
    text: string,
    options: { voiceName?: string; rate?: number; pitch?: number } = {},
  ): Promise<Blob> {
    const requestUuid = createUUID();

    return new Promise<Blob>((resolve, reject) => {
      const ctx: RequestContext = {
        uuid: requestUuid,
        text,
        options,
        audioChunks: [],
        turnEndReceived: false,
        finishTimeout: null,
        retryCount: 0,
        onAudioReady: resolve,
        onError: reject,
        isActive: true,
      };

      if (connectionInUse) {
        requestQueue.push(ctx);
        return;
      }

      activeRequests.set(requestUuid, ctx);
      this.startStreamForRequest(ctx);
    });
  }

  // ---- Connection lifecycle -----------------------------------------------

  private async startStreamForRequest(ctx: RequestContext): Promise<void> {
    ctx.isActive = true;
    try {
      // Try to reuse existing connection
      if (
        sharedConnection &&
        sharedConnection.readyState === WebSocket.OPEN &&
        !connectionInUse &&
        sharedConnection.bufferedAmount === 0
      ) {
        this.connection = sharedConnection;
        connectionInUse = true;
        this.setupHandlers(ctx, true);
        return;
      }

      // If the shared connection exists but is busy or stale, discard it
      if (sharedConnection) {
        sharedConnection = null;
      }

      await this.createNewConnection(ctx);
    } catch (err) {
      this.handleError(
        ctx,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  private async createNewConnection(ctx: RequestContext): Promise<void> {
    const accessKey = await getAccessKey();
    const url = `${getServerUrl()}?TrustedClientToken=${accessKey}&ConnectionId=${createUUID()}`;
    this.connection = new WebSocket(url) as WebSocketWithMeta;
    sharedConnection = this.connection;
    connectionInUse = true;
    this.setupHandlers(ctx, false);
  }

  private setupHandlers(ctx: RequestContext, isReused: boolean): void {
    const ws = this.connection;
    if (!ws) return;

    if (!isReused) {
      ws.onopen = () => this.sendMessages(ctx);

      // Connection timeout
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          this.handleError(ctx, new Error("Connection timeout"));
        }
      }, TIMEOUT_MS);
    } else {
      this.sendMessages(ctx);
    }

    ws.onmessage = (event: MessageEvent) => this.routeMessage(event);
    ws.onerror = () => this.handleConnectionError();
    ws.onclose = (event: CloseEvent) => this.handleConnectionClose(event);
  }

  // ---- Sending ------------------------------------------------------------

  private sendMessages(ctx: RequestContext): void {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
      this.handleError(ctx, new Error("Connection not ready"));
      return;
    }
    try {
      const timestamp = new Date().toISOString();

      // Config message
      const configMsg =
        `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        createConfig();
      this.connection.send(configMsg);

      // SSML message
      const ssml = createSSML(ctx.text, ctx.options);
      const ssmlMsg =
        `X-RequestId:${ctx.uuid}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;
      this.connection.send(ssmlMsg);
    } catch (err) {
      this.handleError(
        ctx,
        new Error(
          `Failed to send messages: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  // ---- Receiving ----------------------------------------------------------

  private routeMessage(event: MessageEvent): void {
    if (event.data instanceof Blob) {
      this.routeBinaryMessage(event.data);
    } else if (typeof event.data === "string") {
      this.routeTextMessage(event.data);
    }
  }

  private async routeBinaryMessage(blob: Blob): Promise<void> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const dataView = new DataView(arrayBuffer);
      const headerLength = dataView.getInt16(0, false);
      const headerBytes = arrayBuffer.slice(2, 2 + headerLength);
      const headerText = new TextDecoder().decode(headerBytes);

      for (const [, ctx] of activeRequests) {
        if (headerText.includes(ctx.uuid)) {
          this.handleBinaryChunk(ctx, arrayBuffer, headerLength);
          return;
        }
      }
    } catch (err) {
      console.warn("Error routing binary message:", err);
    }
  }

  private routeTextMessage(message: string): void {
    for (const [, ctx] of activeRequests) {
      if (message.includes(ctx.uuid)) {
        this.handleTextMessage(ctx, message);
        return;
      }
    }
  }

  private handleTextMessage(ctx: RequestContext, message: string): void {
    if (message.includes("turn.end")) {
      ctx.turnEndReceived = true;
      ctx.finishTimeout = setTimeout(() => {
        this.finishStream(ctx);
      }, 100);
    }
  }

  private handleBinaryChunk(
    ctx: RequestContext,
    arrayBuffer: ArrayBuffer,
    headerLength: number,
  ): void {
    const audioData = arrayBuffer.slice(2 + headerLength);
    if (audioData.byteLength > 0) {
      ctx.audioChunks.push(audioData);

      // If we already received turn.end, delay the finish to collect
      // any remaining binary frames.
      if (ctx.turnEndReceived && ctx.finishTimeout) {
        clearTimeout(ctx.finishTimeout);
        ctx.finishTimeout = setTimeout(() => {
          this.finishStream(ctx);
        }, 100);
      }
    }
  }

  // ---- Completion & error handling ----------------------------------------

  private finishStream(ctx: RequestContext): void {
    activeRequests.delete(ctx.uuid);
    connectionInUse = false;

    if (this.connection === sharedConnection && sharedConnection) {
      (sharedConnection as WebSocketWithMeta)._lastUsed = Date.now();
    }

    if (ctx.audioChunks.length > 0) {
      const audioBlob = new Blob(ctx.audioChunks, { type: "audio/webm" });
      ctx.onAudioReady(audioBlob);
    } else {
      this.handleError(ctx, new Error("No audio data received"));
      return;
    }

    if (ctx.finishTimeout) {
      clearTimeout(ctx.finishTimeout);
    }

    this.processNextRequest();
  }

  private handleConnectionError(): void {
    for (const [, ctx] of activeRequests) {
      if (ctx.isActive) {
        this.handleError(ctx, new Error("WebSocket connection error"));
      }
    }
  }

  private handleError(ctx: RequestContext, error: Error): void {
    activeRequests.delete(ctx.uuid);
    connectionInUse = false;

    // Retry logic
    if (ctx.retryCount < MAX_RETRY_ATTEMPTS) {
      ctx.retryCount++;
      console.log(
        `Retry attempt ${ctx.retryCount}/${MAX_RETRY_ATTEMPTS} for Bing TTS`,
      );

      if (this.connection === sharedConnection) {
        sharedConnection = null;
      }
      this.connection = null;

      activeRequests.set(ctx.uuid, ctx);
      setTimeout(() => {
        if (ctx.isActive) {
          this.startStreamForRequest(ctx);
        }
      }, 1_000 * ctx.retryCount);
      return;
    }

    ctx.onError(
      new Error(`${error.message} (after ${ctx.retryCount} retries)`),
    );
    this.processNextRequest();
  }

  private handleConnectionClose(event: CloseEvent): void {
    connectionInUse = false;
    const wasClean = event.code === 1000 || event.code === 1001;

    if (!wasClean) {
      if (this.connection === sharedConnection) {
        sharedConnection = null;
      }
      for (const [, ctx] of activeRequests) {
        if (ctx.isActive) {
          this.handleError(
            ctx,
            new Error(
              `Connection closed unexpectedly (code: ${event.code ?? "unknown"})`,
            ),
          );
          break;
        }
      }
    } else if (this.connection === sharedConnection) {
      sharedConnection = null;
    }

    if (wasClean) {
      this.processNextRequest();
    }
  }

  private processNextRequest(): void {
    if (requestQueue.length > 0 && !connectionInUse) {
      const next = requestQueue.shift()!;
      activeRequests.set(next.uuid, next);
      this.startStreamForRequest(next);
    }
  }

  /** Cancel all pending and active requests, close the connection. */
  cleanup(): void {
    // Reject queued requests
    for (const queued of requestQueue) {
      queued.onError(new Error("Service cleanup"));
    }
    requestQueue.length = 0;

    // Reject active requests
    for (const [, ctx] of activeRequests) {
      if (ctx.finishTimeout) clearTimeout(ctx.finishTimeout);
      ctx.onError(new Error("Service cleanup"));
    }
    activeRequests.clear();

    if (this.connection) {
      try {
        this.connection.close(1000, "Service cleanup");
      } catch {
        // Ignore close errors during cleanup
      }
      if (this.connection === sharedConnection) {
        sharedConnection = null;
      }
      this.connection = null;
    }
    connectionInUse = false;
  }
}

// ---------------------------------------------------------------------------
// BingTTS Provider
// ---------------------------------------------------------------------------

/**
 * Bing TTS provider using WebSocket-based speech synthesis.
 *
 * Features:
 * - WebSocket connection reuse and request queuing
 * - SSML-based synthesis with voice, rate, and pitch control
 * - Automatic retry (up to 3 attempts) on failure
 * - 10 voices: 2 Vietnamese (Hoài My, Nam Minh) + 8 multilingual
 * - Early ending support via `getCutTime()`
 */
export class BingTTS implements TTSProvider {
  readonly id = "bing-tts";
  readonly name = "BingTTS";
  readonly friendlyName = "Bing TTS";

  private voice: number | string = 0;
  private rate = 1.0;
  private pitch = 1.0;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    ensureCleanupTimer();
    this.isInitialized = true;
  }

  async getVoices(): Promise<Voice[]> {
    return [
      {
        id: 0,
        name: "Hoài My",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (vi-VN, HoaiMyNeural)",
      },
      {
        id: 1,
        name: "Nam Minh",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (vi-VN, NamMinhNeural)",
      },
      {
        id: 2,
        name: "Andrew",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (en-US, AndrewMultilingualNeural)",
      },
      {
        id: 3,
        name: "Ava",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (en-US, AvaMultilingualNeural)",
      },
      {
        id: 4,
        name: "Brian",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (en-US, BrianMultilingualNeural)",
      },
      {
        id: 5,
        name: "Emma",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (en-US, EmmaMultilingualNeural)",
      },
      {
        id: 6,
        name: "Seraphina",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (de-DE, SeraphinaMultilingualNeural)",
      },
      {
        id: 7,
        name: "Florian",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (de-DE, FlorianMultilingualNeural)",
      },
      {
        id: 8,
        name: "Vivienne",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (fr-FR, VivienneMultilingualNeural)",
      },
      {
        id: 9,
        name: "Remy",
        fullName:
          "Microsoft Server Speech Text to Speech Voice (fr-FR, RemyMultilingualNeural)",
      },
    ];
  }

  getCutTime(_text: string): number {
    const voiceIndex =
      typeof this.voice === "number"
        ? this.voice
        : parseInt(this.voice, 10) || 0;
    // Multilingual voices (index >= 2) need less cut time
    const baseFactor = voiceIndex >= 2 ? 0.3 : 0.5;
    return baseFactor / this.rate;
  }

  async fetchAudio(text: string, options?: TTSOptions): Promise<Blob> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!text || text.trim().length === 0) {
      throw new Error("Text is required");
    }

    const voiceId = options?.voice ?? this.voice;
    const voices = await this.getVoices();
    const voiceIndex =
      typeof voiceId === "number" ? voiceId : parseInt(voiceId, 10) || 0;

    if (voiceIndex < 0 || voiceIndex >= voices.length) {
      throw new Error(
        `Invalid voice ID: ${voiceId}. Available voices: ${voices.length}`,
      );
    }

    const voiceName = voices[voiceIndex]?.fullName ?? voices[0].fullName;

    const speakOptions = {
      voiceName,
      rate: Math.max(0.5, Math.min(5.0, options?.rate ?? this.rate)),
      pitch: Math.max(0.5, Math.min(2.0, options?.pitch ?? this.pitch)),
    };

    // Truncate very long text
    const truncatedText = text.length > 1000 ? text.substring(0, 1000) : text;

    try {
      const ws = WebsocketAudio.getSharedInstance();
      return await ws.speak(truncatedText, speakOptions);
    } catch (err) {
      throw new Error(
        `Bing TTS failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Clean up the shared WebSocket connection. */
  cleanup(): void {
    const ws = WebsocketAudio.getSharedInstance();
    ws.cleanup();
  }

  getPlaybackOptions(): PlaybackOptions {
    return { playbackRate: 1.0, preservesPitch: true };
  }

  setVoice(voice: number | string): void {
    this.voice = voice;
  }

  setRate(rate: number): void {
    this.rate = rate;
  }

  setPitch(pitch: number): void {
    this.pitch = pitch;
  }
}

registerProvider("BingTTS", BingTTS, "Bing TTS");
