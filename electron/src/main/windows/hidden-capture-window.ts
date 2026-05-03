import { BrowserWindow } from "electron";
import { join } from "node:path";

const HIDDEN_WINDOW_WIDTH = 480;
const HIDDEN_WINDOW_HEIGHT = 270;

export async function createHiddenCaptureWindow(): Promise<BrowserWindow> {
	const window = new BrowserWindow({
		width: HIDDEN_WINDOW_WIDTH,
		height: HIDDEN_WINDOW_HEIGHT,
		show: false,
		frame: false,
		transparent: true,
		resizable: false,
		skipTaskbar: true,
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			backgroundThrottling: false,
		},
	});

	const rendererUrl: string | undefined = process.env.ELECTRON_RENDERER_URL;

	if (rendererUrl) {
		await window.loadURL(new URL("hidden-capture.html", rendererUrl).toString());
	} else {
		await window.loadFile(join(__dirname, "../renderer/hidden-capture.html"));
	}

	return window;
}
