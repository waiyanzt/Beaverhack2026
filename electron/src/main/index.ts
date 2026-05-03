import { app, Menu, session, type PermissionRequestHandlerHandlerDetails } from "electron";
import { registerIpcHandlers } from "./ipc";
import { createMainWindow } from "./windows/main-window";
import { obsConnect, obsGetStatus } from "./services/obs/obs.service";

const isTrustedAppOrigin = (requestingUrl: string): boolean => {
  if (requestingUrl.startsWith("file://")) {
    return true;
  }

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (!rendererUrl) {
    return false;
  }

  try {
    return new URL(requestingUrl).origin === new URL(rendererUrl).origin;
  } catch {
    return false;
  }
};

const isTrustedMediaRequest = (details: PermissionRequestHandlerHandlerDetails | undefined): boolean => {
  if (!details) {
    return false;
  }

  if (!details.requestingUrl || !isTrustedAppOrigin(details.requestingUrl)) {
    return false;
  }

  if (details.webContents.getType() !== "window") {
    return false;
  }

  return true;
};

async function main(): Promise<void> {
  try {
    await app.whenReady();
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
      if (permission === "media" && isTrustedMediaRequest(details)) {
        callback(true);
        return;
      }

      callback(false);
    });

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
