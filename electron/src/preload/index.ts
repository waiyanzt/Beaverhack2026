import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/channels";

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
};

contextBridge.exposeInMainWorld("desktop", desktopApi);
