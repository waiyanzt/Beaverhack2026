import { ipcMain } from "electron";
import { IpcChannels } from "../../shared/channels";

export function registerVtsIpcHandlers(): void {
  ipcMain.handle(IpcChannels.VtsGetHotkeys, () => {
    try {
      return [
        { hotkeyID: "hotkey-001", name: "Wave", type: "TriggerAnimation" },
        { hotkeyID: "hotkey-002", name: "Blush", type: "TriggerAnimation" },
        { hotkeyID: "hotkey-003", name: "Laugh", type: "TriggerAnimation" },
      ];
    } catch (error: unknown) {
      console.error("Failed to get VTS hotkeys:", error);
      return [];
    }
  });
}
