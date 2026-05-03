import { describe, expect, it } from "vitest";
import { FrameBufferService } from "../../src/main/services/capture/frame-buffer.service";

const makeFrame = (timestampMs: number, bytes: number) => ({
  timestampMs,
  data: Buffer.alloc(bytes, 2),
  width: 1280,
  height: 720,
  mimeType: "image/jpeg",
});

describe("FrameBufferService", () => {
  it("returns only frames within the requested window", () => {
    const buffer = new FrameBufferService({ maxDurationMs: 10_000 });

    buffer.appendFrame(makeFrame(1_000, 5));
    buffer.appendFrame(makeFrame(9_000, 5));

    const window = buffer.getWindow(2_000, 10_000);

    expect(window).toHaveLength(1);
    expect(window[0].timestampMs).toBe(9_000);
  });

  it("trims to max entries", () => {
    const buffer = new FrameBufferService({ maxDurationMs: 10_000, maxEntries: 2 });

    buffer.appendFrame(makeFrame(1_000, 5));
    buffer.appendFrame(makeFrame(2_000, 5));
    buffer.appendFrame(makeFrame(3_000, 5));

    const stats = buffer.getStats();

    expect(stats.frameCount).toBe(2);
    expect(stats.oldestTimestampMs).toBe(2_000);
  });

  it("trims to max bytes", () => {
    const buffer = new FrameBufferService({ maxDurationMs: 10_000, maxBytes: 8 });

    buffer.appendFrame(makeFrame(1_000, 5));
    buffer.appendFrame(makeFrame(2_000, 5));

    const stats = buffer.getStats();

    expect(stats.totalBytes).toBeLessThanOrEqual(8);
  });
});
