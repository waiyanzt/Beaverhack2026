import { Buffer } from "node:buffer";

export type VideoClipEntry = {
  timestampMs: number;
  durationMs: number;
  data: Buffer;
  mimeType: string;
};

export type VideoClipBufferStats = {
  clipCount: number;
  totalBytes: number;
  oldestTimestampMs: number | null;
  newestTimestampMs: number | null;
};

export type VideoClipBufferOptions = {
  maxDurationMs: number;
  maxBytes: number;
  maxEntries: number;
};

const DEFAULT_CLIP_OPTIONS: VideoClipBufferOptions = {
  maxDurationMs: 60_000,
  maxBytes: 80 * 1024 * 1024,
  maxEntries: 6,
};

export class VideoClipBufferService {
  private readonly maxDurationMs: number;
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private clips: VideoClipEntry[] = [];
  private totalBytes = 0;

  constructor(options: Partial<VideoClipBufferOptions> = {}) {
    const merged = { ...DEFAULT_CLIP_OPTIONS, ...options };

    if (merged.maxDurationMs <= 0 || merged.maxBytes <= 0 || merged.maxEntries <= 0) {
      throw new Error("VideoClipBufferService limits must be positive.");
    }

    this.maxDurationMs = merged.maxDurationMs;
    this.maxBytes = merged.maxBytes;
    this.maxEntries = merged.maxEntries;
  }

  appendClip(entry: VideoClipEntry): void {
    if (entry.data.length === 0) {
      return;
    }

    this.clips.push(entry);
    this.totalBytes += entry.data.length;
    this.trim(entry.timestampMs);
  }

  clear(): void {
    this.clips = [];
    this.totalBytes = 0;
  }

  getStats(): VideoClipBufferStats {
    return {
      clipCount: this.clips.length,
      totalBytes: this.totalBytes,
      oldestTimestampMs: this.clips[0]?.timestampMs ?? null,
      newestTimestampMs: this.clips.at(-1)?.timestampMs ?? null,
    };
  }

  getWindow(windowMs: number, nowMs: number = Date.now()): VideoClipEntry[] {
    if (windowMs <= 0 || this.clips.length === 0) {
      return [];
    }

    const cutoff = nowMs - windowMs;
    return this.clips.filter((clip) => clip.timestampMs >= cutoff);
  }

  getLatest(): VideoClipEntry | null {
    return this.clips.at(-1) ?? null;
  }

  private trim(nowMs: number): void {
    const cutoff = nowMs - this.maxDurationMs;

    while (this.clips.length > 0 && this.clips[0].timestampMs < cutoff) {
      const removed = this.clips.shift();

      if (removed) {
        this.totalBytes -= removed.data.length;
      }
    }

    while (this.clips.length > this.maxEntries) {
      const removed = this.clips.shift();

      if (removed) {
        this.totalBytes -= removed.data.length;
      }
    }

    while (this.totalBytes > this.maxBytes && this.clips.length > 0) {
      const removed = this.clips.shift();

      if (removed) {
        this.totalBytes -= removed.data.length;
      }
    }
  }
}
