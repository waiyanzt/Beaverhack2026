import { Buffer } from "node:buffer";

export type FrameBufferEntry = {
	timestampMs: number;
	data: Buffer;
	width: number;
	height: number;
	mimeType: string;
};

export type FrameBufferStats = {
	frameCount: number;
	totalBytes: number;
	oldestTimestampMs: number | null;
	newestTimestampMs: number | null;
};

export type FrameBufferOptions = {
	maxDurationMs: number;
	maxBytes: number;
	maxEntries: number;
};

const DEFAULT_FRAME_OPTIONS: FrameBufferOptions = {
	maxDurationMs: 10_000,
	maxBytes: 20 * 1024 * 1024,
	maxEntries: 120,
};

export class FrameBufferService {
	private readonly maxDurationMs: number;
	private readonly maxBytes: number;
	private readonly maxEntries: number;
	private frames: FrameBufferEntry[] = [];
	private totalBytes = 0;

	constructor(options: Partial<FrameBufferOptions> = {}) {
		const merged = { ...DEFAULT_FRAME_OPTIONS, ...options };

		if (merged.maxDurationMs <= 0 || merged.maxBytes <= 0 || merged.maxEntries <= 0) {
			throw new Error("FrameBufferService limits must be positive.");
		}

		this.maxDurationMs = merged.maxDurationMs;
		this.maxBytes = merged.maxBytes;
		this.maxEntries = merged.maxEntries;
	}

	appendFrame(entry: FrameBufferEntry): void {
		if (entry.data.length === 0) {
			return;
		}

		this.frames.push(entry);
		this.totalBytes += entry.data.length;
		this.trim(entry.timestampMs);
	}

	clear(): void {
		this.frames = [];
		this.totalBytes = 0;
	}

	getStats(): FrameBufferStats {
		return {
			frameCount: this.frames.length,
			totalBytes: this.totalBytes,
			oldestTimestampMs: this.frames[0]?.timestampMs ?? null,
			newestTimestampMs: this.frames.at(-1)?.timestampMs ?? null,
		};
	}

	getWindow(windowMs: number, nowMs: number = Date.now()): FrameBufferEntry[] {
		if (windowMs <= 0 || this.frames.length === 0) {
			return [];
		}

		const cutoff = nowMs - windowMs;
		return this.frames.filter((frame) => frame.timestampMs >= cutoff);
	}

	private trim(nowMs: number): void {
		const cutoff = nowMs - this.maxDurationMs;

		while (this.frames.length > 0 && this.frames[0].timestampMs < cutoff) {
			const removed = this.frames.shift();

			if (removed) {
				this.totalBytes -= removed.data.length;
			}
		}

		while (this.frames.length > this.maxEntries) {
			const removed = this.frames.shift();

			if (removed) {
				this.totalBytes -= removed.data.length;
			}
		}

		while (this.totalBytes > this.maxBytes && this.frames.length > 0) {
			const removed = this.frames.shift();

			if (removed) {
				this.totalBytes -= removed.data.length;
			}
		}
	}
}
