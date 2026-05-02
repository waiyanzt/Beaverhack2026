import { BrowserWindow } from "electron";
import { join } from "node:path";

export async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const rendererUrl: string | undefined = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    await window.loadURL(rendererUrl);
  } else {
    await window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}
