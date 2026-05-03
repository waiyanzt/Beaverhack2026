import { ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";
import type { ServiceActivationService } from "../services/service-activation.service";

export function registerServiceActivationIpcHandlers(
  serviceActivationService: ServiceActivationService,
): void {
  ipcMain.handle(IpcChannels.ServicesGetStatus, () => {
    try {
      return { ok: true as const, status: serviceActivationService.getStatus() };
    } catch (error: unknown) {
      console.error("Failed to get service activation status:", error);
      return {
        ok: false as const,
        message: "Unable to get service activation status.",
        status: serviceActivationService.getStatus(),
      };
    }
  });

  ipcMain.handle(IpcChannels.ServicesActivate, async () => {
    try {
      const status = await serviceActivationService.activate("manual", true);
      return { ok: true as const, status };
    } catch (error: unknown) {
      console.error("Failed to activate services:", error);
      return {
        ok: false as const,
        message: "Unable to activate services.",
        status: serviceActivationService.getStatus(),
      };
    }
  });
}
