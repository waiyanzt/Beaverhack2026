import type { BrowserWindow } from "electron";
import { Buffer } from "node:buffer";
import { IpcChannels } from "../../../shared/channels";
import type {
	CaptureErrorPayload,
	CaptureClipKind,
	CaptureFramePayload,
	CaptureClipPayload,
	CaptureStartRequest,
	CaptureStatus,
} from "../../../shared/types/capture.types";
import type {
	CapturedAudioChunk,
	CapturedFrame,
	CapturedVideoClip,
} from "../../../shared/types/observation.types";
import { decodeDataUrl, encodeDataUrl } from "../../utils/base64";
import { createId } from "../../utils/ids";
import { AudioBufferService } from "./audio-buffer.service";
import { FrameBufferService } from "./frame-buffer.service";
import { VideoClipBufferService } from "./video-clip-buffer.service";

type CaptureWindowFactory = () => Promise<BrowserWindow>;

type CaptureOrchestratorOptions = {
	createHiddenWindow: CaptureWindowFactory;
	clock?: () => number;
};

type CaptureBuffers = {
	camera: FrameBufferService | null;
	screen: FrameBufferService | null;
	audio: AudioBufferService | null;
	audioClips: VideoClipBufferService | null;
	cameraClips: VideoClipBufferService | null;
	screenClips: VideoClipBufferService | null;
};

const toIso = (timestampMs: number): string => new Date(timestampMs).toISOString();

export class CaptureOrchestratorService {
	private readonly createHiddenWindow: CaptureWindowFactory;
	private readonly clock: () => number;
	private hiddenWindow: BrowserWindow | null = null;
	private buffers: CaptureBuffers = {
		camera: null,
		screen: null,
		audio: null,
		audioClips: null,
		cameraClips: null,
		screenClips: null,
	};
	private config: CaptureStartRequest | null = null;
	private lastAudioMimeType: string | null = null;
	private status: CaptureStatus = {
		running: false,
		startedAt: null,
		camera: {
			enabled: false,
			active: false,
			lastFrameAt: null,
			lastPreviewDataUrl: null,
			lastClipAt: null,
			lastClipMimeType: null,
			lastClipDurationMs: null,
			lastError: null,
		},
		screen: {
			enabled: false,
			active: false,
			lastFrameAt: null,
			lastPreviewDataUrl: null,
			lastClipAt: null,
			lastClipMimeType: null,
			lastClipDurationMs: null,
			lastError: null,
		},
		audio: {
			enabled: false,
			active: false,
			lastChunkAt: null,
			lastLevel: null,
			lastLevelAt: null,
			recentLevels: [],
			lastError: null,
		},
		buffers: {
			camera: null,
			screen: null,
			audio: null,
			audioClips: null,
			cameraClips: null,
			screenClips: null,
		},
	};

	constructor(options: CaptureOrchestratorOptions) {
		this.createHiddenWindow = options.createHiddenWindow;
		this.clock = options.clock ?? (() => Date.now());
	}

	async start(config: CaptureStartRequest): Promise<CaptureStatus> {
		this.config = config;
		this.prepareBuffers(config);
		this.status = {
			running: true,
			startedAt: toIso(this.clock()),
			camera: {
				enabled: config.camera.enabled,
				active: false,
				lastFrameAt: null,
				lastPreviewDataUrl: null,
				lastClipAt: null,
				lastClipMimeType: null,
				lastClipDurationMs: null,
				lastError: null,
			},
			screen: {
				enabled: config.screen.enabled,
				active: false,
				lastFrameAt: null,
				lastPreviewDataUrl: null,
				lastClipAt: null,
				lastClipMimeType: null,
				lastClipDurationMs: null,
				lastError: null,
			},
			audio: {
				enabled: config.audio.enabled,
				active: false,
				lastChunkAt: null,
				lastLevel: null,
				lastLevelAt: null,
				recentLevels: [],
				lastError: null,
			},
			buffers: {
				camera: null,
				screen: null,
				audio: null,
				audioClips: null,
				cameraClips: null,
				screenClips: null,
			},
		};

		if (!this.hiddenWindow || this.hiddenWindow.isDestroyed()) {
			this.hiddenWindow = await this.createHiddenWindow();
			this.hiddenWindow.on("closed", () => {
				this.hiddenWindow = null;
				this.status.running = false;
			});
		}

		this.hiddenWindow.webContents.send(IpcChannels.CaptureControl, {
			type: "start",
			config,
		});

		return this.getStatus();
	}

