import ElectronStoreModule from "electron-store";
import { appConfigSchema } from "../../../shared/schemas/config.schema";
import type {
  AppConfig,
  DashboardConfig,
  ModelConfig,
  MonitorConfig,
  SettingsUpdateRequest,
  VtsConnectionConfig,
} from "../../../shared/types/config.types";
import type { VtsCatalogOverride } from "../../../shared/types/vts.types";

type ElectronStoreConstructor = new <T extends Record<string, unknown>>(options: {
  name: string;
}) => {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

const ElectronStore =
  (
    ElectronStoreModule as unknown as {
      default?: ElectronStoreConstructor;
    }
  ).default ?? (ElectronStoreModule as unknown as ElectronStoreConstructor);

export const DEFAULT_CONFIG: AppConfig = {
  vts: {
    host: "127.0.0.1",
    port: 8001,
    pluginName: "AuTuber",
    pluginDeveloper: "AuTuber Development Team",
  },
  vtsCatalogOverrides: {},
  dashboard: {
    selectedAudioDeviceId: null,
    selectedVideoDeviceId: null,
    selectedScreenSourceId: null,
  },
  model: {
    selectedProviderId: "vllm",
  },
  monitor: {
    resumeOnLaunch: false,
    lastStartRequest: null,
  },
  vacancyOverlay: {
    sourceName: "BRB Overlay",
    vacantEnterDelayMs: 5_000,
  },
};

const APP_CONFIG_KEY = "appConfig";

export class SettingsService {
  private store: ReturnType<SettingsService["createStore"]> | null = null;

  private createStore() {
    return new ElectronStore<Record<string, unknown>>({
      name: "autuber-settings",
    });
  }

  private getStore() {
    if (!this.store) {
      this.store = this.createStore();
    }

    return this.store;
  }

  getSettings(): AppConfig {
    const rawConfig = this.getStore().get(APP_CONFIG_KEY);
    const parsed = appConfigSchema.safeParse(rawConfig);

    if (parsed.success) {
      return parsed.data;
    }

    this.getStore().set(APP_CONFIG_KEY, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  updateSettings(update: SettingsUpdateRequest): AppConfig {
    const next = appConfigSchema.parse({
      ...this.getSettings(),
      ...update,
    });

    this.getStore().set(APP_CONFIG_KEY, next);
    return next;
  }

  updateVtsConfig(config: VtsConnectionConfig): AppConfig {
    return this.updateSettings({
      vts: config,
    });
  }

  updateVtsCatalogOverrides(overrides: Record<string, VtsCatalogOverride>): AppConfig {
    return this.updateSettings({
      vtsCatalogOverrides: overrides,
    });
  }

  updateDashboardConfig(config: DashboardConfig): AppConfig {
    return this.updateSettings({
      dashboard: config,
    });
  }

  updateModelConfig(config: ModelConfig): AppConfig {
    return this.updateSettings({
      model: config,
    });
  }

  updateMonitorConfig(config: MonitorConfig): AppConfig {
    return this.updateSettings({
      monitor: config,
    });
  }

  updateMonitorSession(lastStartRequest: MonitorConfig["lastStartRequest"], resumeOnLaunch: boolean): AppConfig {
    return this.updateSettings({
      monitor: {
        lastStartRequest,
        resumeOnLaunch,
      },
    });
  }
}

export const settingsService = new SettingsService();
