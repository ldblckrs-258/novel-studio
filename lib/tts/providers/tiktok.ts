import { registerProvider } from "./registry";
import type { PlaybackOptions, TTSOptions, TTSProvider, Voice } from "./types";

const PROXY_URL = "http://14.225.254.182/io/s1213/tiktoktts?text=";

/**
 * GET fetch with a timeout. Rejects if the request takes longer than `ms`.
 */
async function fetchWithTimeout(url: string, ms = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, { signal: controller.signal });
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

/**
 * TikTok (ByteDance) TTS provider.
 *
 * Uses the proxy endpoint. Rate is applied at playback time via
 * `getPlaybackOptions()` rather than at synthesis time.
 */
export class TikTokTTS implements TTSProvider {
  readonly id = "tiktok";
  readonly name = "TikTokTTS";
  readonly friendlyName = "TikTok TTS";

  private voice: number | string = 0;
  private rate = 1.0;
  private pitch = 1.0;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async getVoices(): Promise<Voice[]> {
    return [
      {
        id: 0,
        name: "Nữ 1",
        fullName: "Giọng Nữ TikTok",
        serverId: "tiktok:1",
      },
      {
        id: 1,
        name: "Nam 1",
        fullName: "Giọng Nam TikTok",
        serverId: "tiktok:2",
      },
      {
        id: 2,
        name: "Nữ 2",
        fullName: "Giọng Nữ TikTok 2",
        serverId: "tiktok:3",
      },
    ];
  }

  async fetchAudio(text: string, options?: TTSOptions): Promise<Blob> {
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

    const url = `${PROXY_URL}${encodeURIComponent(text)}`;

    const response = await fetchWithTimeout(url);
    return response.blob();
  }

  getCutTime(text: string): number {
    const baseFactor = 0.015;
    const wordCount = text.split(/\s+/).length - 1;
    const cutTime = Math.min(0.4, baseFactor * wordCount);
    return Math.max(cutTime, 0) / this.rate;
  }

  getPlaybackOptions(): PlaybackOptions {
    return { playbackRate: this.rate };
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

registerProvider("TikTokTTS", TikTokTTS, "TikTok TTS");
