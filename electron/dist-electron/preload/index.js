"use strict";
const electron = require("electron");
const IpcChannels = {
  GetAppVersion: "app:get-version"
};
const desktopApi = {
  getAppVersion: async () => {
    try {
      return await electron.ipcRenderer.invoke(IpcChannels.GetAppVersion);
    } catch (error) {
      console.error("Failed to get app version:", error);
      return "unknown";
    }
  }
};
electron.contextBridge.exposeInMainWorld("desktop", desktopApi);
