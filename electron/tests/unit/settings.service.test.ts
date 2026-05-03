import { beforeEach, describe, expect, it, vi } from "vitest";

const storeState = new Map<string, unknown>();

vi.mock("electron-store", () => ({
  default: class MockElectronStore {
    get(key: string): unknown {
      return storeState.get(key);
    }

    set(key: string, value: unknown): void {
      storeState.set(key, value);
    }
  },
}));

describe("SettingsService", () => {
  beforeEach(() => {
    storeState.clear();
    vi.resetModules();
  });

  it("returns default settings when the store is empty", async () => {
    const { DEFAULT_CONFIG, SettingsService } = await import(
      "../../src/main/services/settings/settings.service"
    );

    const service = new SettingsService();

    expect(service.getSettings()).toEqual(DEFAULT_CONFIG);
  });

  it("persists dashboard, model, and monitor settings updates", async () => {
    const { SettingsService } = await import("../../src/main/services/settings/settings.service");

    const service = new SettingsService();
    const updated = service.updateSettings({
      dashboard: {
        selectedAudioDeviceId: "mic-1",
        selectedVideoDeviceId: "cam-1",
        selectedScreenSourceId: "screen:1",
      },
      model: {
        selectedProviderId: "openrouter",
      },
      monitor: {
        resumeOnLaunch: true,
        lastStartRequest: {
          tickIntervalMs: 500,
          windowMs: 2_000,
          capture: {
            camera: {
              enabled: true,
              fps: 15,
              maxFrames: 8,
              resolution: "640x360",
              jpegQuality: 75,
              detail: "low",
              clipDurationSeconds: 2,
              maxClips: 12,
              deviceId: "cam-1",
            },
            screen: {
              enabled: true,
              fps: 1,
              maxFrames: 4,
              resolution: "640x360",
              jpegQuality: 70,
              detail: "low",
              clipDurationSeconds: 2,
              maxClips: 1,
              sourceId: "screen:1",
            },
            audio: {
              enabled: true,
              sampleRate: 16000,
              channels: 1,
              bufferDurationSeconds: 2,
              transcriptionEnabled: false,
              sendRawAudio: false,
              deviceId: "mic-1",
            },
          },
        },
      },
    });

    expect(updated.dashboard.selectedAudioDeviceId).toBe("mic-1");
    expect(updated.model.selectedProviderId).toBe("openrouter");
    expect(updated.monitor.resumeOnLaunch).toBe(true);
    expect(updated.afkOverlay.enabled).toBe(false);
    expect(service.getSettings()).toEqual(updated);
  });

  it("persists AFK overlay settings updates", async () => {
    const { SettingsService } = await import("../../src/main/services/settings/settings.service");

    const service = new SettingsService();
    const updated = service.updateAfkOverlayConfig({
      enabled: true,
      sceneName: "Main",
      sourceName: "BRB Overlay",
      vacantEnterDelayMs: 10_000,
    });

    expect(updated.afkOverlay).toEqual({
      enabled: true,
      sceneName: "Main",
      sourceName: "BRB Overlay",
      vacantEnterDelayMs: 10_000,
    });
    expect(service.getSettings()).toEqual(updated);
  });

  it("migrates legacy vacancy overlay settings without enabling OBS automation", async () => {
    storeState.set("appConfig", {
      vts: {
        host: "127.0.0.1",
        port: 8001,
        pluginName: "AuTuber",
        pluginDeveloper: "AuTuber Development Team",
      },
      vtsCueLabels: [
        { id: "idle", name: "Idle", description: "" },
      ],
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
        sourceName: "Legacy BRB",
        vacantEnterDelayMs: 7_000,
      },
    });

    const { SettingsService } = await import("../../src/main/services/settings/settings.service");

    const service = new SettingsService();

    expect(service.getSettings().afkOverlay).toEqual({
      enabled: false,
      sceneName: null,
      sourceName: "Legacy BRB",
      vacantEnterDelayMs: 7_000,
    });
  });

  it("recovers to defaults when stored settings are invalid", async () => {
    storeState.set("appConfig", {
      dashboard: {},
      model: {
        selectedProviderId: "unknown",
      },
    });

    const { DEFAULT_CONFIG, SettingsService } = await import(
      "../../src/main/services/settings/settings.service"
    );

    const service = new SettingsService();

    expect(service.getSettings()).toEqual(DEFAULT_CONFIG);
  });
});
