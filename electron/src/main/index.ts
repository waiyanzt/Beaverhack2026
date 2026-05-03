import { app, Menu, session, type WebContents } from "electron";
import { registerIpcHandlers, resumePersistedModelMonitor, serviceActivationService } from "./ipc";
import { createMainWindow } from "./windows/main-window";

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

const isTrustedMediaRequest = (
  webContents: WebContents,
  details: { requestingUrl?: string } | undefined,
): boolean => {
  if (!details) {
    return false;
  }

  if (!details.requestingUrl || !isTrustedAppOrigin(details.requestingUrl)) {
    return false;
  }

  if (webContents.isDestroyed() || webContents.getType() !== "window") {
    return false;
  }

  return true;
};

async function main(): Promise<void> {
  try {
    await app.whenReady();
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      if (permission === "media" && isTrustedMediaRequest(webContents, details)) {
        callback(true);
        return;
      }

      callback(false);
    });

    Menu.setApplicationMenu(null);
    registerIpcHandlers();
    const mainWindow = await createMainWindow();
    void serviceActivationService.activate("startup", true).catch((error: unknown) => {
      console.warn(
        "[Services] Startup activation failed:",
        error instanceof Error ? error.message : error,
      );
    });
    await resumePersistedModelMonitor(mainWindow.webContents);

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
