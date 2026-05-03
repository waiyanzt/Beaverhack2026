import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../src/shared/types/config.types";

vi.mock("../../src/main/services/settings/settings.service", () => ({
  DEFAULT_CONFIG: {
    vts: {
      host: "127.0.0.1",
      port: 8001,
      pluginName: "AuTuber",
      pluginDeveloper: "AuTuber",
    },
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
  },
  settingsService: {
    getSettings: () => ({
      vts: {
        host: "127.0.0.1",
        port: 8001,
        pluginName: "AuTuber",
        pluginDeveloper: "AuTuber",
      },
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
    }),
    updateVtsConfig: (nextConfig: AppConfig["vts"]) => ({
      ...config,
      vts: nextConfig,
    }),
  },
}));

class MockSocket extends EventEmitter {
  readyState = 0;

  constructor(private readonly responder: (payload: Record<string, unknown>) => Record<string, unknown>) {
    super();

    queueMicrotask(() => {
      this.readyState = 1;
      this.emit("open");
    });
  }

  send(data: string): void {
    const payload = JSON.parse(data) as Record<string, unknown>;
    const response = this.responder(payload);

    queueMicrotask(() => {
      this.emit("message", JSON.stringify(response));
    });
  }

  close(): void {
    this.readyState = 3;
    queueMicrotask(() => {
      this.emit("close");
    });
  }
}

const config: AppConfig = {
  vts: {
    host: "127.0.0.1",
    port: 8001,
    pluginName: "AuTuber",
    pluginDeveloper: "AuTuber",
  },
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
};

describe("VtsService", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("connects, authenticates, and loads hotkeys", async () => {
    const { VtsService } = await import("../../src/main/services/vts/vts.service");

    const service = new VtsService({
      createSocket: () =>
        new MockSocket((request) => {
          const requestID = String(request.requestID);
          const messageType = String(request.messageType);

          if (messageType === "AuthenticationTokenRequest") {
            return {
              apiName: "VTubeStudioPublicAPI",
              apiVersion: "1.0",
              requestID,
              messageType: "AuthenticationTokenResponse",
              data: {
                authenticationToken: "token-123",
              },
            };
          }

          if (messageType === "AuthenticationRequest") {
            return {
              apiName: "VTubeStudioPublicAPI",
              apiVersion: "1.0",
              requestID,
              messageType: "AuthenticationResponse",
              data: {
                authenticated: true,
                reason: "ok",
              },
            };
          }

          if (messageType === "HotkeysInCurrentModelRequest") {
            return {
              apiName: "VTubeStudioPublicAPI",
              apiVersion: "1.0",
              requestID,
              messageType: "HotkeysInCurrentModelResponse",
              data: {
                modelLoaded: true,
                modelName: "Demo Model",
                modelID: "model-1",
                availableHotkeys: [
                  {
                    hotkeyID: "wave",
                    name: "Wave",
                    type: "TriggerAnimation",
                    description: "Wave animation",
                    file: "wave.motion3.json",
                  },
                ],
              },
            };
          }

          if (messageType === "HotkeyTriggerRequest") {
            return {
              apiName: "VTubeStudioPublicAPI",
              apiVersion: "1.0",
              requestID,
              messageType: "HotkeyTriggerResponse",
              data: {
                hotkeyID: "wave",
              },
            };
          }

          throw new Error(`Unhandled message type: ${messageType}`);
        }) as never,
      settingsService: {
        getSettings: () => config,
        updateVtsConfig: (nextConfig) => ({
          ...config,
          vts: nextConfig,
        }),
      },
    });

    const statusAfterConnect = await service.connect(config.vts);
    expect(statusAfterConnect.connected).toBe(true);

    const statusAfterAuth = await service.authenticate();
    expect(statusAfterAuth.authenticated).toBe(true);
    expect(statusAfterAuth.modelName).toBe("Demo Model");
    expect(statusAfterAuth.hotkeyCount).toBe(1);

    const triggeredHotkeyId = await service.triggerHotkey("wave");
    expect(triggeredHotkeyId).toBe("wave");
  });

  it("rejects hotkey fetches before authentication", async () => {
    const { VtsService } = await import("../../src/main/services/vts/vts.service");

    const service = new VtsService({
      createSocket: () => new MockSocket(() => ({})) as never,
      settingsService: {
        getSettings: () => config,
        updateVtsConfig: (nextConfig) => ({
          ...config,
          vts: nextConfig,
        }),
      },
    });

    await service.connect(config.vts);

    await expect(service.getHotkeys()).rejects.toThrow("VTube Studio is not authenticated.");
  });
});
