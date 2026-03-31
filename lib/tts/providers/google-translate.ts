import { registerProvider } from "./registry";
import type { PlaybackOptions, TTSOptions, TTSProvider, Voice } from "./types";

const PROXY_URL = "http://14.225.254.182/io/s1213/googletranslatetts?text=";
const MAX_CHUNK_SIZE = 120;
const AUDIO_SAMPLE_RATE = 24_000;

/**
 * Fetch with a timeout. Rejects if the request takes longer than `ms`.
 */
async function fetchWithTimeout(url: string, ms = 4_000): Promise<Response> {
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
 * Split text into chunks that fit the Google Translate TTS URL limit.
 * Prefers splitting at commas when possible.
 */
function splitTextIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_SIZE) {
      chunks.push(remaining.trim());
      break;
    }

    let splitIndex = MAX_CHUNK_SIZE;
    const searchText = remaining.substring(0, MAX_CHUNK_SIZE + 1);
    const lastCommaIndex = searchText.lastIndexOf(",");

    if (lastCommaIndex > 0) {
      splitIndex = lastCommaIndex;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining
      .substring(splitIndex + (lastCommaIndex > 0 ? 1 : 0))
      .trim();
  }

  return chunks;
}

/**
 * Concatenate multiple AudioBuffers into a single AudioBuffer.
 */
function concatAudioBuffers(
  context: BaseAudioContext,
  buffers: AudioBuffer[],
): AudioBuffer {
  const maxChannels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const sampleRate = buffers[0].sampleRate;
  const output = context.createBuffer(maxChannels, totalLength, sampleRate);

  let offset = 0;
  for (const buffer of buffers) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      output.getChannelData(ch).set(buffer.getChannelData(ch), offset);
    }
    offset += buffer.length;
  }
  return output;
}

/**
 * Convert an AudioBuffer to a WAV Blob.
 */
function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const dataSize = audioBuffer.length * numberOfChannels * 2;
  const totalLength = 44 + dataSize;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let offset = 0;
  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
    offset += str.length;
  };

  // RIFF header
  writeString("RIFF");
  view.setUint32(offset, totalLength - 8, true);
  offset += 4;
  writeString("WAVE");

  // fmt sub-chunk
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true); // PCM
  offset += 2;
  view.setUint16(offset, numberOfChannels, true);
  offset += 2;
  view.setUint32(offset, audioBuffer.sampleRate, true);
  offset += 4;
  view.setUint32(offset, audioBuffer.sampleRate * numberOfChannels * 2, true);
  offset += 4;
  view.setUint16(offset, numberOfChannels * 2, true);
  offset += 2;
  view.setUint16(offset, 16, true); // bits per sample
  offset += 2;

  // data sub-chunk
  writeString("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Google Translate TTS provider.
 *
 * Uses the classic Google Translate text-to-speech voice.
 * Long texts are split into chunks, fetched individually, and concatenated
 * into a single WAV blob via OfflineAudioContext.
 *
 * Rate is applied at playback time via `getPlaybackOptions()`.
 */
export class GoogleTranslateTTS implements TTSProvider {
  readonly id = "googletranslate";
  readonly name = "GoogleTranslateTTS";
  readonly friendlyName = "Google Translate TTS";

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
        name: "Google Translate",
        fullName: "Google Translate (Tiếng Việt)",
      },
    ];
  }

  async fetchAudio(text: string, _options?: TTSOptions): Promise<Blob> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text is required");
    }

    // Short text — single request
    if (text.length <= MAX_CHUNK_SIZE) {
      const url = `${PROXY_URL}${encodeURIComponent(text)}`;
      const response = await fetchWithTimeout(url);
      return response.blob();
    }

    // Long text — split into chunks, fetch each, concatenate
    const chunks = splitTextIntoChunks(text);
    const audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });

    try {
      const audioBuffers: AudioBuffer[] = [];

      for (const chunk of chunks) {
        if (chunk.length === 0) continue;

        const url = `${PROXY_URL}${encodeURIComponent(chunk)}`;
        const response = await fetchWithTimeout(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers.push(audioBuffer);
      }

      if (audioBuffers.length === 0) {
        throw new Error("No audio data received");
      }

      const concatenated = concatAudioBuffers(audioContext, audioBuffers);
      const offlineCtx = new OfflineAudioContext(
        concatenated.numberOfChannels,
        concatenated.length,
        concatenated.sampleRate,
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = concatenated;
      source.connect(offlineCtx.destination);
      source.start();
      const rendered = await offlineCtx.startRendering();

      return audioBufferToWavBlob(rendered);
    } finally {
      await audioContext.close();
    }
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

registerProvider("GoogleTranslateTTS", GoogleTranslateTTS, "Google Translate TTS");
