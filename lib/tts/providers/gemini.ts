import { registerProvider } from "./registry";
import type { PlaybackOptions, TTSOptions, TTSProvider, Voice } from "./types";

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";
const DEFAULT_VOICE = "Aoede";

interface GeminiVoiceDescriptor {
  id: string;
  name: string;
  description: string;
}

/** All 15 Gemini TTS voices with their descriptions. */
const GEMINI_VOICES: GeminiVoiceDescriptor[] = [
  { id: "Zephyr", name: "Zephyr", description: "Bright" },
  { id: "Puck", name: "Puck", description: "Upbeat" },
  { id: "Charon", name: "Charon", description: "Informative" },
  { id: "Kore", name: "Kore", description: "Firm" },
  { id: "Fenrir", name: "Fenrir", description: "Excitable" },
  { id: "Leda", name: "Leda", description: "Youthful" },
  { id: "Orus", name: "Orus", description: "Firm" },
  { id: "Aoede", name: "Aoede", description: "Breezy" },
  { id: "Callirrhoe", name: "Callirrhoe", description: "Easy-going" },
  { id: "Autonoe", name: "Autonoe", description: "Bright" },
  { id: "Enceladus", name: "Enceladus", description: "Breathy" },
  { id: "Iapetus", name: "Iapetus", description: "Clear" },
  { id: "Umbriel", name: "Umbriel", description: "Easy-going" },
  { id: "Algieba", name: "Algieba", description: "Smooth" },
  { id: "Despina", name: "Despina", description: "Smooth" },
];

/**
 * Create a WAV Blob from raw PCM data (16-bit, 24 kHz, mono).
 */
function createWavBlob(pcmData: Uint8Array): Blob {
  const sampleRate = 24_000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, fileSize, true);
  writeString(8, "WAVE");

  // fmt sub-chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < dataSize; i++) {
    view.setUint8(44 + i, pcmData[i]);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Gemini TTS provider using the Gemini 2.5 Flash TTS API.
 *
 * Requires a user-provided API key (stored via `setApiKey()`).
 * plays audio directly; however this port also supports `fetchAudio()` which
 * returns a WAV blob for integration with the player's audio cache.
 */
export class GeminiTTS implements TTSProvider {
  readonly id = "gemini";
  readonly name = "GeminiTTS";
  readonly friendlyName = "Gemini TTS";
  readonly isDirectOnly = true;
  readonly requiresApiKey = true;

  private voice: number | string = DEFAULT_VOICE;
  private rate = 1.0;
  private pitch = 1.0;
  private apiKey: string | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async getVoices(): Promise<Voice[]> {
    return GEMINI_VOICES.map((v) => ({
      id: v.id,
      name: v.name,
      fullName: `${v.name} (${v.description})`,
    }));
  }

  /** Set the Gemini API key. Must be called before fetchAudio(). */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  async fetchAudio(text: string, options?: TTSOptions): Promise<Blob> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text is required");
    }

    if (!this.apiKey) {
      throw new Error(
        "API key is required for Gemini TTS. Call setApiKey() first.",
      );
    }

    const voiceName =
      (options?.voice as string | undefined) ??
      (this.voice as string) ??
      DEFAULT_VOICE;

    const requestBody = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    };

    const response = await fetch(`${API_URL}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Gemini API HTTP error: ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: {
        content?: {
          parts?: { inlineData?: { data?: string } }[];
        };
      }[];
    };

    const audioBase64 =
      data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
      throw new Error("Invalid response from Gemini API — no audio data");
    }

    // Decode base64 to PCM bytes
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return createWavBlob(bytes);
  }

  /**
   * Speak text directly by fetching audio, creating a blob URL,
   * and playing it through an Audio element.
   */
  async speakDirect(text: string, options?: TTSOptions): Promise<void> {
    const audioBlob = await this.fetchAudio(text, options);
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = audioUrl;

    if (options?.rate ?? this.rate) {
      audio.playbackRate = options?.rate ?? this.rate;
    }

    return new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => {
        audio.play().catch(reject);
      };
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error("Gemini TTS audio playback error"));
      };
    });
  }

  /** Stop playback (no-op for fetch-based approach). */
  stop(): void {
    // Playback is handled per-call; nothing to cancel globally.
  }

  getPlaybackOptions(): PlaybackOptions {
    return { playbackRate: this.rate, preservesPitch: true };
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

registerProvider("GeminiTTS", GeminiTTS, "Gemini TTS (cần API key)");
