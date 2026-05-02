import { app, ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.GetAppVersion, () => {
    try {
      return app.getVersion();
    } catch (error: unknown) {
      console.error("Failed to resolve app version:", error);
      return "unknown";
    }
  });
}
