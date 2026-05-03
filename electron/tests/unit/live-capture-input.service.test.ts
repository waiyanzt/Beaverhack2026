import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { LiveCaptureInputService } from "../../src/main/services/automation/live-capture-input.service";

vi.mock("../../src/main/utils/media-conversion", () => ({
  convertVideoAndAudioClipsToMp4: vi.fn(async () => Buffer.from("muxed-mp4")),
  convertVideoClipToMp4: vi.fn(async () => Buffer.from("video-only-mp4")),
}));

describe("LiveCaptureInputService", () => {
  it("can build a low-latency latest-frame prompt without video conversion", async () => {
    const nowMs = Date.now();
    const provider = {
      getLatestClip: vi.fn(),
      getLatestFrame: vi.fn().mockReturnValue({
        timestampMs: nowMs,
        width: 640,
        height: 360,
        mimeType: "image/jpeg",
        data: Buffer.from("jpeg-frame"),
      }),
    };

    const service = new LiveCaptureInputService(provider);
    const result = await service.buildPromptInput(1_000, "latest_frame");

    expect(result.parts[0]).toMatchObject({
      type: "image_url",
      image_url: {
        detail: "low",
      },
    });
    expect(result.sourceWindowKey).toContain(`camera-frame:${nowMs}:640x360:image/jpeg`);
    expect(result.mediaStartMs).toBe(nowMs);
    expect(result.mediaEndMs).toBe(nowMs);
    expect(provider.getLatestClip).not.toHaveBeenCalled();
  });

  it("instructs covered or empty camera frames to use the vacant cue instead of noop", async () => {
    const nowMs = Date.now();
    const provider = {
      getLatestClip: vi.fn(),
      getLatestFrame: vi.fn().mockReturnValue({
        timestampMs: nowMs,
        width: 640,
        height: 360,
        mimeType: "image/jpeg",
        data: Buffer.from("jpeg-frame"),
      }),
    };

    const service = new LiveCaptureInputService(provider);
    const result = await service.buildPromptInput(1_000, "latest_frame", ["vacant"]);
    const textPart = result.parts.find((part) => part.type === "text");

    expect(textPart?.type).toBe("text");
    if (textPart?.type !== "text") {
      return;
    }

    expect(textPart.text).toContain("must use cueLabels ['vacant'], not noop");
    expect(textPart.text).not.toContain("covered-camera frames");
  });

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
