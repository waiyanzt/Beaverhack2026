import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IpcChannels } from "../shared/channels";
import { createIdleModelMonitorStatus } from "../shared/model-monitor.defaults";
import type { AutomationAnalyzeNowRequest, AutomationAnalyzeNowResult } from "../shared/types/action-plan.types";
import type {
  SettingsGetResult,
  SettingsUpdateRequest,
  SettingsUpdateResult,
  VtsConnectionConfig,
} from "../shared/types/config.types";
import type {
  CaptureAudioPayload,
  CaptureAudioLevelPayload,
  CaptureControlMessage,
  CaptureErrorPayload,
  CaptureFramePayload,
  CaptureClipPayload,
  CaptureExportClipRequest,
  CaptureExportClipResponse,
  CaptureMediaDeviceInfo,
  CaptureSourceInfo,
  CaptureStartRequest,
} from "../shared/types/capture.types";
import type {
  ModelMonitorEvent,
  ModelMonitorStartRequest,
  ModelMonitorStartResponse,
  ModelMonitorStatusResponse,
  ModelMonitorStopResponse,
} from "../shared/types/model-monitor.types";
import type {
  VtsHotkeysResult,
  VtsStatus,
  VtsStatusResult,
  VtsTriggerHotkeyRequest,
  VtsTriggerHotkeyResult,
} from "../shared/types/vts.types";

const fallbackVtsStatus: VtsStatus = {
  connectionState: "disconnected",
  authenticationState: "unauthenticated",
  connected: false,
  authenticated: false,
  config: {
    host: "127.0.0.1",
    port: 8001,
    pluginName: "AuTuber",
    pluginDeveloper: "AuTuber Development Team",
  },
  modelLoaded: false,
  modelName: null,
  modelId: null,
  hotkeyCount: 0,
  lastError: null,
};

const fallbackSettings = {
  vts: fallbackVtsStatus.config,
  dashboard: {
    selectedAudioDeviceId: null,
    selectedVideoDeviceId: null,
    selectedScreenSourceId: null,
  },
  model: {
    selectedProviderId: "vllm" as const,
  },
  monitor: {
    resumeOnLaunch: false,
    lastStartRequest: null,
  },
};

