import type { VtsConnectionConfig } from "./config.types";

export type VtsConnectionState = "disconnected" | "connecting" | "connected";
export type VtsAuthenticationState = "unauthenticated" | "authenticating" | "authenticated";

export interface VtsHotkey {
  hotkeyID: string;
  name: string;
  type: string;
  description: string | null;
  file: string | null;
}

export interface VtsStatus {
  connectionState: VtsConnectionState;
  authenticationState: VtsAuthenticationState;
  connected: boolean;
  authenticated: boolean;
  config: VtsConnectionConfig;
  modelLoaded: boolean;
  modelName: string | null;
  modelId: string | null;
  hotkeyCount: number;
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
