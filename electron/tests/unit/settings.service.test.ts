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
    expect(service.getSettings()).toEqual(updated);
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
