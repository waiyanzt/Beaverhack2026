import type { WebContents } from "electron";
import { IpcChannels } from "../../../shared/channels";
import {
  createIdleModelMonitorStatus,
  MODEL_MONITOR_DEFAULT_TIMING,
} from "../../../shared/model-monitor.defaults";
import type { ActionExecutionResult, ReviewedAction } from "../../../shared/types/action-plan.types";
import type {
  ModelMonitorEvent,
  ModelMonitorMediaAvailability,
  ModelMonitorRequestDebug,
  ModelMonitorStartRequest,
  ModelMonitorStatus,
  ModelMonitorTiming,
} from "../../../shared/types/model-monitor.types";
import { createId } from "../../utils/ids";
import type { PipelineService } from "../automation/pipeline.service";
import type { CaptureOrchestratorService } from "../capture/capture-orchestrator.service";
import { setSelectedScreenSourceId } from "../capture/capture-orchestrator.instance";

type RawClipData = {
  timestampMs: number;
  durationMs: number;
  mimeType: string;
  data: Buffer;
};

const DEFAULT_STATUS: ModelMonitorStatus = createIdleModelMonitorStatus();

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString();

export class ModelMonitorService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private owner: WebContents | null = null;
  private status: ModelMonitorStatus = { ...DEFAULT_STATUS };
  private lastSubmittedMediaKey: string | null = null;
  private activeRequestCount = 0;
  private latestCompletedRequestNumber = 0;
  private runGeneration = 0;

  public constructor(
    private readonly captureOrchestrator: CaptureOrchestratorService,
    private readonly pipelineService: PipelineService,
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
      void this.runTick(generation);
    }, request.tickIntervalMs);

    void this.runTick(generation);

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

  private async runTick(generation: number): Promise<void> {
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
      const requestStartedMs = Date.now();
      const pipelineResult = await this.pipelineService.analyzeNow({
        dryRun: false,
        useLatestCapture: true,
        captureWindowMs: this.status.windowMs,
        allowObsActions: false,
      });
      const responseMs = Date.now();
      const responseAt = toIso(responseMs);
      if (generation !== this.runGeneration) {
        return;
      }

      if (!pipelineResult.ok) {
        throw new Error(pipelineResult.message);
      }

      const mediaStartMs = pipelineResult.requestDebug.mediaStartedAt
        ? Date.parse(pipelineResult.requestDebug.mediaStartedAt)
        : null;
      const mediaEndMs = pipelineResult.requestDebug.mediaEndedAt
        ? Date.parse(pipelineResult.requestDebug.mediaEndedAt)
        : null;
      const timing = this.buildTiming({
        mediaStartMs,
        mediaEndMs,
        conversionStartedMs: requestStartedMs,
        requestStartedMs: Date.parse(pipelineResult.requestDebug.modelRequestStartedAt),
        responseMs: Date.parse(pipelineResult.requestDebug.modelResponseReceivedAt),
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
        lastError: isNewestCompletedRequest ? null : this.status.lastError,
      };
      this.emit({
        type: "response",
        createdAt: responseAt,
        tickId,
        ok: true,
        providerId: pipelineResult.requestDebug.providerId,
        statusCode: pipelineResult.requestDebug.statusCode,
        content: this.summarizePipelineRun(pipelineResult.reviewedActions, pipelineResult.actionResults),
        actionPlan: pipelineResult.plan,
        reviewedActions: pipelineResult.reviewedActions,
        actionResults: pipelineResult.actionResults,
        modelMediaDataUrl: pipelineResult.requestDebug.modelMediaDataUrl ?? undefined,
        status: this.getStatus(),
        media: this.getMediaAvailability(),
        timing,
        debug: this.buildRequestDebug(pipelineResult.requestDebug),
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

  private buildRequestDebug(input: {
    pipelineLatencyMs?: number;
    observationLatencyMs?: number;
    captureInputLatencyMs?: number;
    promptBuildLatencyMs?: number;
    modelRequestLatencyMs?: number;
    parseValidateExecuteLatencyMs?: number;
    promptTextBytes: number;
    mediaDataUrlBytes: number;
    sourceWindowKey: string | null;
    sourceClipCount: number;
    modelMediaSha256: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  }): ModelMonitorRequestDebug {
    return {
      requestNumber: this.status.tickCount,
      pipelineLatencyMs: input.pipelineLatencyMs ?? null,
      observationLatencyMs: input.observationLatencyMs ?? null,
      captureInputLatencyMs: input.captureInputLatencyMs ?? null,
      promptBuildLatencyMs: input.promptBuildLatencyMs ?? null,
      modelRequestLatencyMs: input.modelRequestLatencyMs ?? null,
      parseValidateExecuteLatencyMs: input.parseValidateExecuteLatencyMs ?? null,
      promptTextBytes: input.promptTextBytes,
      mediaDataUrlBytes: input.mediaDataUrlBytes,
      requestContentBytes: input.promptTextBytes + input.mediaDataUrlBytes,
      sourceWindowKey: input.sourceWindowKey ?? "none",
      sourceClipCount: input.sourceClipCount,
      modelMediaSha256: input.modelMediaSha256,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
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

  private getClipCacheKey(kind: "camera" | "screen" | "audio", clip: RawClipData | null): string {
    if (!clip) {
      return `${kind}:none`;
    }

    return `${kind}:${clip.timestampMs}:${clip.durationMs}:${clip.mimeType}`;
  }

  private summarizePipelineRun(
    reviewedActions: ReviewedAction[],
    actionResults: ActionExecutionResult[],
  ): string {
    return [
      `Reviewed ${reviewedActions.length} action(s).`,
      actionResults.length > 0
        ? actionResults.map((result) => `${result.type}:${result.status}`).join(", ")
        : "No action results.",
    ].join(" ");
  }

  private emit(event: ModelMonitorEvent): void {
    if (!this.owner || this.owner.isDestroyed()) {
      return;
    }

    this.owner.send(IpcChannels.ModelMonitorEvent, event);
  }
}
