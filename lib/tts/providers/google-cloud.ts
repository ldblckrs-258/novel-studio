import { registerProvider } from "./registry";
import type { PlaybackOptions, TTSOptions, TTSProvider, Voice } from "./types";

const GOOGLE_URL = "https://readaloud.googleapis.com/v1:generateAudioDocStream";
const PROXY_URL =
  "/io/s1213/googlecloudtts?voice={voice}&rate={rate}&pitch={pitch}";
// Embedded API key
const API_KEY = atob("QUl6YVN5Q1JaVlI0THBzQTJoSXhuOHdrYm5hU3h4ZHVIaGVBdmhj");

/** Maps voice index (1-6) to the Google Cloud voice code. */
const VOICE_CODES = [null, "via", "vib", "vic", "vid", "vie", "vif"] as const;

/**
 * Fetch JSON with a timeout. Rejects if the request takes longer than `ms`.
 */
async function fetchJsonWithTimeout(
  url: string,
  options: RequestInit,
  ms = 20_000,
): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.statusText}`);
    }
    return (await response.json()) as unknown[];
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Fetch timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST with timeout. Rejects if the request takes longer than `ms`.
 */
async function fetchPostWithTimeout(
  url: string,
  body: Record<string, unknown>,
  ms = 8_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Fetch timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Detect Safari browser. */
function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    !!navigator.vendor &&
    navigator.vendor.indexOf("Apple") > -1 &&
    !!navigator.userAgent &&
    navigator.userAgent.indexOf("CriOS") === -1 &&
    navigator.userAgent.indexOf("FxiOS") === -1
  );
}

/**
 * Google Cloud TTS provider using the Read Aloud API.
 *
 * On Safari the proxy endpoint is used (avoids CORS issues).
 * On other browsers the direct Google API with an embedded key is used.
 *
 * Supports early ending (trimming trailing silence via `getCutTime()`).
 */
export class GoogleCloudTTS implements TTSProvider {
  readonly id = "googlecloud";
  readonly name = "GoogleCloudTTS";
  readonly friendlyName = "Google Cloud TTS";

  private voice: number | string = 0;
  private rate = 1.0;
  private pitch = 1.0;
  private isInitialized = false;
  private readonly useSafari: boolean;

  constructor() {
    this.useSafari = isSafariBrowser();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async getVoices(): Promise<Voice[]> {
    return [
      {
        id: 0,
        name: "Nữ 1",
        fullName: "Giọng Google Nữ 1 (Tiếng Việt)",
        serverId: "google:1",
      },
      {
        id: 1,
        name: "Nữ 2",
        fullName: "Giọng Google Nữ 2 (Tiếng Việt)",
        serverId: "google:3",
      },
      {
        id: 2,
        name: "Nữ 3",
        fullName: "Giọng Google Nữ 3 (Tiếng Việt)",
        serverId: "google:5",
      },
      {
        id: 3,
        name: "Nam 1",
        fullName: "Giọng Google Nam 1 (Tiếng Việt)",
        serverId: "google:2",
      },
      {
        id: 4,
        name: "Nam 2",
        fullName: "Giọng Google Nam 2 (Tiếng Việt)",
        serverId: "google:4",
      },
      {
        id: 5,
        name: "Nam 3",
        fullName: "Giọng Google Nam 3 (Tiếng Việt)",
        serverId: "google:6",
      },
    ];
  }

  getCutTime(text: string): number {
    const baseFactor = 0.015;
    const wordCount = text.split(/\s+/).length - 1;
    const cutTime = Math.min(0.4, baseFactor * wordCount);
    return Math.max(cutTime, 0) / this.rate;
  }

  async fetchAudio(text: string, options?: TTSOptions): Promise<Blob> {
    if (this.useSafari) {
      return this.fetchAudioWithProxy(text, options);
    }
    return this.fetchAudioDirect(text, options);
  }

  // ---------------------------------------------------------------------------
  // Direct API (non-Safari)
  // ---------------------------------------------------------------------------

  private async fetchAudioDirect(
    text: string,
    options?: TTSOptions,
  ): Promise<Blob> {
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

    const serverVoiceId = voices[voiceIndex].serverId ?? "google:1";
    const voiceCodeIndex = parseInt(serverVoiceId.split(":")[1], 10);
    const realVoice = VOICE_CODES[voiceCodeIndex] ?? "via";

    let rate = options?.rate ?? this.rate;
    rate = Math.round(Math.min(Math.max(rate, 0.5), 4.0) * 10) / 10;

    let pitch = options?.pitch ?? this.pitch;
    pitch = Math.round(Math.min(Math.max(pitch, 0.5), 2.0) * 10) / 10;

    const body = {
      text: { textParts: text },
      advanced_options: {
        force_language: "vi",
        audio_generation_options: {
          speed_factor: rate,
          pitch_factor: pitch,
        },
      },
      voice_settings: {
        voice_criteria_and_selections: [
          {
            criteria: { language: "vi" },
            selection: { default_voice: realVoice },
          },
        ],
      },
    };

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
      },
      body: JSON.stringify(body),
    };

    const responseData = await fetchJsonWithTimeout(GOOGLE_URL, requestOptions);

    // The audio stream is at index 2 of the response array
    const audioStream = responseData[2] as
      | { audio?: { bytes?: string } }
      | undefined;
    if (!audioStream?.audio?.bytes) {
      throw new Error("No audio stream found in the response");
    }

    const base64Data = audioStream.audio.bytes;
    const dataUrl = `data:audio/mpeg;base64,${base64Data}`;
    const blobResponse = await fetch(dataUrl);
    return blobResponse.blob();
  }

  // ---------------------------------------------------------------------------
  // Proxy API (Safari)
  // ---------------------------------------------------------------------------

  private async fetchAudioWithProxy(
    text: string,
    options?: TTSOptions,
  ): Promise<Blob> {
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

    const serverVoiceId = voices[voiceIndex].serverId ?? "google:1";
    const rate = options?.rate ?? this.rate;
    const pitch = options?.pitch ?? this.pitch;

    const url = PROXY_URL.replace("{voice}", serverVoiceId)
      .replace("{rate}", String(rate))
      .replace("{pitch}", String(pitch));

    const response = await fetchPostWithTimeout(url, { text });
    return response.blob();
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

registerProvider("GoogleCloudTTS", GoogleCloudTTS, "Google Cloud TTS");
