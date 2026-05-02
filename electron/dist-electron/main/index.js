"use strict";
const electron = require("electron");
const node_path = require("node:path");
async function createMainWindow() {
  const window = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    await window.loadURL(rendererUrl);
  } else {
    await window.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
  return window;
}
const IpcChannels = {
  GetAppVersion: "app:get-version"
};
function registerIpcHandlers() {
  electron.ipcMain.handle(IpcChannels.GetAppVersion, () => {
    try {
      return electron.app.getVersion();
    } catch (error) {
      console.error("Failed to resolve app version:", error);
      return "unknown";
    }
  });
}
electron.app.disableHardwareAcceleration();
async function main() {
  try {
    await electron.app.whenReady();
    registerIpcHandlers();
    await createMainWindow();
    electron.app.on("activate", async () => {
      if (electron.app.dock && electron.app.isReady()) {
        await createMainWindow();
      }
    });
  } catch (error) {
    console.error("Failed to start Electron app:", error);
    electron.app.quit();
  }
}
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
void main();
