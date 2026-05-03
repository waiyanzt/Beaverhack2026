import ElectronStoreModule from "electron-store";
import { appConfigSchema } from "../../../shared/schemas/config.schema";
import type { AppConfig, VtsConnectionConfig } from "../../../shared/types/config.types";

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

  updateVtsConfig(config: VtsConnectionConfig): AppConfig {
    const next = appConfigSchema.parse({
      ...this.getSettings(),
      vts: config,
    });

    this.getStore().set(APP_CONFIG_KEY, next);
    return next;
  }
}

export const settingsService = new SettingsService();
