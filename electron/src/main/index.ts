import { app } from "electron";
import { createMainWindow } from "./create-main-window";
import { registerIpcHandlers } from "../ipc";

app.disableHardwareAcceleration();

async function main(): Promise<void> {
  try {
    await app.whenReady();

    registerIpcHandlers();
    await createMainWindow();

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
