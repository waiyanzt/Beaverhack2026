import type { VtsConnectionConfig } from "./config.types";

export type VtsConnectionState = "disconnected" | "connecting" | "connected";
export type VtsAuthenticationState = "unauthenticated" | "authenticating" | "authenticated";
export type VtsAutomationMode = "safe_auto" | "suggest_only" | "manual_only";
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
  normalizedName: string;
  intent: string;
  autoMode: VtsAutomationMode;
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
  catalog: VtsCatalogSummary;
  lastError: string | null;
}

export interface VtsTriggerHotkeyRequest {
  hotkeyId: string;
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
