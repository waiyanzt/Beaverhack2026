import { ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";
import {
  vtsCatalogOverrideUpdateRequestSchema,
  vtsCatalogRefreshRequestSchema,
  vtsConnectRequestSchema,
  vtsTriggerHotkeyRequestSchema,
} from "../../shared/schemas/vts.schema";
import { vtsService } from "../services/vts/vts.service";

export function registerVtsIpcHandlers(): void {
  ipcMain.handle(IpcChannels.VtsGetStatus, () => {
    try {
      return { ok: true as const, status: vtsService.getStatus() };
    } catch (error: unknown) {
      console.error("Failed to get VTS status:", error);
      return { ok: false as const, message: "Unable to get VTube Studio status.", status: vtsService.getStatus() };
    }
  });

  ipcMain.handle(IpcChannels.VtsConnect, async (_event, input: unknown) => {
    const parsed = vtsConnectRequestSchema.safeParse(input);

    if (!parsed.success) {
      return { ok: false as const, message: "Invalid VTube Studio connection settings.", status: vtsService.getStatus() };
    }

    try {
      const status = await vtsService.connect(parsed.data);
      return { ok: true as const, status };
    } catch (error: unknown) {
      console.error("Failed to connect to VTube Studio:", error);
      return { ok: false as const, message: "Unable to connect to VTube Studio.", status: vtsService.getStatus() };
    }
  });

  ipcMain.handle(IpcChannels.VtsDisconnect, async () => {
    try {
      const status = await vtsService.disconnect();
      return { ok: true as const, status };
    } catch (error: unknown) {
      console.error("Failed to disconnect from VTube Studio:", error);
      return { ok: false as const, message: "Unable to disconnect from VTube Studio.", status: vtsService.getStatus() };
    }
  });

  ipcMain.handle(IpcChannels.VtsAuthenticate, async () => {
    try {
      const status = await vtsService.authenticate();
      return { ok: true as const, status };
    } catch (error: unknown) {
      console.error("Failed to authenticate with VTube Studio:", error);
      return { ok: false as const, message: "Unable to authenticate with VTube Studio.", status: vtsService.getStatus() };
    }
  });

  ipcMain.handle(IpcChannels.VtsGetHotkeys, async () => {
    try {
      const hotkeys = await vtsService.getHotkeys();
      return { ok: true as const, hotkeys, status: vtsService.getStatus() };
    } catch (error: unknown) {
      console.error("Failed to get VTS hotkeys:", error);
      return { ok: false as const, message: "Unable to fetch VTube Studio hotkeys.", hotkeys: [], status: vtsService.getStatus() };
    }
  });

  ipcMain.handle(IpcChannels.VtsGetCatalog, () => {
    try {
      return { ok: true as const, status: vtsService.getStatus(), catalog: vtsService.getCatalog() };
    } catch (error: unknown) {
      console.error("Failed to get VTS catalog:", error);
      return {
        ok: false as const,
        message: "Unable to get VTube Studio catalog.",
        status: vtsService.getStatus(),
        catalog: vtsService.getCatalog(),
      };
    }
  });

  ipcMain.handle(IpcChannels.VtsRefreshCatalog, async (_event, input: unknown) => {
    const parsed = vtsCatalogRefreshRequestSchema.safeParse(input ?? {});

    if (!parsed.success) {
      return {
        ok: false as const,
        message: "Invalid VTube Studio catalog refresh request.",
        status: vtsService.getStatus(),
        catalog: vtsService.getCatalog(),
      };
    }

    try {
      if (vtsService.getStatus().authenticated) {
        await vtsService.getHotkeys();
      }
      const catalog = await vtsService.refreshCatalog(parsed.data);
      return { ok: true as const, status: vtsService.getStatus(), catalog };
    } catch (error: unknown) {
      console.error("Failed to refresh VTS catalog:", error);
      return {
        ok: false as const,
        message: "Unable to refresh VTube Studio catalog.",
        status: vtsService.getStatus(),
        catalog: vtsService.getCatalog(),
      };
    }
  });

  ipcMain.handle(IpcChannels.VtsUpdateCatalogOverride, (_event, input: unknown) => {
    const parsed = vtsCatalogOverrideUpdateRequestSchema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false as const,
        message: "Invalid VTube Studio catalog override.",
        status: vtsService.getStatus(),
        catalog: vtsService.getCatalog(),
      };
    }

    try {
      const catalog = vtsService.updateCatalogOverride(parsed.data.hotkeyId, parsed.data.override);
      return { ok: true as const, status: vtsService.getStatus(), catalog };
    } catch (error: unknown) {
      console.error("Failed to update VTS catalog override:", error);
      return {
        ok: false as const,
        message: "Unable to update VTube Studio catalog override.",
        status: vtsService.getStatus(),
        catalog: vtsService.getCatalog(),
      };
    }
  });

  ipcMain.handle(IpcChannels.VtsTriggerHotkey, async (_event, input: unknown) => {
    const parsed = vtsTriggerHotkeyRequestSchema.safeParse(input);

    if (!parsed.success) {
      return { ok: false as const, message: "Invalid VTube Studio hotkey request.", status: vtsService.getStatus() };
    }

    try {
      const triggeredHotkeyId = await vtsService.triggerHotkey(parsed.data.hotkeyId);
      return { ok: true as const, status: vtsService.getStatus(), triggeredHotkeyId };
    } catch (error: unknown) {
      console.error("Failed to trigger VTS hotkey:", error);
      return { ok: false as const, message: "Unable to trigger VTube Studio hotkey.", status: vtsService.getStatus() };
    }
  });
}
