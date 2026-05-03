import { ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";
import { obsService } from "../services/obs/obs.service";

export function registerObsIpcHandlers(): void {
  ipcMain.handle(IpcChannels.ObsGetStatus, async () => {
    try {
      return { ok: true as const, status: await obsService.getStatus() };
    } catch (error: unknown) {
      console.error("Failed to get OBS status:", error);
      return {
        ok: false as const,
        message: "Unable to get OBS status.",
        status: await obsService.getStatus(),
      };
    }
  });
}
