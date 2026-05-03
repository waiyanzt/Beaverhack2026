import type { ActionPlan, LocalAction } from "../schemas/action-plan.schema";

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

export interface ModelControlVtsCatalogItem {
  catalogId: string;
  label: string;
  description: string;
  intent: string;
  autoMode: "safe_auto" | "suggest_only" | "manual_only";
}

export interface ModelControlVtsCatalogState {
  version: string | null;
  readinessState:
    | "not_running"
    | "connecting"
    | "unauthenticated"
    | "authenticating"
    | "authenticated"
    | "no_model_loaded"
    | "no_hotkeys"
    | "catalog_building"
    | "ready";
  readyForAutomation: boolean;
  safeAutoCount: number;
  suggestOnlyCount: number;
  manualOnlyCount: number;
  candidates: ModelControlVtsCatalogItem[];
}

export interface ModelControlVtsState {
  connected: boolean;
  authenticated: boolean;
  currentModelName: string | null;
  availableHotkeys: ModelControlVtsHotkey[];
  automationCatalog: ModelControlVtsCatalogState;
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
  label: string;
  timestamp: string;
}

export interface ModelControlRecentModelActionResult {
  actionId: string;
  type: LocalAction["type"];
  status: "executed" | "blocked" | "failed" | "confirmation_required" | "noop" | "not_executed";
  reason: string;
  errorMessage?: string;
}

export interface ModelControlRecentModelAction {
  sequence: number;
  storedAt: string;
  actionPlan: ActionPlan;
  actionResults: ModelControlRecentModelActionResult[];
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
    recentModelActions: ModelControlRecentModelAction[];
    cooldowns: Record<string, number>;
  };
}
