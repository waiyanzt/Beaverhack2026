import { describe, expect, it, vi } from "vitest";
import { ServiceActivationService } from "../../src/main/services/service-activation.service";

describe("ServiceActivationService", () => {
  it("activates OBS and VTS when both services are available", async () => {
    const obsService = {
      connect: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockResolvedValue({ connected: true as const, currentScene: "Live", streamStatus: "inactive" as const, recordingStatus: "inactive" as const, scenes: [] }),
    };
    const vtsService = {
      getStatus: vi.fn()
        .mockReturnValueOnce({
          connected: false,
          authenticated: false,
          connectionState: "disconnected" as const,
          authenticationState: "unauthenticated" as const,
          readinessState: "not_running" as const,
          readyForAutomation: false,
          config: { host: "127.0.0.1", port: 8001, pluginName: "AuTuber", pluginDeveloper: "AuTuber" },
          modelLoaded: false,
          modelName: null,
          modelId: null,
          hotkeyCount: 0,
          catalog: {
            version: null,
            hotkeyHash: null,
            totalEntries: 0,
            safeAutoCount: 0,
            suggestOnlyCount: 0,
            manualOnlyCount: 0,
            entries: [],
          },
          lastError: null,
        }),
      connect: vi.fn().mockResolvedValue({
        connected: true,
        authenticated: false,
        connectionState: "connected" as const,
        authenticationState: "unauthenticated" as const,
        readinessState: "unauthenticated" as const,
        readyForAutomation: false,
        config: { host: "127.0.0.1", port: 8001, pluginName: "AuTuber", pluginDeveloper: "AuTuber" },
        modelLoaded: false,
        modelName: null,
        modelId: null,
        hotkeyCount: 0,
        catalog: {
          version: null,
          hotkeyHash: null,
          totalEntries: 0,
          safeAutoCount: 0,
          suggestOnlyCount: 0,
          manualOnlyCount: 0,
          entries: [],
        },
        lastError: null,
      }),
      authenticate: vi.fn().mockResolvedValue({
        connected: true,
        authenticated: true,
        connectionState: "connected" as const,
        authenticationState: "authenticated" as const,
        readinessState: "ready" as const,
        readyForAutomation: true,
        config: { host: "127.0.0.1", port: 8001, pluginName: "AuTuber", pluginDeveloper: "AuTuber" },
        modelLoaded: true,
        modelName: "Demo",
        modelId: "demo",
        hotkeyCount: 3,
        catalog: {
          version: "vts_catalog_demo",
          hotkeyHash: "demo",
          totalEntries: 3,
          safeAutoCount: 2,
          suggestOnlyCount: 1,
          manualOnlyCount: 0,
          entries: [],
        },
        lastError: null,
      }),
    };

    const service = new ServiceActivationService({
      obsService,
      vtsService,
      settingsService: {
        getSettings: () => ({
          vts: { host: "127.0.0.1", port: 8001, pluginName: "AuTuber", pluginDeveloper: "AuTuber" },
          vtsCatalogOverrides: {},
          dashboard: { selectedAudioDeviceId: null, selectedVideoDeviceId: null, selectedScreenSourceId: null },
          model: { selectedProviderId: "vllm" as const },
          monitor: { resumeOnLaunch: false, lastStartRequest: null },
        }),
      },
    });

    const status = await service.activate("manual", true);

    expect(status.obs.ready).toBe(true);
    expect(status.vts.ready).toBe(true);
    expect(status.retryScheduled).toBe(false);
    expect(obsService.connect).toHaveBeenCalledTimes(0);
    expect(vtsService.connect).toHaveBeenCalledTimes(1);
    expect(vtsService.authenticate).toHaveBeenCalledTimes(1);
  });

  it("schedules an auto retry when a service is unavailable at startup", async () => {
    vi.useFakeTimers();

    const obsService = {
      connect: vi.fn().mockRejectedValue(new Error("OBS not running")),
      getStatus: vi.fn().mockResolvedValue({ connected: false as const }),
    };
    const vtsService = {
      getStatus: vi.fn().mockReturnValue({
        connected: false,
        authenticated: false,
        connectionState: "disconnected" as const,
        authenticationState: "unauthenticated" as const,
        readinessState: "not_running" as const,
        readyForAutomation: false,
        config: { host: "127.0.0.1", port: 8001, pluginName: "AuTuber", pluginDeveloper: "AuTuber" },
        modelLoaded: false,
        modelName: null,
        modelId: null,
        hotkeyCount: 0,
        catalog: {
          version: null,
          hotkeyHash: null,
          totalEntries: 0,
          safeAutoCount: 0,
          suggestOnlyCount: 0,
          manualOnlyCount: 0,
          entries: [],
        },
        lastError: null,
      }),
      connect: vi.fn().mockRejectedValue(new Error("VTS not running")),
      authenticate: vi.fn(),
    };

    const service = new ServiceActivationService({
      obsService,
      vtsService,
      settingsService: {
        getSettings: () => ({
          vts: { host: "127.0.0.1", port: 8001, pluginName: "AuTuber", pluginDeveloper: "AuTuber" },
          vtsCatalogOverrides: {},
          dashboard: { selectedAudioDeviceId: null, selectedVideoDeviceId: null, selectedScreenSourceId: null },
          model: { selectedProviderId: "vllm" as const },
          monitor: { resumeOnLaunch: false, lastStartRequest: null },
        }),
      },
      retryDelayMs: 5000,
    });

    const firstStatus = await service.activate("startup", true);
    expect(firstStatus.retryScheduled).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);

    expect(obsService.connect).toHaveBeenCalledTimes(2);
    expect(vtsService.connect).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
