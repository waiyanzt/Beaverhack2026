import type { WebContents } from "electron";
import { createHash } from "node:crypto";
import { IpcChannels } from "../../../shared/channels";
import { actionPlanSchema, type LocalAction } from "../../../shared/schemas/action-plan.schema";
import {
  createIdleModelMonitorStatus,
  MODEL_MONITOR_DEFAULT_TIMING,
} from "../../../shared/model-monitor.defaults";
import type { CaptureStartRequest } from "../../../shared/types/capture.types";
import type { ModelControlRecentAction, ModelControlRecentModelAction } from "../../../shared/types/observation.types";
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
import { ModelActionMemoryService } from "../automation/model-action-memory.service";
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

const DEFAULT_STATUS: ModelMonitorStatus = createIdleModelMonitorStatus();

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString();

export class ModelMonitorService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private owner: WebContents | null = null;
  private status: ModelMonitorStatus = { ...DEFAULT_STATUS };
  private convertedClipCache = new Map<string, ClipData>();
  private lastSubmittedMediaKey: string | null = null;
  private activeRequestCount = 0;
  private latestCompletedRequestNumber = 0;
  private runGeneration = 0;

  public constructor(
    private readonly captureOrchestrator: CaptureOrchestratorService,
    private readonly modelRouter: ModelRouterService,
    private readonly modelActionMemoryService: ModelActionMemoryService,
  ) {}

  public async start(request: ModelMonitorStartRequest, owner: WebContents): Promise<ModelMonitorStatus> {
    await this.stop();
    this.owner = owner;
    this.lastSubmittedMediaKey = null;
    this.activeRequestCount = 0;
    this.latestCompletedRequestNumber = 0;
    this.runGeneration += 1;
    const generation = this.runGeneration;
    this.status = {
      ...DEFAULT_STATUS,
      running: true,
      startedAt: toIso(Date.now()),
      tickIntervalMs: request.tickIntervalMs,
      windowMs: request.windowMs,
      maxInFlightRequests: MODEL_MONITOR_DEFAULT_TIMING.maxInFlightRequests,
    };

    setSelectedScreenSourceId(request.capture.screen.sourceId ?? null);
    await this.captureOrchestrator.start(request.capture);
    this.emit({ type: "status", createdAt: toIso(Date.now()), status: this.getStatus() });

    this.timer = setInterval(() => {
      void this.runTick(request.capture, generation);
    }, request.tickIntervalMs);

    void this.runTick(request.capture, generation);

    return this.getStatus();
  }

  public async stop(): Promise<ModelMonitorStatus> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.runGeneration += 1;
    this.activeRequestCount = 0;

    if (this.status.running) {
      await this.captureOrchestrator.stop();
    }

    this.status = {
      ...this.status,
      running: false,
      inFlight: false,
      activeRequestCount: 0,
    };
    this.emit({ type: "status", createdAt: toIso(Date.now()), status: this.getStatus() });
    this.owner = null;

    return this.getStatus();
  }

  public getStatus(): ModelMonitorStatus {
    return { ...this.status };
  }

  private async runTick(capture: CaptureStartRequest, generation: number): Promise<void> {
    if (!this.status.running || generation !== this.runGeneration) {
      return;
    }

    const tickId = createId("monitor_tick");
    const createdAt = toIso(Date.now());
    const media = this.getMediaAvailability();

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

    if (Date.now() - currentMedia.mediaEndMs > MODEL_MONITOR_DEFAULT_TIMING.maxLiveClipAgeMs) {
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

    if (this.activeRequestCount >= this.status.maxInFlightRequests) {
      this.status = {
        ...this.status,
        activeRequestCount: this.activeRequestCount,
        inFlight: true,
        skippedTickCount: this.status.skippedTickCount + 1,
        lastTickAt: createdAt,
      };
      this.emit({
        type: "tick-skipped",
        createdAt,
        tickId,
        reason: "Model dispatch cap reached; keeping vLLM queue fresh.",
        status: this.getStatus(),
        media,
      });
      return;
    }

    const requestNumber = this.status.tickCount + 1;
    this.activeRequestCount += 1;
    this.status = {
      ...this.status,
      inFlight: true,
      activeRequestCount: this.activeRequestCount,
      tickCount: requestNumber,
      lastTickAt: createdAt,
    };
    this.lastSubmittedMediaKey = currentMedia.key;
    this.emit({ type: "tick-started", createdAt, tickId, status: this.getStatus(), media });

    try {
      const conversionStartedMs = Date.now();
      const prepared = await this.buildMessages(tickId, capture, requestNumber);
      const requestStartedMs = Date.now();
      const result = await this.modelRouter.requestActionPlan(prepared.messages);
      if (result.actionPlan) {
        this.recordMonitorActionPlan(result.actionPlan);
      }
      const responseMs = Date.now();
      const responseAt = toIso(responseMs);
      if (generation !== this.runGeneration) {
        return;
      }
      const timing = this.buildTiming({
        mediaStartMs: prepared.mediaStartMs,
        mediaEndMs: prepared.mediaEndMs,
        conversionStartedMs,
        requestStartedMs,
        responseMs,
      });
      this.activeRequestCount = Math.max(this.activeRequestCount - 1, 0);
      const isNewestCompletedRequest = requestNumber >= this.latestCompletedRequestNumber;
      if (isNewestCompletedRequest) {
        this.latestCompletedRequestNumber = requestNumber;
      }

      this.status = {
        ...this.status,
        inFlight: this.activeRequestCount > 0,
        activeRequestCount: this.activeRequestCount,
        lastResponseAt: isNewestCompletedRequest ? responseAt : this.status.lastResponseAt,
        lastMediaEndedAt: isNewestCompletedRequest ? timing.mediaEndedAt : this.status.lastMediaEndedAt,
        lastRequestStartedAt: isNewestCompletedRequest ? timing.requestStartedAt : this.status.lastRequestStartedAt,
        lastEndToResponseLatencyMs: isNewestCompletedRequest
          ? timing.endToResponseLatencyMs
          : this.status.lastEndToResponseLatencyMs,
        lastRequestLatencyMs: isNewestCompletedRequest ? timing.requestLatencyMs : this.status.lastRequestLatencyMs,
        lastError: isNewestCompletedRequest ? (result.ok ? null : result.content) : this.status.lastError,
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
      if (generation !== this.runGeneration) {
        return;
      }
      this.activeRequestCount = Math.max(this.activeRequestCount - 1, 0);
      const isNewestCompletedRequest = requestNumber >= this.latestCompletedRequestNumber;
      if (isNewestCompletedRequest) {
        this.latestCompletedRequestNumber = requestNumber;
      }
      this.status = {
        ...this.status,
        inFlight: this.activeRequestCount > 0,
        activeRequestCount: this.activeRequestCount,
        lastResponseAt: isNewestCompletedRequest ? failedAt : this.status.lastResponseAt,
        lastError: isNewestCompletedRequest ? message : this.status.lastError,
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
        "Analyze the current webcam/audio clip with the recent model action memory provided below.",
        "First, transcribe the full audible speech from this clip into response.audioTranscript before deciding actions. Use '[no speech]' if no speech is audible and '[inaudible]' if speech is present but unclear.",
        "Set response.visibleToUser to true and response.text to one concise sentence describing what is clearly visible or audible in this clip.",
        "If the camera image is empty, covered, black, or pointed away, say that no person is visible.",
        "Do not use audio to infer visual appearance such as hair, beard, room, posture, or whether a person is visible.",
        "For demo behavior: use vts.trigger_hotkey with hotkeyId 'wave' when the streamer clearly waves or raises an open hand toward the camera, 'laugh' when the streamer clearly laughs or smiles broadly, and 'surprise' when the streamer is visibly startled.",
        "Use exactly one noop action for idle, unclear, covered-camera, or ordinary speaking/sitting clips.",
        "Use recentModelActions to continue contextually appropriate reactions, such as continued laughing, without repeating actions mechanically.",
        "For this development build, produce the normal ActionPlan but do not assume dashboard monitor actions will be executed.",
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
        recentActions: this.buildRecentActionsFromMemory(),
        recentModelActions: this.modelActionMemoryService.getRecentModelActions(),
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

  private buildRecentActionsFromMemory(): ModelControlRecentAction[] {
    return this.modelActionMemoryService
      .getRecentModelActions()
      .flatMap((entry) => this.buildRecentActionsFromMemoryEntry(entry))
      .slice(0, 20);
  }

  private buildRecentActionsFromMemoryEntry(entry: ModelControlRecentModelAction): ModelControlRecentAction[] {
    return entry.actionPlan.actions.map((action) => ({
      actionId: action.actionId,
      type: action.type,
      target: this.getActionTarget(action),
      timestamp: entry.storedAt,
    }));
  }

  private getActionTarget(action: LocalAction): string {
    switch (action.type) {
      case "vts.trigger_hotkey":
        return `vts.hotkey:${action.hotkeyId}`;
      case "vts.set_parameter":
        return `vts.parameter:${action.parameterId}`;
      case "obs.set_scene":
        return `obs.scene:${action.sceneName}`;
      case "obs.set_source_visibility":
        return `obs.source:${action.sceneName}:${action.sourceName}:${action.visible ? "show" : "hide"}`;
      case "overlay.message":
        return `overlay.message:${action.message}`;
      case "log.event":
        return `log.event:${action.level}`;
      case "noop":
        return "noop";
    }
  }

  private recordMonitorActionPlan(input: unknown): void {
    const parsed = actionPlanSchema.safeParse(input);

    if (!parsed.success) {
      return;
    }

    this.modelActionMemoryService.record(
      parsed.data,
      parsed.data.actions.map((action) => ({
        actionId: action.actionId,
        type: action.type,
        status: action.type === "noop" ? "noop" : "not_executed",
        reason: action.type === "noop" ? action.reason : "Dashboard monitor recorded the plan but did not execute it.",
      })),
    );
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
