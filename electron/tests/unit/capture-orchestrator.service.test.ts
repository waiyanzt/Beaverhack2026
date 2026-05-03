import type { BrowserWindow } from "electron";
import { describe, expect, it, vi } from "vitest";
import { CaptureOrchestratorService } from "../../src/main/services/capture/capture-orchestrator.service";
import type { CaptureStartRequest } from "../../src/shared/types/capture.types";

const makeWindow = (): BrowserWindow =>
  ({
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
    on: vi.fn(),
    close: vi.fn(),
  }) as unknown as BrowserWindow;

const config: CaptureStartRequest = {
  camera: {
    enabled: true,
    fps: 1,
    maxFrames: 4,
    resolution: "1280x720",
    jpegQuality: 70,
    detail: "low",
    clipDurationSeconds: 10,
    maxClips: 2,
  },
  screen: {
    enabled: false,
    fps: 1,
    maxFrames: 2,
    resolution: "1280x720",
    jpegQuality: 70,
    detail: "low",
    clipDurationSeconds: 10,
    maxClips: 2,
    sourceId: null,
  },
  audio: {
    enabled: true,
    sampleRate: 16000,
    channels: 1,
    bufferDurationSeconds: 5,
    transcriptionEnabled: true,
    sendRawAudio: false,
  },
};

const framePayload = {
  kind: "camera" as const,
  timestampMs: 1_000,
  width: 64,
  height: 64,
  mimeType: "image/jpeg" as const,
  dataUrl: "data:image/jpeg;base64,AAEC",
  detail: "low" as const,
};

describe("CaptureOrchestratorService", () => {
  it("tracks frames and audio while running", async () => {
    const service = new CaptureOrchestratorService({
      createHiddenWindow: async () => makeWindow(),
      clock: () => 2_000,
    });

    const status = await service.start(config);
    expect(status.running).toBe(true);
    expect(status.camera.lastClipAt).toBeNull();

    service.handleFrame(framePayload);
    service.handleAudioChunk({
      timestampMs: 2_000,
      durationMs: 1000,
      mimeType: "audio/webm",
      data: new Uint8Array([1, 2, 3]),
    });
    service.handleClip({
      kind: "camera",
      timestampMs: 2_500,
      durationMs: 10_000,
      mimeType: "video/webm",
      data: new Uint8Array([4, 5]),
    });
    service.handleClip({
      kind: "audio",
      timestampMs: 2_500,
      durationMs: 10_000,
      mimeType: "audio/webm",
      data: new Uint8Array([6, 7]),
    });

    const frames = service.getRecentFrames("camera", 5_000);
    const audio = service.getRecentAudio(5_000);
    const clips = service.getRecentClips("camera", 5_000);
    const latestClip = service.getLatestClip("camera");
    const latestAudioClip = service.getLatestClip("audio");

    expect(frames).toHaveLength(1);
    expect(audio).toHaveLength(1);
    expect(clips).toHaveLength(1);
    expect(latestClip?.mimeType).toBe("video/webm");
    expect(latestAudioClip?.mimeType).toBe("audio/webm");
  });
});
