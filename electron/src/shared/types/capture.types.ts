export type CaptureDetailLevel = "low" | "high";

export type CameraCaptureConfig = {
  enabled: boolean;
  fps: number;
  maxFrames: number;
  resolution: string;
  jpegQuality: number;
  detail?: CaptureDetailLevel;
  clipDurationSeconds: number;
  clipIntervalSeconds?: number;
  maxClips: number;
  deviceId?: string | null;
};

export type ScreenCaptureConfig = {
  enabled: boolean;
  fps: number;
  maxFrames: number;
  resolution: string;
  jpegQuality: number;
  detail?: CaptureDetailLevel;
  clipDurationSeconds: number;
  clipIntervalSeconds?: number;
  maxClips: number;
  sourceId?: string | null;
};

export type AudioCaptureConfig = {
  enabled: boolean;
  sampleRate: number;
  channels: number;
  bufferDurationSeconds: number;
  clipIntervalSeconds?: number;
  transcriptionEnabled: boolean;
  sendRawAudio: boolean;
  deviceId?: string | null;
};

export type CaptureStartRequest = {
  camera: CameraCaptureConfig;
  screen: ScreenCaptureConfig;
  audio: AudioCaptureConfig;
};

export type CaptureDeviceStatus = {
  enabled: boolean;
  active: boolean;
  lastFrameAt: string | null;
  lastPreviewDataUrl: string | null;
  lastClipAt: string | null;
  lastClipMimeType: string | null;
  lastClipDurationMs: number | null;
  lastError: string | null;
};

export type CaptureAudioStatus = {
  enabled: boolean;
  active: boolean;
  lastChunkAt: string | null;
  lastLevel: number | null;
  lastLevelAt: string | null;
  recentLevels: number[];
  lastError: string | null;
};

export type CaptureBufferStats = {
  entryCount: number;
  totalBytes: number;
  oldestTimestampMs: number | null;
  newestTimestampMs: number | null;
};

export type CaptureStatus = {
  running: boolean;
  startedAt: string | null;
  camera: CaptureDeviceStatus;
  screen: CaptureDeviceStatus;
  audio: CaptureAudioStatus;
  buffers: {
    camera: CaptureBufferStats | null;
    screen: CaptureBufferStats | null;
    audio: CaptureBufferStats | null;
    audioClips: CaptureBufferStats | null;
    cameraClips: CaptureBufferStats | null;
    screenClips: CaptureBufferStats | null;
  };
};

export type CaptureFramePayload = {
  kind: "camera" | "screen" | "window";
  timestampMs: number;
  width: number;
  height: number;
  mimeType: "image/jpeg" | "image/png";
  dataUrl: string;
  detail: CaptureDetailLevel;
};

export type CaptureAudioPayload = {
  timestampMs: number;
  durationMs: number;
  mimeType: string;
  data: Uint8Array;
};

export type CaptureClipPayload = {
  kind: "camera" | "screen" | "audio";
  timestampMs: number;
  durationMs: number;
  mimeType: string;
  data: Uint8Array;
};

export type CaptureAudioLevelPayload = {
  timestampMs: number;
  level: number;
};

export type CaptureControlMessage =
  | {
      type: "start";
      config: CaptureStartRequest;
    }
  | {
      type: "stop";
    };

export type CaptureErrorPayload = {
  source: "camera" | "screen" | "audio" | "system";
  message: string;
  timestampMs: number;
};

export type CaptureSourceInfo = {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnailDataUrl?: string;
};

export type CaptureMediaDeviceInfo = {
  deviceId: string;
  kind: "audioinput" | "videoinput";
  label: string;
};

export type CaptureClipKind = "camera" | "screen" | "audio";

export type CaptureExportClipRequest = {
  kind: CaptureClipKind;
  includeAudio?: boolean;
};

export type CaptureExportClipResponse =
  | {
      ok: true;
      path: string;
      mimeType: string;
    }
  | {
      ok: false;
      message: string;
      canceled?: boolean;
    };
