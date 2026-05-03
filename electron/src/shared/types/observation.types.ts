export type CapturedFrame = {
	id: string;
	kind: "camera" | "screen" | "window";
	capturedAt: string;
	width: number;
	height: number;
	mimeType: "image/jpeg" | "image/png";
	dataUrl: string;
	detail: "low" | "high";
};

export type CapturedAudioChunk = {
	id: string;
	capturedAt: string;
	durationMs: number;
	sampleRate: number;
	channels: number;
	mimeType: "audio/wav" | "audio/webm" | "audio/mp3";
	dataUrl?: string;
};

export type CapturedVideoClip = {
	id: string;
	kind: "camera" | "screen";
	capturedAt: string;
	durationMs: number;
	mimeType: string;
	dataUrl?: string;
};

export type TranscriptSegment = {
	id: string;
	startMs: number;
	endMs: number;
	text: string;
	confidence?: number;
};

export type AutomationAutonomyLevel = "manual" | "auto_safe" | "auto_full";

export type SupportedActionType =
  | "vts.trigger_hotkey"
  | "vts.set_parameter"
  | "obs.set_scene"
  | "obs.set_source_visibility"
  | "overlay.message"
  | "log.event"
  | "noop";

export interface ModelControlVtsHotkey {
  id: string;
  name: string;
}

export interface ModelControlVtsState {
  connected: boolean;
  authenticated: boolean;
  currentModelName: string | null;
  availableHotkeys: ModelControlVtsHotkey[];
}

export interface ModelControlObsSourceState {
  name: string;
  visible: boolean;
}

export interface ModelControlObsSceneState {
  name: string;
  sources: ModelControlObsSourceState[];
}

export interface ModelControlObsState {
  connected: boolean;
  currentScene: string | null;
  streamStatus: "live" | "inactive";
  recordingStatus: "active" | "inactive";
  scenes: ModelControlObsSceneState[];
}

export interface ModelControlPolicy {
  allowedActions: SupportedActionType[];
}

export interface ModelControlRecentAction {
  actionId: string;
  type: SupportedActionType;
  target: string | null;
  timestamp: string;
}

export interface ModelControlContext {
  tickId: string;
  timestamp: string;
  transcript: string | null;
  services: {
    vts: ModelControlVtsState;
    obs: ModelControlObsState;
    policy: ModelControlPolicy;
  };
  context: {
    autonomyLevel: AutomationAutonomyLevel;
    recentActions: ModelControlRecentAction[];
    cooldowns: Record<string, number>;
  };
}
