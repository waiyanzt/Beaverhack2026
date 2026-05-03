import type {
	AutomationAnalyzeNowRequest,
	AutomationAnalyzeNowResult,
} from "../../shared/types/action-plan.types";
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
import type {
	ModelMonitorEvent,
	ModelMonitorStartRequest,
	ModelMonitorStartResponse,
	ModelMonitorStatusResponse,
	ModelMonitorStopResponse,
} from "../../shared/types/model-monitor.types";
import type {
	ModelProviderConfig,
	ModelProviderId,
	ModelProviderTestResult,
} from "../../shared/model.types";
import type { ServiceActivationStatusResult } from "../../shared/types/service-activation.types";
import type {
	SettingsGetResult,
	SettingsUpdateRequest,
	SettingsUpdateResult,
	VtsConnectionConfig,
} from "../../shared/types/config.types";
import type {
	VtsCatalogOverrideUpdateRequest,
	VtsCatalogRefreshRequest,
	VtsCatalogResult,
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
	automationAnalyzeNow: (request: AutomationAnalyzeNowRequest) => Promise<AutomationAnalyzeNowResult>;
	servicesActivate: () => Promise<ServiceActivationStatusResult>;
	servicesGetStatus: () => Promise<ServiceActivationStatusResult>;
	settingsGet: () => Promise<SettingsGetResult>;
	settingsUpdate: (request: SettingsUpdateRequest) => Promise<SettingsUpdateResult>;
	vtsGetStatus: () => Promise<VtsStatusResult>;
	vtsConnect: (config: VtsConnectionConfig) => Promise<VtsStatusResult>;
	vtsDisconnect: () => Promise<VtsStatusResult>;
	vtsAuthenticate: () => Promise<VtsStatusResult>;
	vtsGetHotkeys: () => Promise<VtsHotkeysResult>;
	vtsGetCatalog: () => Promise<VtsCatalogResult>;
	vtsRefreshCatalog: (request?: VtsCatalogRefreshRequest) => Promise<VtsCatalogResult>;
	vtsUpdateCatalogOverride: (request: VtsCatalogOverrideUpdateRequest) => Promise<VtsCatalogResult>;
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
	modelMonitorStart: (request: ModelMonitorStartRequest) => Promise<ModelMonitorStartResponse>;
	modelMonitorStop: () => Promise<ModelMonitorStopResponse>;
	modelMonitorStatus: () => Promise<ModelMonitorStatusResponse>;
	onModelMonitorEvent: (handler: (event: ModelMonitorEvent) => void) => () => void;
	modelListProviders: () => Promise<ModelProviderConfig[]>;
	modelSetProvider: (
		providerId: ModelProviderId,
	) => Promise<{ ok: boolean; message?: string }>;
	modelTestConnection: () => Promise<ModelProviderTestResult>;
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
