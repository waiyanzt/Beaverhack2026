import ElectronStoreModule from "electron-store";
import { appConfigSchema } from "../../../shared/schemas/config.schema";
import type {
  AppConfig,
  AfkOverlayConfig,
  DashboardConfig,
  ModelConfig,
  MonitorConfig,
  SettingsUpdateRequest,
  VtsConnectionConfig,
} from "../../../shared/types/config.types";
import type { VtsCatalogOverride, VtsCueLabelDefinition } from "../../../shared/types/vts.types";
import { DEFAULT_VTS_CUE_LABELS } from "../../../shared/vts-cue-labels";

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
  vtsCueLabels: DEFAULT_VTS_CUE_LABELS,
  vtsCatalogOverrides: {},
  dashboard: {
    selectedAudioDeviceId: null,
    selectedVideoDeviceId: null,
    selectedScreenSourceId: null,
    secondaryModelMode: "auto_unsupported",
  },
  model: {
    selectedProviderId: "vllm",
  },
  monitor: {
    resumeOnLaunch: false,
    lastStartRequest: null,
  },
  afkOverlay: {
    enabled: false,
    sceneName: null,
    sourceName: null,
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
      if (JSON.stringify(rawConfig) !== JSON.stringify(parsed.data)) {
        this.getStore().set(APP_CONFIG_KEY, parsed.data);
      }

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

  updateVtsCueLabels(cueLabels: VtsCueLabelDefinition[]): AppConfig {
    const allowedCueLabels = new Set(cueLabels.map((label) => label.id));
    const nextOverrides = Object.fromEntries(
      Object.entries(this.getSettings().vtsCatalogOverrides)
        .map(([hotkeyId, override]) => [
          hotkeyId,
          {
            ...override,
            cueLabels: override.cueLabels.filter((cueLabel) => allowedCueLabels.has(cueLabel)),
          },
        ] as const)
        .filter(([, override]) => override.cueLabels.length > 0),
    );

    return this.updateSettings({
      vtsCueLabels: cueLabels,
      vtsCatalogOverrides: nextOverrides,
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

  updateAfkOverlayConfig(config: AfkOverlayConfig): AppConfig {
    return this.updateSettings({
      afkOverlay: config,
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
