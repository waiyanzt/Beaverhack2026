import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { LiveCaptureInputService } from "../../src/main/services/automation/live-capture-input.service";

vi.mock("../../src/main/utils/media-conversion", () => ({
  extractFramesFromVideo: vi.fn(async () =>
    Array.from({ length: 5 }, (_, i) => ({
      index: i,
      timestampMs: i * 500,
      data: Buffer.from(`frame-${i}`),
    })),
  ),
}));

describe("LiveCaptureInputService", () => {
  it("extracts sequential frames from a camera clip and returns image_url parts", async () => {
    const nowMs = Date.now();
    const provider = {
      getLatestClip: (kind: "camera" | "audio") => {
        if (kind === "camera") {
          return {
            timestampMs: nowMs,
            durationMs: 2_000,
            mimeType: "video/webm;codecs=vp9",
            data: Buffer.from("camera"),
          };
        }

        return null;
      },
      getRecentRawClips: () => [],
    };

    const service = new LiveCaptureInputService(provider);
    const result = await service.buildPromptInput(2_000);

    expect(result.parts.length).toBe(6);

    const imageParts = result.parts.filter((p) => p.type === "image_url");
    expect(imageParts.length).toBe(5);
    expect(imageParts[0]).toEqual({
      type: "image_url",
      image_url: {
        url: expect.stringContaining("data:image/jpeg;base64,"),
        detail: "low",
      },
    });

    const textParts = result.parts.filter((p) => p.type === "text");
    expect(textParts.length).toBe(1);
    expect((textParts[0] as { text: string }).text).toContain("sequential_webcam_frames");
  });
});