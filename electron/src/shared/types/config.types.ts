import type { ModelMonitorStartRequest } from "./model-monitor.types";
import type { ModelProviderId } from "../model.types";
import type { VtsCatalogOverride } from "./vts.types";

export interface VtsConnectionConfig {
  host: string;
  port: number;
  pluginName: string;
  pluginDeveloper: string;
}

export interface DashboardConfig {
  selectedAudioDeviceId: string | null;
  selectedVideoDeviceId: string | null;
  selectedScreenSourceId: string | null;
}

export interface ModelConfig {
  selectedProviderId: ModelProviderId;
}

export interface MonitorConfig {
  resumeOnLaunch: boolean;
  lastStartRequest: ModelMonitorStartRequest | null;
}

export interface VacancyOverlayConfig {
  sourceName: string;
  vacantEnterDelayMs: number;
}

export interface AppConfig {
  vts: VtsConnectionConfig;
  vtsCatalogOverrides: Record<string, VtsCatalogOverride>;
  dashboard: DashboardConfig;
  model: ModelConfig;
  monitor: MonitorConfig;
  vacancyOverlay: VacancyOverlayConfig;
}

export type SettingsGetResult =
  | { ok: true; settings: AppConfig }
  | { ok: false; message: string; settings: AppConfig };

export type SettingsUpdateRequest = Partial<AppConfig>;

export type SettingsUpdateResult =
  | { ok: true; settings: AppConfig }
  | { ok: false; message: string; settings: AppConfig };
