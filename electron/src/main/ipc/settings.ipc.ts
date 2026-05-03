import { ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";
import { settingsUpdateRequestSchema } from "../../shared/schemas/config.schema";
import { settingsService } from "../services/settings/settings.service";

export function registerSettingsIpcHandlers(): void {
  ipcMain.handle(IpcChannels.SettingsGet, () => {
    try {
      return { ok: true as const, settings: settingsService.getSettings() };
    } catch (error: unknown) {
      console.error("Failed to load settings:", error);
      return {
        ok: false as const,
        message: "Unable to load settings.",
        settings: settingsService.getSettings(),
      };
    }
  });

  ipcMain.handle(IpcChannels.SettingsUpdate, (_event, input: unknown) => {
    const parsed = settingsUpdateRequestSchema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false as const,
        message: "Invalid settings update.",
        settings: settingsService.getSettings(),
      };
    }

    try {
      return {
        ok: true as const,
        settings: settingsService.updateSettings(parsed.data),
      };
    } catch (error: unknown) {
      console.error("Failed to update settings:", error);
      return {
        ok: false as const,
        message: "Unable to update settings.",
        settings: settingsService.getSettings(),
      };
    }
  });
}
