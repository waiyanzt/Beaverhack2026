import { createHash } from "node:crypto";
import type { OpenAICompatibleMessagePart } from "../../../shared/model.types";
import { encodeDataUrl } from "../../utils/base64";
import { extractFramesFromVideo } from "../../utils/media-conversion";

type RawClipData = {
  timestampMs: number;
  durationMs: number;
  mimeType: string;
  data: Buffer;
};

interface LiveCaptureProvider {
  getLatestClip(kind: "camera" | "audio"): RawClipData | null;
  getRecentRawClips?(kind: "camera" | "audio", windowMs: number): RawClipData[];
}

export interface LiveCapturePromptInput {
  parts: OpenAICompatibleMessagePart[];
  promptTextBytes: number;
  mediaDataUrlBytes: number;
  sourceWindowKey: string;
  sourceClipCount: number;
  modelMediaSha256: string | null;
  modelMediaDataUrl: string | null;
  mediaStartMs: number | null;
  mediaEndMs: number | null;
}

const FRAME_COUNT = 3;
const FRAME_INTERVAL_MS = 600;
const FRAME_WIDTH = 320;
const FRAME_JPEG_QUALITY = 15;

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString();

export class LiveCaptureInputService {
  private readonly frameCache = new Map<string, { frames: Array<{ index: number; timestampMs: number; dataUrl: string }>; timestampMs: number; durationMs: number }>();

  public constructor(private readonly captureProvider: LiveCaptureProvider) { }

  public async buildPromptInput(windowMs: number): Promise<LiveCapturePromptInput> {
    const cameraClip = this.getFreshRawClip("camera", windowMs);

    if (!cameraClip) {
      throw new Error("No fresh camera capture clip is available for automation.");
    }

    const frames = await this.getModelFrames(cameraClip);
    const frameParts: OpenAICompatibleMessagePart[] = frames.map((f) => ({
      type: "image_url" as const,
      image_url: {
        url: f.dataUrl,
        detail: "low" as const,
      },
    }));

    const promptPayload = {
      task: [
        "Analyze these sequential webcam frames (captured 500ms apart over ~2 seconds) as a stateless live observation.",
        "Use the sequence of frames to infer motion, expression changes, and context over time.",
        "Set response.visibleToUser to true and response.text to one concise sentence describing what is clearly visible in the frames.",
        "If the camera image is empty, covered, black, or pointed away, say that no person is visible.",
        "Do not infer visual appearance from audio or other non-visual cues.",
        "When choosing a VTS reaction, use only services.vts.automationCatalog.candidates from the current model context.",
        "Use each candidate's user-provided label and description to decide the reaction.",
        "Return vts.trigger_hotkey only with catalogId and catalogVersion from that automation catalog. Do not invent or reuse raw VTS hotkey IDs.",
        "Use exactly one noop action for idle, unclear, covered-camera, or ordinary sitting clips.",
      ],
      capture: {
        windowMs,
        layout: "sequential_webcam_frames",
        frameCount: frames.length,
        frameIntervalMs: FRAME_INTERVAL_MS,
        camera: this.toRawClipSummary(cameraClip),
        modelMedia: {
          type: "image_frames" as const,
          frameCount: frames.length,
        },
      },
    };

    const promptText = JSON.stringify(promptPayload);
    const totalMediaBytes = frames.reduce((sum, f) => sum + Buffer.byteLength(f.dataUrl, "utf8"), 0);

    return {
      parts: [
        ...frameParts,
        {
          type: "text",
          text: promptText,
        },
      ],
      promptTextBytes: Buffer.byteLength(promptText, "utf8"),
      mediaDataUrlBytes: totalMediaBytes,
      sourceWindowKey: this.getClipCacheKey("camera", cameraClip),
      sourceClipCount: 1,
      modelMediaSha256: createHash("sha256")
        .update(cameraClip.data)
        .digest("hex"),
      modelMediaDataUrl: frames.length > 0 ? frames[0].dataUrl : null,
      mediaStartMs: cameraClip.timestampMs - cameraClip.durationMs,
      mediaEndMs: cameraClip.timestampMs,
    };
  }

  private getFreshRawClip(kind: "camera" | "audio", windowMs: number): RawClipData | null {
    const clip = this.captureProvider.getLatestClip(kind);

    if (!clip || Date.now() - clip.timestampMs > windowMs + 2_000) {
      return null;
    }

    return clip;
  }

  private async getModelFrames(cameraClip: RawClipData): Promise<Array<{ index: number; timestampMs: number; dataUrl: string }>> {
    const cacheKey = `${cameraClip.timestampMs}:${cameraClip.durationMs}:${cameraClip.mimeType}`;
    const cached = this.frameCache.get(cacheKey);

    if (cached) {
      return cached.frames;
    }

    const rawFrames = await extractFramesFromVideo(
      { data: cameraClip.data, mimeType: cameraClip.mimeType },
      FRAME_COUNT,
      FRAME_INTERVAL_MS,
      FRAME_WIDTH,
      FRAME_JPEG_QUALITY,
    );

    const frames = rawFrames.map((f) => ({
      index: f.index,
      timestampMs: f.timestampMs,
      dataUrl: encodeDataUrl("image/jpeg", f.data),
    }));

    const result = {
      frames,
      timestampMs: cameraClip.timestampMs,
      durationMs: cameraClip.durationMs,
    };

    this.frameCache.set(cacheKey, result);
    if (this.frameCache.size > 12) {
      const oldestKey = this.frameCache.keys().next().value;
      if (oldestKey) {
        this.frameCache.delete(oldestKey);
      }
    }

    return frames;
  }

  private getClipCacheKey(kind: "camera" | "audio", clip: RawClipData | null): string {
    if (!clip) {
      return `${kind}:none`;
    }

    return `${kind}:${clip.timestampMs}:${clip.durationMs}:${clip.mimeType}`;
  }

  private toRawClipSummary(clip: RawClipData | null): Record<string, unknown> {
    return {
      available: clip !== null,
      clipCount: clip ? 1 : 0,
      windowStartedAt: clip ? toIso(clip.timestampMs - clip.durationMs) : null,
      windowEndedAt: clip ? toIso(clip.timestampMs) : null,
      capturedAt: clip ? toIso(clip.timestampMs) : null,
      durationMs: clip?.durationMs ?? null,
      mimeType: clip?.mimeType ?? null,
    };
  }
}