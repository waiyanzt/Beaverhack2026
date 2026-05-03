import { describe, expect, it } from "vitest";
import { VideoClipBufferService } from "../../src/main/services/capture/video-clip-buffer.service";

const makeClip = (timestampMs: number, bytes: number) => ({
  timestampMs,
  durationMs: 10_000,
  data: Buffer.alloc(bytes, 1),
  mimeType: "video/webm",
});

describe("VideoClipBufferService", () => {
  it("trims to max entries", () => {
    const buffer = new VideoClipBufferService({ maxEntries: 2, maxDurationMs: 30_000, maxBytes: 1000 });

    buffer.appendClip(makeClip(1_000, 10));
    buffer.appendClip(makeClip(2_000, 10));
    buffer.appendClip(makeClip(3_000, 10));

    const stats = buffer.getStats();

    expect(stats.clipCount).toBe(2);
    expect(stats.oldestTimestampMs).toBe(2_000);
  });

  it("trims to max bytes", () => {
    const buffer = new VideoClipBufferService({ maxEntries: 5, maxDurationMs: 30_000, maxBytes: 12 });

    buffer.appendClip(makeClip(1_000, 10));
    buffer.appendClip(makeClip(2_000, 10));

    const stats = buffer.getStats();

    expect(stats.totalBytes).toBeLessThanOrEqual(12);
  });

  it("returns the latest clip", () => {
    const buffer = new VideoClipBufferService({ maxEntries: 5, maxDurationMs: 30_000, maxBytes: 1000 });

    buffer.appendClip(makeClip(1_000, 10));
    buffer.appendClip(makeClip(2_000, 10));

    expect(buffer.getLatest()?.timestampMs).toBe(2_000);
  });
});
