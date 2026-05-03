import { createHash } from "node:crypto";
import type { OpenAICompatibleMessagePart } from "../../../shared/model.types";
import { encodeDataUrl } from "../../utils/base64";
import { convertVideoAndAudioClipsToMp4, convertVideoClipToMp4 } from "../../utils/media-conversion";

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

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString();

export class LiveCaptureInputService {
  private readonly convertedClipCache = new Map<string, { dataUrl: string; timestampMs: number; durationMs: number }>();

  public constructor(private readonly captureProvider: LiveCaptureProvider) {}

  public async buildPromptInput(windowMs: number): Promise<LiveCapturePromptInput> {
    const cameraClip = this.getFreshRawClip("camera", windowMs);

    if (!cameraClip) {
      throw new Error("No fresh camera capture clip is available for automation.");
    }

    const audioClip = this.getBestMatchingAudioClip(cameraClip, windowMs);
    const modelClip = await this.getModelVideoClip(cameraClip, audioClip);
    const promptPayload = {
      task: [
        "Analyze only this current webcam/audio clip as a stateless live observation.",
        "First, transcribe the full audible speech from this clip into response.audioTranscript before deciding actions. Use '[no speech]' if no speech is audible and '[inaudible]' if speech is present but unclear.",
        "Set response.visibleToUser to true and response.text to one concise sentence describing what is clearly visible or audible in this clip.",
        "If the camera image is empty, covered, black, or pointed away, say that no person is visible.",
        "Do not use audio to infer visual appearance such as hair, beard, room, posture, or whether a person is visible.",
        "When choosing a VTS reaction, use only services.vts.automationCatalog.candidates from the current model context.",
        "Return vts.trigger_hotkey only with catalogId and catalogVersion from that automation catalog. Do not invent or reuse raw VTS hotkey IDs.",
        "Use exactly one noop action for idle, unclear, covered-camera, or ordinary speaking/sitting clips.",
      ],
      capture: {
        windowMs,
        layout: "single_fresh_webcam_mp4",
        camera: this.toRawClipSummary(cameraClip),
        audio: {
          ...this.toRawClipSummary(audioClip),
          packaging: audioClip ? "muxed_into_webcam_mp4" : "not_available",
        },
        modelMedia: this.toModelClipSummary(modelClip),
      },
    };

    const promptText = JSON.stringify(promptPayload, null, 2);

    return {
      parts: [
        {
          type: "video_url",
          video_url: {
            url: modelClip.dataUrl,
          },
        },
        {
          type: "text",
          text: promptText,
        },
      ],
      promptTextBytes: Buffer.byteLength(promptText, "utf8"),
      mediaDataUrlBytes: Buffer.byteLength(modelClip.dataUrl, "utf8"),
      sourceWindowKey: `${this.getClipCacheKey("camera", cameraClip)}:${this.getClipCacheKey("audio", audioClip)}`,
      sourceClipCount: audioClip ? 2 : 1,
      modelMediaSha256: createHash("sha256").update(modelClip.dataUrl).digest("hex"),
      modelMediaDataUrl: modelClip.dataUrl,
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

  private getBestMatchingAudioClip(cameraClip: RawClipData, windowMs: number): RawClipData | null {
    const recentAudioClips = this.captureProvider.getRecentRawClips?.("audio", windowMs) ?? [];

    if (recentAudioClips.length === 0) {
      return this.getFreshRawClip("audio", windowMs);
    }

    const cameraStartMs = cameraClip.timestampMs - cameraClip.durationMs;
    const cameraEndMs = cameraClip.timestampMs;
    let bestClip: RawClipData | null = null;
    let bestOverlapMs = -1;

    for (const clip of recentAudioClips) {
      if (Date.now() - clip.timestampMs > windowMs + 2_000) {
        continue;
      }

      const clipStartMs = clip.timestampMs - clip.durationMs;
      const clipEndMs = clip.timestampMs;
      const overlapMs = Math.min(cameraEndMs, clipEndMs) - Math.max(cameraStartMs, clipStartMs);

      if (overlapMs <= 0) {
        continue;
      }

      if (overlapMs > bestOverlapMs || (overlapMs === bestOverlapMs && clip.timestampMs > (bestClip?.timestampMs ?? 0))) {
        bestClip = clip;
        bestOverlapMs = overlapMs;
      }
    }

    return bestClip ?? this.getFreshRawClip("audio", windowMs);
  }

  private async getModelVideoClip(
    cameraClip: RawClipData,
    audioClip: RawClipData | null,
  ): Promise<{ dataUrl: string; timestampMs: number; durationMs: number }> {
    const cacheKey = audioClip
      ? `camera:${cameraClip.timestampMs}:${cameraClip.durationMs}:${cameraClip.mimeType}:audio:${audioClip.timestampMs}:${audioClip.durationMs}:${audioClip.mimeType}`
      : `camera:${cameraClip.timestampMs}:${cameraClip.durationMs}:${cameraClip.mimeType}`;
    const cached = this.convertedClipCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const data = audioClip
      ? await convertVideoAndAudioClipsToMp4(cameraClip, audioClip)
      : await convertVideoClipToMp4(cameraClip);
    const modelClip = {
      timestampMs: cameraClip.timestampMs,
      durationMs: cameraClip.durationMs,
      dataUrl: encodeDataUrl("video/mp4", data),
    };

    this.convertedClipCache.set(cacheKey, modelClip);
    if (this.convertedClipCache.size > 12) {
      const oldestKey = this.convertedClipCache.keys().next().value;
      if (oldestKey) {
        this.convertedClipCache.delete(oldestKey);
      }
    }

    return modelClip;
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

  private toModelClipSummary(clip: { dataUrl: string; timestampMs: number; durationMs: number }): Record<string, unknown> {
    return {
      available: true,
      windowStartedAt: toIso(clip.timestampMs - clip.durationMs),
      windowEndedAt: toIso(clip.timestampMs),
      capturedAt: toIso(clip.timestampMs),
      durationMs: clip.durationMs,
      mimeType: "video/mp4",
    };
  }
}