	async stop(): Promise<CaptureStatus> {
		this.status.running = false;
		this.status.camera.active = false;
		this.status.screen.active = false;
		this.status.audio.active = false;

		if (this.hiddenWindow && !this.hiddenWindow.isDestroyed()) {
			this.hiddenWindow.webContents.send(IpcChannels.CaptureControl, { type: "stop" });
			this.hiddenWindow.close();
		}

		this.hiddenWindow = null;
		this.clearBuffers();
		return this.getStatus();
	}

	getStatus(): CaptureStatus {
		return {
			...this.status,
			buffers: {
				camera: this.toBufferStats(this.buffers.camera?.getStats() ?? null, "frame"),
				screen: this.toBufferStats(this.buffers.screen?.getStats() ?? null, "frame"),
				audio: this.toBufferStats(this.buffers.audio?.getStats() ?? null, "audio"),
				audioClips: this.toBufferStats(this.buffers.audioClips?.getStats() ?? null, "clip"),
				cameraClips: this.toBufferStats(this.buffers.cameraClips?.getStats() ?? null, "clip"),
				screenClips: this.toBufferStats(this.buffers.screenClips?.getStats() ?? null, "clip"),
			},
		};
	}

	getStatusLite(): CaptureStatus {
		const status = this.getStatus();
		return {
			...status,
			camera: {
				...status.camera,
				lastPreviewDataUrl: null,
			},
			screen: {
				...status.screen,
				lastPreviewDataUrl: null,
			},
		};
	}

	handleFrame(payload: CaptureFramePayload): void {
		if (!this.status.running) {
			return;
		}

		const decoded = decodeDataUrl(payload.dataUrl);
		if (!decoded) {
			this.handleError({
				source: payload.kind === "camera" ? "camera" : "screen",
				message: "Failed to decode frame payload.",
				timestampMs: payload.timestampMs,
			});
			return;
		}

		const entry = {
			timestampMs: payload.timestampMs,
			data: decoded.data,
			width: payload.width,
			height: payload.height,
			mimeType: payload.mimeType,
		};

		if (payload.kind === "camera") {
			this.buffers.camera?.appendFrame(entry);
			this.status.camera.active = true;
			this.status.camera.lastFrameAt = toIso(payload.timestampMs);
			this.status.camera.lastPreviewDataUrl = payload.dataUrl;
		} else {
			this.buffers.screen?.appendFrame(entry);
			this.status.screen.active = true;
			this.status.screen.lastFrameAt = toIso(payload.timestampMs);
			this.status.screen.lastPreviewDataUrl = payload.dataUrl;
		}
	}

	handleAudioChunk(payload: {
		timestampMs: number;
		durationMs: number;
		mimeType: string;
		data: Uint8Array;
	}): void {
		if (!this.status.running) {
			return;
		}

		const buffer = Buffer.from(payload.data);
		this.buffers.audio?.appendChunk(buffer, payload.timestampMs);
		this.status.audio.active = true;
		this.status.audio.lastChunkAt = toIso(payload.timestampMs);
		this.lastAudioMimeType = this.normalizeAudioMimeType(payload.mimeType);
	}

	handleAudioLevel(payload: { timestampMs: number; level: number }): void {
		if (!this.status.running) {
			return;
		}

		this.status.audio.lastLevel = payload.level;
		this.status.audio.lastLevelAt = toIso(payload.timestampMs);
		this.status.audio.recentLevels = [...this.status.audio.recentLevels, payload.level].slice(-48);
	}