const desktopApi = {
  getAppVersion: async (): Promise<string> => {
    try {
      return await ipcRenderer.invoke(IpcChannels.GetAppVersion);
    } catch (error: unknown) {
      console.error("Failed to get app version:", error);
      return "unknown";
    }
  },
  automationAnalyzeNow: async (request: AutomationAnalyzeNowRequest): Promise<AutomationAnalyzeNowResult> =>
    ipcRenderer.invoke(IpcChannels.AutomationAnalyzeNow, request).catch((error: unknown) => {
      console.error("Failed to run automation analysis:", error);
      return { ok: false as const, message: "Unable to run automation analysis." };
    }),
  settingsGet: async (): Promise<SettingsGetResult> =>
    ipcRenderer.invoke(IpcChannels.SettingsGet).catch((error: unknown) => {
      console.error("Failed to load settings:", error);
      return {
        ok: false as const,
        message: "Unable to load settings.",
        settings: fallbackSettings,
      };
    }),
  settingsUpdate: async (request: SettingsUpdateRequest): Promise<SettingsUpdateResult> =>
    ipcRenderer.invoke(IpcChannels.SettingsUpdate, request).catch((error: unknown) => {
      console.error("Failed to update settings:", error);
      return {
        ok: false as const,
        message: "Unable to update settings.",
        settings: fallbackSettings,
      };
    }),
  vtsGetStatus: async (): Promise<VtsStatusResult> =>
    ipcRenderer.invoke(IpcChannels.VtsGetStatus).catch((error: unknown) => {
      console.error("Failed to get VTS status:", error);
      return { ok: false as const, message: "Unable to get VTube Studio status.", status: fallbackVtsStatus };
    }),
  vtsConnect: async (config: VtsConnectionConfig): Promise<VtsStatusResult> =>
    ipcRenderer.invoke(IpcChannels.VtsConnect, config).catch((error: unknown) => {
      console.error("Failed to connect to VTS:", error);
      return { ok: false as const, message: "Unable to connect to VTube Studio.", status: fallbackVtsStatus };
    }),
  vtsDisconnect: async (): Promise<VtsStatusResult> =>
    ipcRenderer.invoke(IpcChannels.VtsDisconnect).catch((error: unknown) => {
      console.error("Failed to disconnect from VTS:", error);
      return { ok: false as const, message: "Unable to disconnect from VTube Studio.", status: fallbackVtsStatus };
    }),
  vtsAuthenticate: async (): Promise<VtsStatusResult> =>
    ipcRenderer.invoke(IpcChannels.VtsAuthenticate).catch((error: unknown) => {
      console.error("Failed to authenticate with VTS:", error);
      return { ok: false as const, message: "Unable to authenticate with VTube Studio.", status: fallbackVtsStatus };
    }),
  vtsGetHotkeys: async (): Promise<VtsHotkeysResult> =>
    ipcRenderer.invoke(IpcChannels.VtsGetHotkeys).catch((error: unknown) => {
      console.error("Failed to get VTS hotkeys:", error);
      return { ok: false as const, message: "Unable to fetch VTube Studio hotkeys.", hotkeys: [], status: fallbackVtsStatus };
    }),
  vtsTriggerHotkey: async (request: VtsTriggerHotkeyRequest): Promise<VtsTriggerHotkeyResult> =>
    ipcRenderer.invoke(IpcChannels.VtsTriggerHotkey, request).catch((error: unknown) => {
      console.error("Failed to trigger VTS hotkey:", error);
      return { ok: false as const, message: "Unable to trigger VTube Studio hotkey.", status: fallbackVtsStatus };
    }),
  captureStart: async (config: CaptureStartRequest) =>
    ipcRenderer.invoke(IpcChannels.CaptureStart, config).catch((error: unknown) => {
      console.error("Failed to start capture:", error);
      return { ok: false as const, message: "Unable to start capture." };
    }),
  captureStop: async () =>
    ipcRenderer.invoke(IpcChannels.CaptureStop).catch((error: unknown) => {
      console.error("Failed to stop capture:", error);
      return { ok: false as const, message: "Unable to stop capture." };
    }),
  captureStatus: async () =>
    ipcRenderer.invoke(IpcChannels.CaptureStatus).catch((error: unknown) => {
      console.error("Failed to get capture status:", error);
      return { ok: false as const, message: "Unable to get status." };
    }),
  captureStatusLite: async () =>
    ipcRenderer.invoke(IpcChannels.CaptureStatusLite).catch((error: unknown) => {
      console.error("Failed to get lite capture status:", error);
      return { ok: false as const, message: "Unable to get status." };
    }),
  listCaptureSources: async (): Promise<{ ok: true; sources: CaptureSourceInfo[] } | { ok: false; message: string }> =>
    ipcRenderer.invoke(IpcChannels.CaptureListSources).catch((error: unknown) => {
      console.error("Failed to list capture sources:", error);
      return { ok: false as const, message: "Unable to list capture sources." };
    }),
  listMediaDevices: async (): Promise<{ ok: true; devices: CaptureMediaDeviceInfo[] } | { ok: false; message: string }> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        ok: true as const,
        devices: devices
          .filter((device) => device.kind === "audioinput" || device.kind === "videoinput")
          .map((device) => ({
            deviceId: device.deviceId,
            kind: device.kind as "audioinput" | "videoinput",
            label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
          })),
      };
    } catch (error: unknown) {
      console.error("Failed to list media devices:", error);
      return { ok: false as const, message: "Unable to list media devices." };
    }
  },
  captureExportClip: async (request: CaptureExportClipRequest): Promise<CaptureExportClipResponse> =>
    ipcRenderer.invoke(IpcChannels.CaptureExportClip, request).catch((error: unknown) => {
      console.error("Failed to export capture clip:", error);
      return { ok: false as const, message: "Unable to export capture clip." };
    }),
  modelMonitorStart: async (request: ModelMonitorStartRequest): Promise<ModelMonitorStartResponse> =>
    ipcRenderer.invoke(IpcChannels.ModelMonitorStart, request).catch((error: unknown) => {
      console.error("Failed to start model monitor:", error);
      return {
        ok: false as const,
        message: "Unable to start model monitor.",
        status: createIdleModelMonitorStatus({
          tickIntervalMs: request.tickIntervalMs,
          windowMs: request.windowMs,
          lastError: "Unable to start model monitor.",
        }),
      };
    }),
  modelMonitorStop: async (): Promise<ModelMonitorStopResponse> =>
    ipcRenderer.invoke(IpcChannels.ModelMonitorStop).catch((error: unknown) => {
      console.error("Failed to stop model monitor:", error);
      return {
        ok: false as const,
        message: "Unable to stop model monitor.",
        status: createIdleModelMonitorStatus({
          lastError: "Unable to stop model monitor.",
        }),
      };
    }),
  modelMonitorStatus: async (): Promise<ModelMonitorStatusResponse> =>
    ipcRenderer.invoke(IpcChannels.ModelMonitorStatus).catch((error: unknown) => {
      console.error("Failed to get model monitor status:", error);
      return {
        ok: false as const,
        message: "Unable to get model monitor status.",
        status: createIdleModelMonitorStatus({
          lastError: "Unable to get model monitor status.",
        }),
      };
    }),
  onModelMonitorEvent: (handler: (event: ModelMonitorEvent) => void) => {
    const listener = (_event: IpcRendererEvent, payload: ModelMonitorEvent) => {
      handler(payload);
    };

    ipcRenderer.on(IpcChannels.ModelMonitorEvent, listener);

    return () => {
      ipcRenderer.removeListener(IpcChannels.ModelMonitorEvent, listener);
    };
  },
};

const captureBridge = {
  onControlMessage: (handler: (message: CaptureControlMessage) => void) => {
    const listener = (_event: IpcRendererEvent, message: CaptureControlMessage) => {
      handler(message);
    };

    ipcRenderer.on(IpcChannels.CaptureControl, listener);

    return () => {
      ipcRenderer.removeListener(IpcChannels.CaptureControl, listener);
    };
  },
  sendFrame: (payload: CaptureFramePayload) => {
    ipcRenderer.send(IpcChannels.CaptureFrame, payload);
  },
  sendAudio: (payload: CaptureAudioPayload) => {
    ipcRenderer.send(IpcChannels.CaptureAudio, payload);
  },
  sendClip: (payload: CaptureClipPayload) => {
    ipcRenderer.send(IpcChannels.CaptureClip, payload);
  },
  sendLevel: (payload: CaptureAudioLevelPayload) => {
    ipcRenderer.send(IpcChannels.CaptureLevel, payload);
  },
  sendError: (payload: CaptureErrorPayload) => {
    ipcRenderer.send(IpcChannels.CaptureError, payload);
  },
};

contextBridge.exposeInMainWorld("desktop", desktopApi);
contextBridge.exposeInMainWorld("captureBridge", captureBridge);
