import type {
	CaptureAudioPayload,
	CaptureAudioLevelPayload,
	CaptureClipPayload,
	CaptureExportClipRequest,
	CaptureExportClipResponse,
	CaptureControlMessage,
	CaptureErrorPayload,
	CaptureFramePayload,
	CaptureMediaDeviceInfo,
	CaptureSourceInfo,
	CaptureStartRequest,
	CaptureStatus,
} from "../../shared/types/capture.types";
import type { VtsConnectionConfig } from "../../shared/types/config.types";
import type {
	VtsHotkeysResult,
	VtsStatusResult,
	VtsTriggerHotkeyRequest,
	VtsTriggerHotkeyResult,
} from "../../shared/types/vts.types";

type CaptureStartResponse =
	| { ok: true; status: CaptureStatus }
	| { ok: false; message: string };

type CaptureStatusResponse =
	| { ok: true; status: CaptureStatus }
	| { ok: false; message: string };

type CaptureStopResponse =
	| { ok: true; status: CaptureStatus }
	| { ok: false; message: string };

type DesktopApi = {
	getAppVersion: () => Promise<string>;
	vtsGetStatus: () => Promise<VtsStatusResult>;
	vtsConnect: (config: VtsConnectionConfig) => Promise<VtsStatusResult>;
	vtsDisconnect: () => Promise<VtsStatusResult>;
	vtsAuthenticate: () => Promise<VtsStatusResult>;
	vtsGetHotkeys: () => Promise<VtsHotkeysResult>;
	vtsTriggerHotkey: (request: VtsTriggerHotkeyRequest) => Promise<VtsTriggerHotkeyResult>;
	captureStart: (config: CaptureStartRequest) => Promise<CaptureStartResponse>;
	captureStop: () => Promise<CaptureStopResponse>;
	captureStatus: () => Promise<CaptureStatusResponse>;
	captureStatusLite: () => Promise<CaptureStatusResponse>;
	listCaptureSources: () => Promise<
		| { ok: true; sources: CaptureSourceInfo[] }
		| { ok: false; message: string }
	>;
	listMediaDevices: () => Promise<
		| { ok: true; devices: CaptureMediaDeviceInfo[] }
		| { ok: false; message: string }
	>;
	captureExportClip: (request: CaptureExportClipRequest) => Promise<CaptureExportClipResponse>;
};

type CaptureBridgeApi = {
	onControlMessage: (handler: (message: CaptureControlMessage) => void) => () => void;
	sendFrame: (payload: CaptureFramePayload) => void;
	sendAudio: (payload: CaptureAudioPayload) => void;
	sendClip: (payload: CaptureClipPayload) => void;
	sendLevel: (payload: CaptureAudioLevelPayload) => void;
	sendError: (payload: CaptureErrorPayload) => void;
};

declare global {
	interface Window {
		desktop: DesktopApi;
		captureBridge: CaptureBridgeApi;
	}
}

export {};
