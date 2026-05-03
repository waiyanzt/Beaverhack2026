import type { WebContents } from "electron";
import { createHash } from "node:crypto";
import { IpcChannels } from "../../../shared/channels";
import type { CaptureStartRequest } from "../../../shared/types/capture.types";
import type {
  ModelMonitorEvent,
  ModelMonitorMediaAvailability,
  ModelMonitorRequestDebug,
  ModelMonitorStartRequest,
  ModelMonitorStatus,
  ModelMonitorTiming,
} from "../../../shared/types/model-monitor.types";
import type { OpenAICompatibleMessage, OpenAICompatibleMessagePart } from "../../../shared/model.types";
import { encodeDataUrl } from "../../utils/base64";
import { createId } from "../../utils/ids";
import {
  convertVideoAndAudioClipsToMp4,
  convertVideoClipToMp4,
} from "../../utils/media-conversion";
import { loadPrompt } from "../../prompts/prompt-loader";
import type { CaptureOrchestratorService } from "../capture/capture-orchestrator.service";
import { setSelectedScreenSourceId } from "../capture/capture-orchestrator.instance";
import type { ModelRouterService } from "./model-router.service";

type ClipData = {
  timestampMs: number;
  durationMs: number;
  mimeType: string;
  dataUrl: string;
};

type RawClipData = {
  timestampMs: number;
  durationMs: number;
  mimeType: string;
  data: Buffer;
};

type PreparedModelRequest = {
  requestNumber: number;
  messages: OpenAICompatibleMessage[];
  mediaStartMs: number | null;
  mediaEndMs: number | null;
  promptTextBytes: number;
  mediaDataUrlBytes: number;
  sourceWindowKey: string;
  sourceClipCount: number;
  modelMediaSha256: string | null;
  modelMediaDataUrl: string | null;
};

const DEFAULT_STATUS: ModelMonitorStatus = {
  running: false,
  startedAt: null,
  tickIntervalMs: 500,
  windowMs: 2_000,
  inFlight: false,
  tickCount: 0,
  skippedTickCount: 0,
  lastTickAt: null,
  lastResponseAt: null,
  lastMediaEndedAt: null,
  lastRequestStartedAt: null,
  lastEndToResponseLatencyMs: null,
  lastRequestLatencyMs: null,
  lastError: null,
};

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString();
const MAX_LIVE_CLIP_AGE_MS = 1_500;

