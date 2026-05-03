import { app, Menu } from "electron";
import { registerIpcHandlers } from "./ipc";
import { createMainWindow } from "./windows/main-window";
import { obsConnect, obsGetStatus } from "./services/obs/obs.service";

app.disableHardwareAcceleration();

async function main(): Promise<void> {
  try {
    await app.whenReady();

    Menu.setApplicationMenu(null);
    registerIpcHandlers();
    await createMainWindow();

    try {
      await obsConnect();
      const status = await obsGetStatus();
      console.log("[OBS] Status:", JSON.stringify(status, null, 2));
    } catch (obsErr: unknown) {
      console.warn("[OBS] Could not connect — is OBS running with WebSocket enabled on port 4455?", obsErr instanceof Error ? obsErr.message : obsErr);
    }

    app.on("activate", async () => {
      if (app.dock && app.isReady()) {
        await createMainWindow();
      }
    });
  } catch (error: unknown) {
    console.error("Failed to start Electron app:", error);
    app.quit();
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void main();
