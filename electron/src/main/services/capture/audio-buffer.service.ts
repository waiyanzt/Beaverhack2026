import { Buffer } from "node:buffer";

export type AudioBufferChunk = {
	timestampMs: number;
	data: Buffer;
};

export type AudioBufferStats = {
	chunkCount: number;
	totalBytes: number;
	oldestTimestampMs: number | null;
	newestTimestampMs: number | null;
};

export type AudioBufferOptions = {
	maxDurationMs: number;
	sampleRateHz: number;
	channels: number;
	bytesPerSample: number;
	maxBytes?: number;
};

export type AudioWindow = {
	data: Buffer;
	sampleRateHz: number;
	channels: number;
	bytesPerSample: number;
	windowMs: number;
	timestampMs: number;
};

const DEFAULT_AUDIO_OPTIONS: AudioBufferOptions = {
	maxDurationMs: 10_000,
	sampleRateHz: 16_000,
	channels: 1,
	bytesPerSample: 2,
};

export class AudioBufferService {
	private readonly maxDurationMs: number;
	private readonly sampleRateHz: number;
	private readonly channels: number;
	private readonly bytesPerSample: number;
	private readonly maxBytes: number;
	private chunks: AudioBufferChunk[] = [];
	private totalBytes = 0;

	constructor(options: Partial<AudioBufferOptions> = {}) {
		const merged = { ...DEFAULT_AUDIO_OPTIONS, ...options };

		if (merged.maxDurationMs <= 0) {
			throw new Error("AudioBufferService maxDurationMs must be positive.");
		}

		if (merged.sampleRateHz <= 0 || merged.channels <= 0 || merged.bytesPerSample <= 0) {
			throw new Error("AudioBufferService audio format values must be positive.");
		}

		this.maxDurationMs = merged.maxDurationMs;
		this.sampleRateHz = merged.sampleRateHz;
		this.channels = merged.channels;
		this.bytesPerSample = merged.bytesPerSample;
		this.maxBytes =
			merged.maxBytes ??
			Math.ceil(
				(this.sampleRateHz * this.channels * this.bytesPerSample * this.maxDurationMs) /
					1000,
			);
	}

	appendChunk(data: Buffer, timestampMs: number = Date.now()): void {
		if (data.length === 0) {
			return;
		}

		this.chunks.push({ timestampMs, data });
		this.totalBytes += data.length;
		this.trim(timestampMs);
	}

	clear(): void {
		this.chunks = [];
		this.totalBytes = 0;
	}

	getStats(): AudioBufferStats {
		return {
			chunkCount: this.chunks.length,
			totalBytes: this.totalBytes,
			oldestTimestampMs: this.chunks[0]?.timestampMs ?? null,
			newestTimestampMs: this.chunks.at(-1)?.timestampMs ?? null,
		};
	}

	getWindow(windowMs: number, nowMs: number = Date.now()): AudioWindow | null {
		if (windowMs <= 0 || this.chunks.length === 0) {
			return null;
		}

		const cutoff = nowMs - windowMs;
		const chunks = this.chunks.filter((chunk) => chunk.timestampMs >= cutoff);

		if (chunks.length === 0) {
			return null;
		}

		const data = Buffer.concat(chunks.map((chunk) => chunk.data));

		return {
			data,
			sampleRateHz: this.sampleRateHz,
			channels: this.channels,
			bytesPerSample: this.bytesPerSample,
			windowMs,
			timestampMs: nowMs,
		};
	}

	getWindowBase64(windowMs: number, nowMs: number = Date.now()): string | null {
		const window = this.getWindow(windowMs, nowMs);

		if (!window) {
			return null;
		}

		return window.data.toString("base64");
	}

	private trim(nowMs: number): void {
		const cutoff = nowMs - this.maxDurationMs;

		while (this.chunks.length > 0 && this.chunks[0].timestampMs < cutoff) {
			const removed = this.chunks.shift();

			if (removed) {
				this.totalBytes -= removed.data.length;
			}
		}

		while (this.totalBytes > this.maxBytes && this.chunks.length > 0) {
			const removed = this.chunks.shift();

			if (removed) {
				this.totalBytes -= removed.data.length;
			}
		}
	}
}