export class ModelMonitorService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private owner: WebContents | null = null;
  private status: ModelMonitorStatus = { ...DEFAULT_STATUS };
  private convertedClipCache = new Map<string, ClipData>();
  private lastSubmittedMediaKey: string | null = null;

  public constructor(
    private readonly captureOrchestrator: CaptureOrchestratorService,
    private readonly modelRouter: ModelRouterService,
  ) {}

  public async start(request: ModelMonitorStartRequest, owner: WebContents): Promise<ModelMonitorStatus> {
    await this.stop();
    this.owner = owner;
    this.lastSubmittedMediaKey = null;
    this.status = {
      ...DEFAULT_STATUS,
      running: true,
      startedAt: toIso(Date.now()),
      tickIntervalMs: request.tickIntervalMs,
      windowMs: request.windowMs,
    };

    setSelectedScreenSourceId(request.capture.screen.sourceId ?? null);
    await this.captureOrchestrator.start(request.capture);
    this.emit({ type: "status", createdAt: toIso(Date.now()), status: this.getStatus() });

    this.timer = setInterval(() => {
      void this.runTick(request.capture);
    }, request.tickIntervalMs);

    void this.runTick(request.capture);

    return this.getStatus();
  }

  public async stop(): Promise<ModelMonitorStatus> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.status.running) {
      await this.captureOrchestrator.stop();
    }

    this.status = {
      ...this.status,
      running: false,
      inFlight: false,
    };
    this.emit({ type: "status", createdAt: toIso(Date.now()), status: this.getStatus() });
    this.owner = null;

    return this.getStatus();
  }

  public getStatus(): ModelMonitorStatus {
    return { ...this.status };
  }

  private async runTick(capture: CaptureStartRequest): Promise<void> {
    if (!this.status.running) {
      return;
    }

    const tickId = createId("monitor_tick");
    const createdAt = toIso(Date.now());
    const media = this.getMediaAvailability();

    if (this.status.inFlight) {
      this.status = {
        ...this.status,
        skippedTickCount: this.status.skippedTickCount + 1,
      };
      this.emit({
        type: "tick-skipped",
        createdAt,
        tickId,
        reason: "Previous model request is still in flight.",
        status: this.getStatus(),
        media,
      });
      return;
    }

    if (!media.camera) {
      this.status = {
        ...this.status,
        skippedTickCount: this.status.skippedTickCount + 1,
        lastTickAt: createdAt,
      };
      this.emit({
        type: "tick-skipped",
        createdAt,
        tickId,
        reason: "Waiting for a fresh camera clip.",
        status: this.getStatus(),
        media,
      });
      return;
    }

    const currentMedia = this.getCurrentMedia();
    if (!currentMedia) {
      this.status = {
        ...this.status,
        skippedTickCount: this.status.skippedTickCount + 1,
        lastTickAt: createdAt,
      };
      this.emit({
        type: "tick-skipped",
        createdAt,
        tickId,
        reason: "Waiting for the next completed capture clip.",
        status: this.getStatus(),
        media,
      });
      return;
    }

    if (Date.now() - currentMedia.mediaEndMs > MAX_LIVE_CLIP_AGE_MS) {
      this.status = {
        ...this.status,
        skippedTickCount: this.status.skippedTickCount + 1,
        lastTickAt: createdAt,
      };
      this.emit({
        type: "tick-skipped",
        createdAt,
        tickId,
        reason: "Latest completed capture clip is too old for live mode.",
        status: this.getStatus(),
        media,
      });
      return;
    }

    if (currentMedia.key === this.lastSubmittedMediaKey) {
      this.status = {
        ...this.status,
        skippedTickCount: this.status.skippedTickCount + 1,
        lastTickAt: createdAt,
      };
      this.emit({
        type: "tick-skipped",
        createdAt,
        tickId,
        reason: "Waiting for the next completed capture clip.",
        status: this.getStatus(),
        media,
      });
      return;
    }

    this.status = {
      ...this.status,
      inFlight: true,
      tickCount: this.status.tickCount + 1,
      lastTickAt: createdAt,
    };
    this.lastSubmittedMediaKey = currentMedia.key;
    this.emit({ type: "tick-started", createdAt, tickId, status: this.getStatus(), media });

    try {
      const conversionStartedMs = Date.now();
      const prepared = await this.buildMessages(tickId, capture, this.status.tickCount);
      const requestStartedMs = Date.now();
      const result = await this.modelRouter.requestActionPlan(prepared.messages);
      const responseMs = Date.now();
      const responseAt = toIso(responseMs);
      const timing = this.buildTiming({
        mediaStartMs: prepared.mediaStartMs,
        mediaEndMs: prepared.mediaEndMs,
        conversionStartedMs,
        requestStartedMs,
        responseMs,
      });

      this.status = {
        ...this.status,
        inFlight: false,
        lastResponseAt: responseAt,
        lastMediaEndedAt: timing.mediaEndedAt,
        lastRequestStartedAt: timing.requestStartedAt,
        lastEndToResponseLatencyMs: timing.endToResponseLatencyMs,
        lastRequestLatencyMs: timing.requestLatencyMs,
        lastError: result.ok ? null : result.content,
      };
      this.emit({
        type: "response",
        createdAt: responseAt,
        tickId,
        ok: result.ok,
        providerId: result.providerId,
        statusCode: result.status,
        content: result.content,
        actionPlan: result.actionPlan,
        modelMediaDataUrl: prepared.modelMediaDataUrl ?? undefined,
        status: this.getStatus(),
        media: this.getMediaAvailability(),
        timing,
        debug: this.buildRequestDebug(prepared, result.usage),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Model monitor tick failed.";
      const failedAt = toIso(Date.now());
      this.status = {
        ...this.status,
        inFlight: false,
        lastResponseAt: failedAt,
        lastError: message,
      };
      this.emit({
        type: "error",
        createdAt: failedAt,
        tickId,
        message,
        status: this.getStatus(),
        media: this.getMediaAvailability(),
      });
    }
  }

  private async buildMessages(
    tickId: string,
    capture: CaptureStartRequest,
    requestNumber: number,
  ): Promise<PreparedModelRequest> {
    const mediaParts: OpenAICompatibleMessagePart[] = [];
    const audioClip = this.getFreshRawClip("audio");
    const cameraRawClip = this.getFreshRawClip("camera");
    const cameraClip = await this.getModelVideoClip("camera", audioClip);

    let mediaDataUrlBytes = 0;

    if (cameraClip) {
      mediaDataUrlBytes += Buffer.byteLength(cameraClip.dataUrl, "utf8");
      mediaParts.push({ type: "video_url", video_url: { url: cameraClip.dataUrl } });
    }

    const promptText = JSON.stringify({
      task: [
        "Analyze only this current webcam/audio clip as a stateless live observation.",
        "First, transcribe the full audible speech from this clip into response.audioTranscript before deciding actions. Use '[no speech]' if no speech is audible and '[inaudible]' if speech is present but unclear.",
        "Set response.visibleToUser to true and response.text to one concise sentence describing what is clearly visible or audible in this clip.",
        "If the camera image is empty, covered, black, or pointed away, say that no person is visible.",
        "Do not use audio to infer visual appearance such as hair, beard, room, posture, or whether a person is visible.",
        "For demo behavior: use vts.trigger_hotkey with hotkeyId 'wave' when the streamer clearly waves or raises an open hand toward the camera, 'laugh' when the streamer clearly laughs or smiles broadly, and 'surprise' when the streamer is visibly startled.",
        "Use exactly one noop action for idle, unclear, covered-camera, or ordinary speaking/sitting clips.",
        "For this development build, produce the normal ActionPlan but do not assume actions will be executed.",
      ].join(" "),
      tickId,
      requestNumber,
      createdAt: toIso(Date.now()),
      capture: {
        windowMs: this.status.windowMs,
        layout: "single_fresh_webcam_mp4",
        camera: this.toRawClipSummary(cameraRawClip, capture.camera.deviceId ?? null),
        audio: {
          selectedSourceId: capture.audio.deviceId ?? null,
          ...this.toRawClipSummary(audioClip, capture.audio.deviceId ?? null),
          packaging: audioClip ? "muxed_into_webcam_mp4" : "not_available",
        },
        modelMedia: this.toClipSummary(cameraClip, "webcam"),
      },
      context: {
        autonomyLevel: "auto_safe",
        recentActions: [],
        cooldowns: {},
      },
    });

    mediaParts.push({
      type: "text",
      text: promptText,
    });

    return {
      requestNumber,
      messages: [
        {
          role: "system",
          content: `${loadPrompt("system").content}\n\n${loadPrompt("action-planner").content}`,
        },
        {
          role: "user",
          content: mediaParts,
        },
      ],
      mediaStartMs: cameraRawClip ? cameraRawClip.timestampMs - cameraRawClip.durationMs : null,
      mediaEndMs: cameraRawClip?.timestampMs ?? null,
      promptTextBytes: Buffer.byteLength(promptText, "utf8"),
      mediaDataUrlBytes,
      sourceWindowKey: `${this.getClipCacheKey("camera", cameraRawClip)}:${this.getClipCacheKey("audio", audioClip)}`,
      sourceClipCount: (cameraRawClip ? 1 : 0) + (audioClip ? 1 : 0),
      modelMediaSha256: cameraClip ? this.hashDataUrl(cameraClip.dataUrl) : null,
      modelMediaDataUrl: cameraClip?.dataUrl ?? null,
    };
  }

  private buildRequestDebug(
    prepared: PreparedModelRequest,
    usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | undefined,
  ): ModelMonitorRequestDebug {
    return {
      requestNumber: prepared.requestNumber,
      promptTextBytes: prepared.promptTextBytes,
      mediaDataUrlBytes: prepared.mediaDataUrlBytes,
      requestContentBytes: prepared.promptTextBytes + prepared.mediaDataUrlBytes,
      sourceWindowKey: prepared.sourceWindowKey,
      sourceClipCount: prepared.sourceClipCount,
      modelMediaSha256: prepared.modelMediaSha256,
      promptTokens: usage?.promptTokens ?? null,
      completionTokens: usage?.completionTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
    };
  }

  private buildTiming(input: {
    mediaStartMs: number | null;
    mediaEndMs: number | null;
    conversionStartedMs: number;
    requestStartedMs: number;
    responseMs: number;
  }): ModelMonitorTiming {
    return {
      mediaStartedAt: input.mediaStartMs ? toIso(input.mediaStartMs) : null,
      mediaEndedAt: input.mediaEndMs ? toIso(input.mediaEndMs) : null,
      requestStartedAt: toIso(input.requestStartedMs),
      responseReceivedAt: toIso(input.responseMs),
      mediaWindowMs:
        input.mediaStartMs && input.mediaEndMs
          ? Math.max(input.mediaEndMs - input.mediaStartMs, 0)
          : null,
      mediaAgeAtRequestMs: input.mediaEndMs ? Math.max(input.requestStartedMs - input.mediaEndMs, 0) : null,
      conversionLatencyMs: Math.max(input.requestStartedMs - input.conversionStartedMs, 0),
      requestLatencyMs: Math.max(input.responseMs - input.requestStartedMs, 0),
      endToResponseLatencyMs: input.mediaEndMs ? Math.max(input.responseMs - input.mediaEndMs, 0) : null,
    };
  }

  private getMediaAvailability(): ModelMonitorMediaAvailability {
    return {
      camera: this.getFreshRawClip("camera") !== null,
      screen: this.getFreshRawClip("screen") !== null,
      audio: this.getFreshRawClip("audio") !== null,
    };
  }

  private getCurrentMedia(): { key: string; mediaEndMs: number; mediaDurationMs: number } | null {
    const cameraClip = this.getFreshRawClip("camera");

    if (!cameraClip) {
      return null;
    }

    return {
      key: this.getClipCacheKey("camera", cameraClip),
      mediaEndMs: cameraClip.timestampMs,
      mediaDurationMs: cameraClip.durationMs,
    };
  }

  private getFreshRawClip(kind: "camera" | "screen" | "audio"): RawClipData | null {
    const clip = this.captureOrchestrator.getLatestClip(kind);

    if (!clip || Date.now() - clip.timestampMs > this.status.windowMs + 2_000) {
      return null;
    }

    return {
      timestampMs: clip.timestampMs,
      durationMs: clip.durationMs,
      mimeType: clip.mimeType,
      data: clip.data,
    };
  }

  private async getModelVideoClip(
    kind: "camera" | "screen",
    audioClip: RawClipData | null,
  ): Promise<ClipData | null> {
    const clip = this.getFreshRawClip(kind);

    if (!clip) {
      return null;
    }

    const cacheKey = audioClip
      ? `${kind}:${clip.timestampMs}:${clip.durationMs}:${clip.mimeType}:audio:${audioClip.timestampMs}:${audioClip.durationMs}:${audioClip.mimeType}`
      : `${kind}:${clip.timestampMs}:${clip.durationMs}:${clip.mimeType}`;
    const cached = this.convertedClipCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const data = audioClip
      ? await convertVideoAndAudioClipsToMp4(clip, audioClip)
      : await convertVideoClipToMp4(clip);
    return this.cacheModelClip(cacheKey, {
      timestampMs: clip.timestampMs,
      durationMs: clip.durationMs,
      mimeType: "video/mp4",
      dataUrl: encodeDataUrl("video/mp4", data),
    });
  }

  private cacheModelClip(cacheKey: string, modelClip: ClipData): ClipData {
    this.convertedClipCache.set(cacheKey, modelClip);
    if (this.convertedClipCache.size > 12) {
      const oldestKey = this.convertedClipCache.keys().next().value;
      if (oldestKey) {
        this.convertedClipCache.delete(oldestKey);
      }
    }

    return modelClip;
  }

  private getClipCacheKey(kind: "camera" | "screen" | "audio", clip: RawClipData | null): string {
    if (!clip) {
      return `${kind}:none`;
    }

    return `${kind}:${clip.timestampMs}:${clip.durationMs}:${clip.mimeType}`;
  }

  private hashDataUrl(dataUrl: string): string {
    return createHash("sha256").update(dataUrl).digest("hex");
  }

  private toRawClipSummary(clip: RawClipData | null, selectedSourceId: string | null): Record<string, unknown> {
    return {
      selectedSourceId,
      available: clip !== null,
      clipCount: clip ? 1 : 0,
      windowStartedAt: clip ? toIso(clip.timestampMs - clip.durationMs) : null,
      windowEndedAt: clip ? toIso(clip.timestampMs) : null,
      capturedAt: clip ? toIso(clip.timestampMs) : null,
      durationMs: clip?.durationMs ?? null,
      firstClipDurationMs: clip?.durationMs ?? null,
      lastClipDurationMs: clip?.durationMs ?? null,
      mimeType: clip?.mimeType ?? null,
    };
  }

  private toClipSummary(clip: ClipData | null, selectedSourceId: string | null): Record<string, unknown> {
    return {
      selectedSourceId,
      available: clip !== null,
      windowStartedAt: clip ? toIso(clip.timestampMs - clip.durationMs) : null,
      windowEndedAt: clip ? toIso(clip.timestampMs) : null,
      capturedAt: clip ? toIso(clip.timestampMs) : null,
      durationMs: clip?.durationMs ?? null,
      mimeType: clip?.mimeType ?? null,
    };
  }

  private emit(event: ModelMonitorEvent): void {
    if (!this.owner || this.owner.isDestroyed()) {
      return;
    }

    this.owner.send(IpcChannels.ModelMonitorEvent, event);
  }
}
