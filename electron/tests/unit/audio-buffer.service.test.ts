import { describe, expect, it } from "vitest";
import { AudioBufferService } from "../../src/main/services/capture/audio-buffer.service";

const makeChunk = (bytes: number): Buffer => Buffer.alloc(bytes, 1);

describe("AudioBufferService", () => {
  it("returns null when no data in window", () => {
    const buffer = new AudioBufferService({ maxDurationMs: 10_000 });

    expect(buffer.getWindow(1_000, 10_000)).toBeNull();
  });

  it("returns only chunks within the requested window", () => {
    const buffer = new AudioBufferService({ maxDurationMs: 10_000 });

    buffer.appendChunk(makeChunk(2), 1_000);
    buffer.appendChunk(makeChunk(3), 9_000);

    const window = buffer.getWindow(2_000, 10_000);

    expect(window?.data.length).toBe(3);
  });

  it("trims to max bytes", () => {
    const buffer = new AudioBufferService({ maxDurationMs: 10_000, maxBytes: 4 });

    buffer.appendChunk(makeChunk(2), 1_000);
    buffer.appendChunk(makeChunk(2), 2_000);
    buffer.appendChunk(makeChunk(2), 3_000);

    const stats = buffer.getStats();

    expect(stats.totalBytes).toBeLessThanOrEqual(4);
    expect(stats.chunkCount).toBe(2);
  });
});
