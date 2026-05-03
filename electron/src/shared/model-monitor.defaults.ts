import type { CaptureStartRequest } from "./types/capture.types";
import type { ModelMonitorStatus } from "./types/model-monitor.types";

export const MODEL_MONITOR_DEFAULT_TIMING = {
  tickIntervalMs: 100,
  clipIntervalMs: 500,
  windowMs: 2_000,
  maxLiveClipAgeMs: 1_500,
  maxInFlightRequests: 2,
} as const;

export const MODEL_MONITOR_VALIDATION_LIMITS = {
  minTickIntervalMs: 100,
  maxTickIntervalMs: 60_000,
  minWindowMs: 1_000,
  maxWindowMs: 120_000,
} as const;

const DEFAULT_CAPTURE_CONFIG: CaptureStartRequest = {
  camera: {
    enabled: true,
    fps: 15,
    maxFrames: 8,
    resolution: "640x360",
    jpegQuality: 75,
    detail: "low",
    clipDurationSeconds: 2,
    clipIntervalSeconds: MODEL_MONITOR_DEFAULT_TIMING.clipIntervalMs / 1000,
    maxClips: 12,
    deviceId: null,
  },
  screen: {
    enabled: false,
    fps: 0,
    maxFrames: 4,
    resolution: "640x360",
    jpegQuality: 70,
    detail: "low",
    clipDurationSeconds: 2,
    clipIntervalSeconds: MODEL_MONITOR_DEFAULT_TIMING.clipIntervalMs / 1000,
    maxClips: 1,
    sourceId: null,
  },
  audio: {
    enabled: true,
    sampleRate: 16000,
    channels: 1,
    bufferDurationSeconds: 2,
    clipIntervalSeconds: MODEL_MONITOR_DEFAULT_TIMING.clipIntervalMs / 1000,
    transcriptionEnabled: false,
    sendRawAudio: false,
    deviceId: null,
  },
};

export const createModelMonitorCaptureConfig = (options: {
  audioDeviceId?: string | null;
  screenSourceId?: string | null;
  videoDeviceId?: string | null;
}): CaptureStartRequest => ({
  camera: {
    ...DEFAULT_CAPTURE_CONFIG.camera,
    deviceId: options.videoDeviceId ?? null,
  },
  screen: {
    ...DEFAULT_CAPTURE_CONFIG.screen,
    enabled: Boolean(options.screenSourceId),
    fps: options.screenSourceId ? 1 : 0,
    sourceId: options.screenSourceId ?? null,
  },
  audio: {
    ...DEFAULT_CAPTURE_CONFIG.audio,
    deviceId: options.audioDeviceId ?? null,
  },
});

export const createIdleModelMonitorStatus = (
  overrides: Partial<ModelMonitorStatus> = {},
): ModelMonitorStatus => ({
  running: false,
  startedAt: null,
  tickIntervalMs: MODEL_MONITOR_DEFAULT_TIMING.tickIntervalMs,
  windowMs: MODEL_MONITOR_DEFAULT_TIMING.windowMs,
  inFlight: false,
  activeRequestCount: 0,
  maxInFlightRequests: MODEL_MONITOR_DEFAULT_TIMING.maxInFlightRequests,
  tickCount: 0,
  skippedTickCount: 0,
  lastTickAt: null,
  lastResponseAt: null,
  lastMediaEndedAt: null,
  lastRequestStartedAt: null,
  lastEndToResponseLatencyMs: null,
  lastRequestLatencyMs: null,
  lastError: null,
  ...overrides,
});
