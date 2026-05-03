export type CapturedFrame = {
	id: string;
	kind: "camera" | "screen" | "window";
	capturedAt: string;
	width: number;
	height: number;
	mimeType: "image/jpeg" | "image/png";
	dataUrl: string;
	detail: "low" | "high";
};

export type CapturedAudioChunk = {
	id: string;
	capturedAt: string;
	durationMs: number;
	sampleRate: number;
	channels: number;
	mimeType: "audio/wav" | "audio/webm" | "audio/mp3";
	dataUrl?: string;
};

export type CapturedVideoClip = {
	id: string;
	kind: "camera" | "screen";
	capturedAt: string;
	durationMs: number;
	mimeType: string;
	dataUrl?: string;
};

export type TranscriptSegment = {
	id: string;
	startMs: number;
	endMs: number;
	text: string;
	confidence?: number;
};
