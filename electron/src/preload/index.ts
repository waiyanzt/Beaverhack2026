import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IpcChannels } from "../shared/channels";
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

const desktopApi = {
  getAppVersion: async (): Promise<string> => {
    try {
      return await ipcRenderer.invoke(IpcChannels.GetAppVersion);
    } catch (error: unknown) {
      console.error("Failed to get app version:", error);
      return "unknown";
    }
  },
  getHotkeys: async (): Promise<unknown> => {
    try {
      return await ipcRenderer.invoke(IpcChannels.VtsGetHotkeys);
    } catch (error: unknown) {
      console.error("Failed to get VTS hotkeys:", error);
      return [];
    }
  },
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
