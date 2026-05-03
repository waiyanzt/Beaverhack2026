import type { ModelMonitorStartRequest } from "./model-monitor.types";
import type { ModelProviderId } from "../model.types";
import type { VtsCatalogOverride, VtsCueLabelDefinition } from "./vts.types";

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

export interface AppConfig {
  vts: VtsConnectionConfig;
  vtsCueLabels: VtsCueLabelDefinition[];
  vtsCatalogOverrides: Record<string, VtsCatalogOverride>;
  dashboard: DashboardConfig;
  model: ModelConfig;
  monitor: MonitorConfig;
}

export type SettingsGetResult =
  | { ok: true; settings: AppConfig }
  | { ok: false; message: string; settings: AppConfig };

export type SettingsUpdateRequest = Partial<AppConfig>;

export type SettingsUpdateResult =
  | { ok: true; settings: AppConfig }
  | { ok: false; message: string; settings: AppConfig };
