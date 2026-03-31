import { registerProvider } from "./registry";
import type { PlaybackOptions, TTSOptions, TTSProvider, Voice } from "./types";

/**
 * Extended voice descriptor that includes the native SpeechSynthesisVoice
 * reference for direct use with the Web Speech API.
 */
interface BrowserVoice extends Voice {
  nativeVoice: SpeechSynthesisVoice;
}

/**
 * Browser-native TTS using the Web Speech API (`speechSynthesis`).
 *
 * Marked `isDirectOnly` because the Web Speech API plays audio through the
 * system audio pipeline — there is no way to capture a raw audio Blob.
 * The player should call `speakDirect()` instead of `fetchAudio()`.
 *
 * Limitations:
 * - Stops when the tab loses focus (browser security policy).
 * - Voice availability depends on the OS / browser.
 */
export class BrowserTTS implements TTSProvider {
  readonly id = "browser";
  readonly name = "BrowserTTS";
  readonly friendlyName = "Browser TTS";
  readonly isDirectOnly = true;

  private voice: number | string = 0;
  private rate = 1.0;
  private pitch = 1.0;
  private isInitialized = false;
  private cachedVoices: BrowserVoice[] | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    // Pre-warm the voice list so subsequent getVoices() calls are instant.
    await this.getVoices();
    this.isInitialized = true;
  }

  async getVoices(): Promise<BrowserVoice[]> {
    if (this.cachedVoices) return this.cachedVoices;

    return new Promise<BrowserVoice[]>((resolve) => {
      const mapVoices = (raw: SpeechSynthesisVoice[]): BrowserVoice[] => {
        // Prefer Vietnamese voices, fall back to all voices if none found
        const viVoices = raw.filter((v) => /vi|vn/i.test(v.lang));
        const list = viVoices.length > 0 ? viVoices : raw;
        return list.map((v, i) => ({
          id: i,
          name: v.name,
          fullName: `${v.name} (${v.lang})`,
          nativeVoice: v,
        }));
      };

      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        this.cachedVoices = mapVoices(voices);
        resolve(this.cachedVoices);
      } else {
        speechSynthesis.onvoiceschanged = () => {
          this.cachedVoices = mapVoices(speechSynthesis.getVoices());
          resolve(this.cachedVoices);
        };
      }
    });
  }

  /**
   * Not supported — BrowserTTS is `isDirectOnly`.
   * Use `speakDirect()` instead.
   */
  async fetchAudio(_text: string, _options?: TTSOptions): Promise<Blob> {
    throw new Error(
      "BrowserTTS is direct-only. Use speakDirect() instead of fetchAudio().",
    );
  }

  /**
   * Speak text directly through the Web Speech API.
   * Returns a Promise that resolves when the utterance finishes.
   */
  async speakDirect(text: string, options?: TTSOptions): Promise<void> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text is required");
    }

    const voices = await this.getVoices();
    const voiceId = options?.voice !== undefined ? options.voice : this.voice;
    const voiceIndex =
      typeof voiceId === "number" ? voiceId : parseInt(voiceId, 10) || 0;

    if (voiceIndex < 0 || voiceIndex >= voices.length) {
      throw new Error(
        `Invalid voice ID: ${voiceId}. Available voices: ${voices.length}`,
      );
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices[voiceIndex].nativeVoice;
    utterance.rate = options?.rate ?? this.rate;
    utterance.pitch = options?.pitch ?? this.pitch;
    utterance.lang = "vi-VN";

    return new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Speech synthesis error"));
      speechSynthesis.speak(utterance);
    });
  }

  /** Cancel any in-progress speech. */
  stop(): void {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
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

  getPlaybackOptions(): PlaybackOptions {
    return { playbackRate: 1.0, preservesPitch: true };
  }
}

registerProvider("BrowserTTS", BrowserTTS, "Browser TTS");
