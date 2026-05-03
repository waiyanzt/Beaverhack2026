import type { CaptureStartRequest } from "./capture.types";
import type { ActionExecutionResult, AutomationDecisionRole, ReviewedAction } from "./action-plan.types";

export type SecondaryModelMode = "off" | "auto_unsupported" | "forced";

export type ModelMonitorStartRequest = {
  capture: CaptureStartRequest;
  tickIntervalMs: number;
  windowMs: number;
  secondaryMode: SecondaryModelMode;
};

export type ModelMonitorStatus = {
  running: boolean;
  startedAt: string | null;
  tickIntervalMs: number;
  windowMs: number;
  secondaryMode: SecondaryModelMode;
  inFlight: boolean;
  activeRequestCount: number;
  maxInFlightRequests: number;
  tickCount: number;
  skippedTickCount: number;
  lastTickAt: string | null;
  lastResponseAt: string | null;
  lastMediaEndedAt: string | null;
  lastRequestStartedAt: string | null;
  lastEndToResponseLatencyMs: number | null;
  lastRequestLatencyMs: number | null;
  lastError: string | null;
};

export type ModelMonitorMediaAvailability = {
  camera: boolean;
  screen: boolean;
  audio: boolean;
};

export type ModelMonitorTiming = {
  mediaStartedAt: string | null;
  mediaEndedAt: string | null;
  requestStartedAt: string;
  responseReceivedAt: string;
  mediaWindowMs: number | null;
  mediaAgeAtRequestMs: number | null;
  conversionLatencyMs: number;
  requestLatencyMs: number;
  endToResponseLatencyMs: number | null;
};

export type ModelMonitorRequestDebug = {
  requestNumber: number;
  decisionRole: AutomationDecisionRole;
  pipelineLatencyMs: number | null;
  observationLatencyMs: number | null;
  captureInputLatencyMs: number | null;
  promptBuildLatencyMs: number | null;
  modelRequestLatencyMs: number | null;
  parseValidateExecuteLatencyMs: number | null;
  promptTextBytes: number;
  mediaDataUrlBytes: number;
  requestContentBytes: number;
  sourceWindowKey: string;
  sourceClipCount: number;
  modelMediaSha256: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type ModelMonitorEvent =
  | {
      type: "status";
      createdAt: string;
      status: ModelMonitorStatus;
    }
  | {
      type: "tick-started";
      createdAt: string;
      tickId: string;
      status: ModelMonitorStatus;
      media: ModelMonitorMediaAvailability;
    }
  | {
      type: "tick-skipped";
      createdAt: string;
      tickId: string;
      reason: string;
      status: ModelMonitorStatus;
      media: ModelMonitorMediaAvailability;
    }
  | {
      type: "response";
      createdAt: string;
      tickId: string;
      ok: boolean;
      providerId: string;
      statusCode: number | null;
      content: string;
      actionPlan?: unknown;
      reviewedActions?: ReviewedAction[];
      actionResults?: ActionExecutionResult[];
      modelMediaDataUrl?: string;
      status: ModelMonitorStatus;
      media: ModelMonitorMediaAvailability;
      timing: ModelMonitorTiming;
      debug: ModelMonitorRequestDebug;
    }
  | {
      type: "error";
      createdAt: string;
      tickId: string;
      message: string;
      status: ModelMonitorStatus;
      media: ModelMonitorMediaAvailability;
      timing?: ModelMonitorTiming;
    };

export type ModelMonitorStartResponse =
  | { ok: true; status: ModelMonitorStatus }
  | { ok: false; message: string; status: ModelMonitorStatus };

export type ModelMonitorStopResponse =
  | { ok: true; status: ModelMonitorStatus }
  | { ok: false; message: string; status: ModelMonitorStatus };

export type ModelMonitorStatusResponse =
  | { ok: true; status: ModelMonitorStatus }
  | { ok: false; message: string; status: ModelMonitorStatus };
