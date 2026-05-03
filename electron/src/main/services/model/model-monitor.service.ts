import type { WebContents } from "electron";
import { IpcChannels } from "../../../shared/channels";
import {
  createIdleModelMonitorStatus,
  MODEL_MONITOR_DEFAULT_TIMING,
} from "../../../shared/model-monitor.defaults";
import type {
  ActionExecutionResult,
  AutomationAnalyzeNowResult,
  ReviewedAction,
} from "../../../shared/types/action-plan.types";
import type {
  ModelMonitorEvent,
  ModelMonitorMediaAvailability,
  ModelMonitorRequestDebug,
  ModelMonitorStartRequest,
  ModelMonitorStatus,
  ModelMonitorTiming,
  SecondaryModelMode,
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

type RawFrameData = {
  timestampMs: number;
  width: number;
  height: number;
  mimeType: string;
  data: Buffer;
};

type SuccessfulAutomationResult = Extract<AutomationAnalyzeNowResult, { ok: true }>;
type ModelDecisionRole = "primary_emote" | "secondary_director";

interface ModelPassSpec {
  role: ModelDecisionRole;
  mediaKey: string;
  mediaEndMs: number;
  run: () => Promise<AutomationAnalyzeNowResult>;
}

const DEFAULT_STATUS: ModelMonitorStatus = createIdleModelMonitorStatus();

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString();

export class ModelMonitorService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private owner: WebContents | null = null;
  private status: ModelMonitorStatus = { ...DEFAULT_STATUS };
  private lastSubmittedMediaKeys: Record<ModelDecisionRole, string | null> = {
    primary_emote: null,
    secondary_director: null,
  };
  private activeRequestCounts: Record<ModelDecisionRole, number> = {
    primary_emote: 0,
    secondary_director: 0,
  };
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
    this.lastSubmittedMediaKeys = {
      primary_emote: null,
      secondary_director: null,
    };
    this.activeRequestCounts = {
      primary_emote: 0,
      secondary_director: 0,
    };
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
      secondaryMode: request.secondaryMode,
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
    this.activeRequestCounts = {
      primary_emote: 0,
      secondary_director: 0,
    };

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

    const { runnablePasses, skippedReasons } = this.getRunnablePasses(this.status.secondaryMode);
    const dispatchablePasses = runnablePasses.filter((pass) => {
      if (pass.mediaKey === this.lastSubmittedMediaKeys[pass.role]) {
        skippedReasons.push(`${this.getRoleLabel(pass.role)} is waiting for fresh media.`);
        return false;
      }

      if (this.activeRequestCounts[pass.role] >= this.getMaxInFlightForRole(pass.role)) {
        skippedReasons.push(`${this.getRoleLabel(pass.role)} dispatch cap reached.`);
        return false;
      }

      return true;
    });

    if (dispatchablePasses.length === 0) {
      this.status = {
        ...this.status,
        skippedTickCount: this.status.skippedTickCount + 1,
        lastTickAt: createdAt,
      };
      this.emit({
        type: "tick-skipped",
        createdAt,
        tickId,
        reason: skippedReasons.length > 0 ? [...new Set(skippedReasons)].join(" ") : "Waiting for fresh model media.",
        status: this.getStatus(),
        media,
      });
      return;
    }

    const requestNumber = this.status.tickCount + 1;
    for (const pass of dispatchablePasses) {
      this.activeRequestCounts[pass.role] += 1;
      this.lastSubmittedMediaKeys[pass.role] = pass.mediaKey;
    }
    this.activeRequestCount = this.getTotalActiveRequestCount();
    this.status = {
      ...this.status,
      inFlight: true,
      activeRequestCount: this.activeRequestCount,
      tickCount: requestNumber,
      lastTickAt: createdAt,
    };
    this.emit({ type: "tick-started", createdAt, tickId, status: this.getStatus(), media });

    for (const pass of dispatchablePasses) {
      void this.runPass(pass, generation, tickId, requestNumber);
    }
  }

  private buildRequestDebug(input: {
    requestNumber: number;
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
    decisionRole: "primary_emote" | "secondary_director";
  }): ModelMonitorRequestDebug {
    return {
      requestNumber: input.requestNumber,
      decisionRole: input.decisionRole,
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
      mediaAgeAtRequestMs:
        input.mediaEndMs
          ? Math.max(input.requestStartedMs - input.mediaEndMs, 0)
          : null,
      conversionLatencyMs: Math.max(input.requestStartedMs - input.conversionStartedMs, 0),
      requestLatencyMs: Math.max(input.responseMs - input.requestStartedMs, 0),
      endToResponseLatencyMs:
        input.mediaEndMs
          ? Math.max(input.responseMs - input.mediaEndMs, 0)
          : null,
    };
  }

  private buildPipelineTiming(result: SuccessfulAutomationResult, conversionStartedMs: number): ModelMonitorTiming {
    const mediaStartMs = result.requestDebug.mediaStartedAt
      ? Date.parse(result.requestDebug.mediaStartedAt)
      : null;
    const mediaEndMs = result.requestDebug.mediaEndedAt
      ? Date.parse(result.requestDebug.mediaEndedAt)
      : null;

    return this.buildTiming({
      mediaStartMs,
      mediaEndMs,
      conversionStartedMs,
      requestStartedMs: Date.parse(result.requestDebug.modelRequestStartedAt),
      responseMs: Date.parse(result.requestDebug.modelResponseReceivedAt),
    });
  }

  private emitPipelineResponse(
    result: SuccessfulAutomationResult,
    conversionStartedMs: number,
    tickId: string,
    requestNumber: number,
    createdAt: string = result.requestDebug.modelResponseReceivedAt,
  ): void {
    this.emit({
      type: "response",
      createdAt,
      tickId,
      ok: true,
      providerId: result.requestDebug.providerId,
      statusCode: result.requestDebug.statusCode,
      content: this.summarizePipelineRun(result.reviewedActions, result.actionResults),
      actionPlan: result.plan,
      reviewedActions: result.reviewedActions,
      actionResults: result.actionResults,
      modelMediaDataUrl: result.requestDebug.modelMediaDataUrl ?? undefined,
      status: this.getStatus(),
      media: this.getMediaAvailability(),
      timing: this.buildPipelineTiming(result, conversionStartedMs),
      debug: this.buildRequestDebug({ ...result.requestDebug, requestNumber }),
    });
  }

  private async runPass(
    pass: ModelPassSpec,
    generation: number,
    tickId: string,
    requestNumber: number,
  ): Promise<void> {
    const requestStartedMs = Date.now();

    try {
      const pipelineResult = await pass.run();
      const responseMs = Date.now();
      const responseAt = toIso(responseMs);

      if (generation !== this.runGeneration) {
        return;
      }

      if (!pipelineResult.ok) {
        throw new Error(pipelineResult.message);
      }

      const timing = this.buildPipelineTiming(pipelineResult, requestStartedMs);
      const isNewestCompletedRequest = requestNumber >= this.latestCompletedRequestNumber;
      if (isNewestCompletedRequest) {
        this.latestCompletedRequestNumber = requestNumber;
      }

      this.status = {
        ...this.status,
        lastResponseAt: isNewestCompletedRequest ? responseAt : this.status.lastResponseAt,
        lastMediaEndedAt: isNewestCompletedRequest ? timing.mediaEndedAt : this.status.lastMediaEndedAt,
        lastRequestStartedAt: isNewestCompletedRequest ? timing.requestStartedAt : this.status.lastRequestStartedAt,
        lastEndToResponseLatencyMs: isNewestCompletedRequest
          ? timing.endToResponseLatencyMs
          : this.status.lastEndToResponseLatencyMs,
        lastRequestLatencyMs: isNewestCompletedRequest ? timing.requestLatencyMs : this.status.lastRequestLatencyMs,
        lastError: isNewestCompletedRequest ? null : this.status.lastError,
      };

      this.emitPipelineResponse(pipelineResult, requestStartedMs, tickId, requestNumber, responseAt);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `${this.getRoleLabel(pass.role)} model pass failed.`;
      const failedAt = toIso(Date.now());

      if (generation !== this.runGeneration) {
        return;
      }

      const isNewestCompletedRequest = requestNumber >= this.latestCompletedRequestNumber;
      if (isNewestCompletedRequest) {
        this.latestCompletedRequestNumber = requestNumber;
      }

      this.status = {
        ...this.status,
        lastResponseAt: isNewestCompletedRequest ? failedAt : this.status.lastResponseAt,
        lastError: isNewestCompletedRequest ? `${this.getRoleLabel(pass.role)}: ${message}` : this.status.lastError,
      };
      this.emit({
        type: "error",
        createdAt: failedAt,
        tickId,
        message: `${this.getRoleLabel(pass.role)}: ${message}`,
        status: this.getStatus(),
        media: this.getMediaAvailability(),
      });
    } finally {
      this.activeRequestCounts[pass.role] = Math.max(this.activeRequestCounts[pass.role] - 1, 0);
      this.activeRequestCount = this.getTotalActiveRequestCount();
      this.status = {
        ...this.status,
        inFlight: this.activeRequestCount > 0,
        activeRequestCount: this.activeRequestCount,
      };
      this.emit({ type: "status", createdAt: toIso(Date.now()), status: this.getStatus() });
    }
  }

  private getRunnablePasses(mode: SecondaryModelMode): {
    runnablePasses: ModelPassSpec[];
    skippedReasons: string[];
  } {
    const runnablePasses: ModelPassSpec[] = [];
    const skippedReasons: string[] = [];

    if (mode !== "forced") {
      const cameraFrame = this.getFreshRawFrame("camera");

      if (cameraFrame && this.isFreshForLiveMode(cameraFrame.timestampMs)) {
        runnablePasses.push({
          role: "primary_emote",
          mediaKey: this.getFrameCacheKey("camera", cameraFrame),
          mediaEndMs: cameraFrame.timestampMs,
          run: () => this.runPrimaryEmotePass(),
        });
      } else {
        skippedReasons.push("Primary is waiting for a fresh camera frame.");
      }
    }

    if (mode !== "off") {
      const cameraClip = this.getFreshRawClip("camera");

      if (cameraClip && this.isFreshForClipMode(cameraClip.timestampMs)) {
        const audioClip = this.getFreshRawClip("audio");
        runnablePasses.push({
          role: "secondary_director",
          mediaKey: `${this.getClipCacheKey("camera", cameraClip)}:${this.getClipCacheKey("audio", audioClip)}`,
          mediaEndMs: cameraClip.timestampMs,
          run: () => this.runSecondaryDirectorPass(),
        });
      } else {
        skippedReasons.push("Secondary is waiting for a fresh camera/audio clip.");
      }
    }

    return { runnablePasses, skippedReasons };
  }

  private getMaxInFlightForRole(role: ModelDecisionRole): number {
    return role === "primary_emote" ? this.status.maxInFlightRequests : 1;
  }

  private getTotalActiveRequestCount(): number {
    return this.activeRequestCounts.primary_emote + this.activeRequestCounts.secondary_director;
  }

  private getRoleLabel(role: ModelDecisionRole): string {
    return role === "primary_emote" ? "Primary model" : "Secondary model";
  }

  private isFreshForLiveMode(timestampMs: number): boolean {
    return Date.now() - timestampMs <= MODEL_MONITOR_DEFAULT_TIMING.maxLiveClipAgeMs;
  }

  private isFreshForClipMode(timestampMs: number): boolean {
    return Date.now() - timestampMs <= this.status.windowMs + 2_000;
  }

  private getMediaAvailability(): ModelMonitorMediaAvailability {
    return {
      camera: this.getFreshRawFrame("camera") !== null,
      screen: this.getFreshRawClip("screen") !== null,
      audio: this.getFreshRawClip("audio") !== null,
    };
  }

  private async runPrimaryEmotePass(): Promise<AutomationAnalyzeNowResult> {
    return this.pipelineService.analyzeNow({
      dryRun: false,
      useLatestCapture: true,
      captureInputMode: "latest_frame",
      captureWindowMs: this.status.windowMs,
      allowObsActions: false,
      modelProviderId: "vllm",
      decisionRole: "primary_emote",
      vtsCandidateMode: "safe_auto",
    });
  }

  private async runSecondaryDirectorPass(): Promise<AutomationAnalyzeNowResult> {
    return this.pipelineService.analyzeNow({
      dryRun: false,
      useLatestCapture: true,
      captureInputMode: "clip",
      captureWindowMs: this.status.windowMs,
      includeSeparateAudio: true,
      allowObsActions: true,
      modelProviderId: "secondary",
      decisionRole: "secondary_director",
      vtsCandidateMode: "inferable",
    });
  }

  private getFreshRawFrame(kind: "camera" | "screen"): RawFrameData | null {
    const frame = this.captureOrchestrator.getLatestFrame(kind);

    if (!frame || Date.now() - frame.timestampMs > this.status.windowMs + 500) {
      return null;
    }

    return {
      timestampMs: frame.timestampMs,
      width: frame.width,
      height: frame.height,
      mimeType: frame.mimeType,
      data: frame.data,
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

  private getFrameCacheKey(kind: "camera" | "screen", frame: RawFrameData | null): string {
    if (!frame) {
      return `${kind}-frame:none`;
    }

    return `${kind}-frame:${frame.timestampMs}:${frame.width}x${frame.height}:${frame.mimeType}`;
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
