import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { LiveCaptureInputService } from "../../src/main/services/automation/live-capture-input.service";

vi.mock("../../src/main/utils/media-conversion", () => ({
  convertVideoAndAudioClipsToMp4: vi.fn(async () => Buffer.from("muxed-mp4")),
  convertVideoClipToMp4: vi.fn(async () => Buffer.from("video-only-mp4")),
}));

describe("LiveCaptureInputService", () => {
  it("selects the audio clip with the best overlap for the current camera clip", async () => {
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

        return {
          timestampMs: nowMs + 600,
          durationMs: 2_000,
          mimeType: "audio/webm;codecs=opus",
          data: Buffer.from("latest-audio"),
        };
      },
      getRecentRawClips: (kind: "camera" | "audio") => {
        if (kind === "camera") {
          return [];
        }

        return [
          {
            timestampMs: nowMs - 1_300,
            durationMs: 2_000,
            mimeType: "audio/webm;codecs=opus",
            data: Buffer.from("poor-overlap"),
          },
          {
            timestampMs: nowMs + 50,
            durationMs: 2_000,
            mimeType: "audio/webm;codecs=opus",
            data: Buffer.from("best-overlap"),
          },
        ];
      },
    };

    const service = new LiveCaptureInputService(provider);
    const result = await service.buildPromptInput(2_000);

    expect(result.sourceWindowKey).toContain(`camera:${nowMs}:2000`);
    expect(result.sourceWindowKey).toContain(`audio:${nowMs + 50}:2000`);
  });
});