	handleClip(payload: CaptureClipPayload): void {
		if (!this.status.running) {
			return;
		}

		const buffer = Buffer.from(payload.data);
		const entry = {
			timestampMs: payload.timestampMs,
			durationMs: payload.durationMs,
			data: buffer,
			mimeType: payload.mimeType,
		};

		if (payload.kind === "camera") {
			this.buffers.cameraClips?.appendClip(entry);
			this.status.camera.lastClipAt = toIso(payload.timestampMs);
			this.status.camera.lastClipDurationMs = payload.durationMs;
			this.status.camera.lastClipMimeType = payload.mimeType;
		} else if (payload.kind === "screen") {
			this.buffers.screenClips?.appendClip(entry);
			this.status.screen.lastClipAt = toIso(payload.timestampMs);
			this.status.screen.lastClipDurationMs = payload.durationMs;
			this.status.screen.lastClipMimeType = payload.mimeType;
		} else {
			this.buffers.audioClips?.appendClip(entry);
		}
	}

	handleError(payload: CaptureErrorPayload): void {
		const timestamp = toIso(payload.timestampMs);

		if (payload.source === "camera") {
			this.status.camera.lastError = `${timestamp} ${payload.message}`;
		} else if (payload.source === "screen") {
			this.status.screen.lastError = `${timestamp} ${payload.message}`;
		} else if (payload.source === "audio") {
			this.status.audio.lastError = `${timestamp} ${payload.message}`;
		} else {
			this.status.camera.lastError ??= `${timestamp} ${payload.message}`;
			this.status.screen.lastError ??= `${timestamp} ${payload.message}`;
			this.status.audio.lastError ??= `${timestamp} ${payload.message}`;
		}
	}

	getRecentFrames(kind: "camera" | "screen", windowMs: number): CapturedFrame[] {
		const buffer = kind === "camera" ? this.buffers.camera : this.buffers.screen;
		const detail = kind === "camera" ? this.config?.camera.detail : this.config?.screen.detail;
		if (!buffer) {
			return [];
		}

			return buffer.getWindow(windowMs, this.clock()).map((frame) => ({
				id: createId("frame"),
				kind,
				capturedAt: toIso(frame.timestampMs),
				width: frame.width,
				height: frame.height,
				mimeType: frame.mimeType as "image/jpeg" | "image/png",
			dataUrl: encodeDataUrl(frame.mimeType, frame.data),
			detail: detail ?? "low",
		}));
	}

	getRecentAudio(windowMs: number): CapturedAudioChunk[] {
		const config = this.config;
		const window = this.buffers.audio?.getWindow(windowMs, this.clock());

		if (!window || !config) {
			return [];
		}

		const mimeType = (this.lastAudioMimeType ?? "audio/webm") as CapturedAudioChunk["mimeType"];

		return [
			{
				id: createId("audio"),
				capturedAt: toIso(window.timestampMs),
				durationMs: window.windowMs,
				sampleRate: config.audio.sampleRate,
				channels: config.audio.channels,
				mimeType,
				dataUrl: encodeDataUrl(mimeType, window.data),
			},
		];
	}

	getRecentClips(kind: "camera" | "screen", windowMs: number): CapturedVideoClip[] {
		const buffer = kind === "camera" ? this.buffers.cameraClips : this.buffers.screenClips;
		if (!buffer) {
			return [];
		}

		return buffer.getWindow(windowMs, this.clock()).map((clip) => ({
			id: createId("clip"),
			kind,
			capturedAt: toIso(clip.timestampMs),
			durationMs: clip.durationMs,
			mimeType: clip.mimeType,
			dataUrl: encodeDataUrl(clip.mimeType, clip.data),
		}));
	}

	getLatestClip(kind: CaptureClipKind): {
		timestampMs: number;
		durationMs: number;
		mimeType: string;
		data: Buffer;
	} | null {
		const buffer =
			kind === "camera"
				? this.buffers.cameraClips
				: kind === "screen"
					? this.buffers.screenClips
					: this.buffers.audioClips;
		const clip = buffer?.getLatest();

		if (!clip) {
			return null;
		}

		return {
			timestampMs: clip.timestampMs,
			durationMs: clip.durationMs,
			mimeType: clip.mimeType,
			data: Buffer.from(clip.data),
		};
	}

