import type { VtsConnectionConfig } from "./config.types";

export type VtsConnectionState = "disconnected" | "connecting" | "connected";
export type VtsAuthenticationState = "unauthenticated" | "authenticating" | "authenticated";
export type VtsAutomationMode = "safe_auto" | "suggest_only" | "manual_only";
export type VtsCueLabel = string;
export interface VtsCueLabelDefinition {
  id: VtsCueLabel;
  name: string;
  description: string;
}
export type VtsEmoteKind =
  | "expression_reaction"
  | "symbol_effect"
  | "body_motion"
  | "prop_effect"
  | "appearance_toggle"
  | "outfit_toggle"
  | "reset"
  | "unknown";
export type VtsReadinessState =
  | "not_running"
  | "connecting"
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "no_model_loaded"
  | "no_hotkeys"
  | "catalog_building"
  | "ready";

export interface VtsHotkey {
  hotkeyID: string;
  name: string;
  type: string;
  description: string | null;
  file: string | null;
}

export interface VtsCatalogEntry {
  catalogId: string;
  hotkeyId: string;
  hotkeyName: string;
  promptName: string;
  promptDescription: string;
  normalizedName: string;
  cueLabels: VtsCueLabel[];
  emoteKind: VtsEmoteKind;
  autoMode: VtsAutomationMode;
  confidence: number;
  hasAutoDeactivate: boolean;
  manualDeactivateAfterMs: number;
  generatedClassification: {
    cueLabels: VtsCueLabel[];
    emoteKind: VtsEmoteKind;
    autoMode: VtsAutomationMode;
    confidence: number;
    source: "model" | "heuristic";
  };
  override: VtsCatalogOverride | null;
  effectiveSource: "model" | "heuristic" | "override";
}

export interface VtsCatalogOverride {
  cueLabels: VtsCueLabel[];
  emoteKind: VtsEmoteKind;
  autoMode: VtsAutomationMode;
  confidence: number;
  hasAutoDeactivate: boolean;
  manualDeactivateAfterMs: number;
}

export interface VtsCatalogSummary {
  version: string | null;
  hotkeyHash: string | null;
  totalEntries: number;
  safeAutoCount: number;
  suggestOnlyCount: number;
  manualOnlyCount: number;
  entries: VtsCatalogEntry[];
}

export interface VtsStatus {
  connectionState: VtsConnectionState;
  authenticationState: VtsAuthenticationState;
  readinessState: VtsReadinessState;
  readyForAutomation: boolean;
  connected: boolean;
  authenticated: boolean;
  config: VtsConnectionConfig;
  modelLoaded: boolean;
  modelName: string | null;
  modelId: string | null;
  hotkeyCount: number;
  cueLabels: VtsCueLabelDefinition[];
  catalog: VtsCatalogSummary;
  lastError: string | null;
}

export interface VtsTriggerHotkeyRequest {
  hotkeyId: string;
}

export interface VtsCatalogRefreshRequest {
  forceRegenerate?: boolean;
}

export interface VtsCatalogOverrideUpdateRequest {
  hotkeyId: string;
  override: VtsCatalogOverride | null;
}

export interface VtsCueLabelsUpdateRequest {
  cueLabels: VtsCueLabelDefinition[];
}

export type VtsStatusResult =
  | { ok: true; status: VtsStatus }
  | { ok: false; message: string; status: VtsStatus };

export type VtsHotkeysResult =
  | { ok: true; status: VtsStatus; hotkeys: VtsHotkey[] }
  | { ok: false; message: string; status: VtsStatus; hotkeys: VtsHotkey[] };

export type VtsTriggerHotkeyResult =
  | { ok: true; status: VtsStatus; triggeredHotkeyId: string }
  | { ok: false; message: string; status: VtsStatus };

export type VtsCatalogResult =
  | { ok: true; status: VtsStatus; catalog: VtsCatalogSummary }
  | { ok: false; message: string; status: VtsStatus; catalog: VtsCatalogSummary };