	private prepareBuffers(config: CaptureStartRequest): void {
		this.buffers = {
			camera: config.camera.enabled
				? new FrameBufferService({
						maxEntries: Math.max(config.camera.maxFrames, 1),
						maxDurationMs: this.estimateWindowMs(config.camera.fps, config.camera.maxFrames),
					})
				: null,
			screen: config.screen.enabled
				? new FrameBufferService({
						maxEntries: Math.max(config.screen.maxFrames, 1),
						maxDurationMs: this.estimateWindowMs(config.screen.fps, config.screen.maxFrames),
					})
				: null,
			audio: config.audio.enabled
				? new AudioBufferService({
						maxDurationMs: Math.ceil(config.audio.bufferDurationSeconds * 1000),
						sampleRateHz: config.audio.sampleRate,
						channels: config.audio.channels,
						bytesPerSample: 2,
					})
				: null,
			audioClips: config.audio.enabled
				? new VideoClipBufferService({
						maxEntries: Math.max(
							config.camera.enabled ? config.camera.maxClips : 0,
							config.screen.enabled ? config.screen.maxClips : 0,
							1,
						),
						maxDurationMs:
							Math.max(
								config.camera.enabled ? Math.ceil(config.camera.clipDurationSeconds * 1000) : 0,
								config.screen.enabled ? Math.ceil(config.screen.clipDurationSeconds * 1000) : 0,
								Math.ceil(config.audio.bufferDurationSeconds * 1000),
							) *
							Math.max(
								config.camera.enabled ? config.camera.maxClips : 0,
								config.screen.enabled ? config.screen.maxClips : 0,
								1,
							),
					})
				: null,
			cameraClips: config.camera.enabled
				? new VideoClipBufferService({
						maxEntries: Math.max(config.camera.maxClips, 1),
						maxDurationMs: Math.ceil(config.camera.clipDurationSeconds * 1000) *
							Math.max(config.camera.maxClips, 1),
					})
				: null,
			screenClips: config.screen.enabled
				? new VideoClipBufferService({
						maxEntries: Math.max(config.screen.maxClips, 1),
						maxDurationMs: Math.ceil(config.screen.clipDurationSeconds * 1000) *
							Math.max(config.screen.maxClips, 1),
					})
				: null,
		};
	}

	private estimateWindowMs(fps: number, maxFrames: number): number {
		const safeFps = fps > 0 ? fps : 0.5;
		const seconds = Math.max(maxFrames, 1) / safeFps;
		return Math.ceil(seconds * 1000);
	}

	private clearBuffers(): void {
		this.buffers.camera?.clear();
		this.buffers.screen?.clear();
		this.buffers.audio?.clear();
		this.buffers.audioClips?.clear();
		this.buffers.cameraClips?.clear();
		this.buffers.screenClips?.clear();
	}

	private toBufferStats(
		stats: {
			frameCount?: number;
			chunkCount?: number;
			clipCount?: number;
			totalBytes: number;
			oldestTimestampMs: number | null;
			newestTimestampMs: number | null;
		} | null,
		kind: "frame" | "audio" | "clip",
	): { entryCount: number; totalBytes: number; oldestTimestampMs: number | null; newestTimestampMs: number | null } | null {
		if (!stats) {
			return null;
		}

		const entryCount =
			kind === "frame"
				? stats.frameCount ?? 0
				: kind === "clip"
					? stats.clipCount ?? 0
					: stats.chunkCount ?? 0;

		return {
			entryCount,
			totalBytes: stats.totalBytes,
			oldestTimestampMs: stats.oldestTimestampMs,
			newestTimestampMs: stats.newestTimestampMs,
		};
	}

	private normalizeAudioMimeType(mimeType: string): CapturedAudioChunk["mimeType"] {
		const base = mimeType.split(";")[0]?.trim();

		if (base === "audio/wav" || base === "audio/mp3" || base === "audio/webm") {
			return base;
		}

		return "audio/webm";
	}
}
