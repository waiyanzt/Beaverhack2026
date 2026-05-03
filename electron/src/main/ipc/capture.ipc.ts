import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, session } from "electron";
import ffmpegStatic from "ffmpeg-static";
import { IpcChannels } from "../../shared/channels";
import {
	captureAudioPayloadSchema,
	captureClipPayloadSchema,
	captureAudioLevelPayloadSchema,
	captureErrorPayloadSchema,
	captureExportClipRequestSchema,
	captureFramePayloadSchema,
	captureStartRequestSchema,
} from "../../shared/schemas/capture.schema";
import type {
	CaptureExportClipRequest,
	CaptureStartRequest,
} from "../../shared/types/capture.types";
import { CaptureOrchestratorService } from "../services/capture/capture-orchestrator.service";
import { createHiddenCaptureWindow } from "../windows/hidden-capture-window";

const captureOrchestrator = new CaptureOrchestratorService({
	createHiddenWindow: createHiddenCaptureWindow,
});
let selectedScreenSourceId: string | null = null;

const getClipExtension = (mimeType: string): string => {
	const baseMimeType = mimeType.split(";")[0]?.trim().toLowerCase();

	if (baseMimeType === "video/mp4") {
		return "mp4";
	}

	if (baseMimeType === "video/webm") {
		return "webm";
	}

	return "bin";
};

const runFfmpeg = async (args: string[]): Promise<void> => {
	if (!ffmpegStatic) {
		throw new Error("ffmpeg binary is unavailable.");
	}

	await new Promise<void>((resolve, reject) => {
		const ffmpegBinary = ffmpegStatic as string;
		const child: ChildProcessWithoutNullStreams = spawn(ffmpegBinary, args);
		let stderr = "";

		child.stdin.end();

		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on("error", reject);
		child.on("close", (code: number | null) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(stderr.trim() || `ffmpeg exited with code ${code ?? "unknown"}.`));
		});
	});
};

const exportMp4 = async (options: {
	videoClip?: { data: Buffer; mimeType: string };
	audioClip?: { data: Buffer; mimeType: string };
	outputPath: string;
}): Promise<void> => {
	const tempDir = await mkdtemp(join(tmpdir(), "autuber-capture-"));

	try {
		const args = ["-y"];

		if (options.videoClip) {
			const videoInputPath = join(tempDir, `input-video.${getClipExtension(options.videoClip.mimeType)}`);
			await writeFile(videoInputPath, options.videoClip.data);
			args.push("-i", videoInputPath);
		}

		if (options.audioClip) {
			const audioInputPath = join(tempDir, `input-audio.${getClipExtension(options.audioClip.mimeType)}`);
			await writeFile(audioInputPath, options.audioClip.data);
			args.push("-i", audioInputPath);
		}

		if (options.videoClip && options.audioClip) {
			args.push(
				"-map",
				"0:v:0",
				"-map",
				"1:a:0",
				"-c:v",
				"libx264",
				"-pix_fmt",
				"yuv420p",
				"-c:a",
				"aac",
				"-af",
				"aresample=async=1:first_pts=0",
				"-movflags",
				"+faststart",
				"-shortest",
				options.outputPath,
			);
		} else if (options.videoClip) {
			args.push(
				"-map",
				"0:v:0",
				"-c:v",
				"libx264",
				"-pix_fmt",
				"yuv420p",
				"-an",
				"-movflags",
				"+faststart",
				options.outputPath,
			);
		} else if (options.audioClip) {
			args.push(
				"-map",
				"0:a:0",
				"-vn",
				"-c:a",
				"aac",
				"-movflags",
				"+faststart",
				options.outputPath,
			);
		} else {
			throw new Error("No capture data is available to export.");
		}

		await runFfmpeg(args);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
};

export function registerCaptureIpcHandlers(): void {
	session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
		try {
			const sources = await desktopCapturer.getSources({ types: ["screen"] });
			const selectedSource =
				sources.find((source) => source.id === selectedScreenSourceId) ??
				sources[0];

			if (!selectedSource) {
				callback({});
				return;
			}

			callback({
				video: selectedSource,
			});
		} catch (error: unknown) {
			console.error("Failed to resolve display media source:", error);
			callback({});
		}
	});

	ipcMain.handle(IpcChannels.CaptureListSources, async () => {
		try {
			const sources = await desktopCapturer.getSources({
				types: ["screen"],
				thumbnailSize: {
					width: 320,
					height: 180,
				},
			});

			return {
				ok: true as const,
					sources: sources.map((source) => ({
						id: source.id,
						name: source.name,
						kind: "screen" as const,
						thumbnailDataUrl: source.thumbnail.isEmpty() ? undefined : source.thumbnail.toDataURL(),
					})),
			};
		} catch (error: unknown) {
			console.error("Failed to list capture sources:", error);
			return { ok: false as const, message: "Unable to list capture sources." };
		}
	});

	ipcMain.handle(IpcChannels.CaptureStart, async (_event, input: unknown) => {
		const parsed = captureStartRequestSchema.safeParse(input);

		if (!parsed.success) {
			return { ok: false as const, message: "Invalid capture configuration." };
		}

		try {
			const status = await captureOrchestrator.start(parsed.data as CaptureStartRequest);
			selectedScreenSourceId = parsed.data.screen.sourceId ?? null;
			return { ok: true as const, status };
		} catch (error: unknown) {
			console.error("Failed to start capture:", error);
			return { ok: false as const, message: "Unable to start capture." };
		}
	});

	ipcMain.handle(IpcChannels.CaptureStop, async () => {
		try {
			const status = await captureOrchestrator.stop();
			return { ok: true as const, status };
		} catch (error: unknown) {
			console.error("Failed to stop capture:", error);
			return { ok: false as const, message: "Unable to stop capture." };
		}
	});

	ipcMain.handle(IpcChannels.CaptureStatus, () => {
		try {
			return { ok: true as const, status: captureOrchestrator.getStatus() };
		} catch (error: unknown) {
			console.error("Failed to get capture status:", error);
			return { ok: false as const, message: "Unable to get status." };
		}
	});

	ipcMain.handle(IpcChannels.CaptureStatusLite, () => {
		try {
			return { ok: true as const, status: captureOrchestrator.getStatusLite() };
		} catch (error: unknown) {
			console.error("Failed to get lite capture status:", error);
			return { ok: false as const, message: "Unable to get status." };
		}
	});

	ipcMain.handle(IpcChannels.CaptureExportClip, async (event, input: unknown) => {
		const parsed = captureExportClipRequestSchema.safeParse(input);

		if (!parsed.success) {
			return { ok: false as const, message: "Invalid export request." };
		}

		try {
			const request = parsed.data as CaptureExportClipRequest;
			const clip = captureOrchestrator.getLatestClip(request.kind);

			if (!clip) {
				return { ok: false as const, message: `No ${request.kind} clip is buffered yet.` };
			}

			const extension = "mp4";
			const defaultPath = join(
				app.getPath("downloads"),
				`${request.kind}-capture-${clip.timestampMs}.${extension}`,
			);
			const ownerWindow = BrowserWindow.fromWebContents(event.sender);
			const result = ownerWindow
				? await dialog.showSaveDialog(ownerWindow, {
						defaultPath,
						filters: [
							{
								name: "MP4 Video",
								extensions: [extension],
							},
						],
					})
				: await dialog.showSaveDialog({
						defaultPath,
						filters: [
							{
								name: "MP4 Video",
								extensions: [extension],
							},
						],
					});

			if (result.canceled || !result.filePath) {
				return { ok: false as const, message: "Export canceled.", canceled: true as const };
			}

			if (request.kind === "audio") {
				await exportMp4({
					audioClip: clip,
					outputPath: result.filePath,
				});
			} else if (request.includeAudio) {
				const audioClip = captureOrchestrator.getLatestClip("audio");

				if (!audioClip) {
					return { ok: false as const, message: "No audio clip is buffered yet." };
				}

				await exportMp4({
					videoClip: clip,
					audioClip,
					outputPath: result.filePath,
				});
			} else {
				await exportMp4({
					videoClip: clip,
					outputPath: result.filePath,
				});
			}

			return {
				ok: true as const,
				path: result.filePath,
				mimeType: "video/mp4",
			};
		} catch (error: unknown) {
			console.error("Failed to export capture clip:", error instanceof Error ? error.message : error);
			return { ok: false as const, message: "Unable to export capture clip." };
		}
	});

	ipcMain.on(IpcChannels.CaptureFrame, (_event, payload: unknown) => {
		const parsed = captureFramePayloadSchema.safeParse(payload);

		if (!parsed.success) {
			console.error("Invalid capture frame payload:", parsed.error.flatten());
			return;
		}

		captureOrchestrator.handleFrame(parsed.data);
	});

	ipcMain.on(IpcChannels.CaptureAudio, (_event, payload: unknown) => {
		const parsed = captureAudioPayloadSchema.safeParse(payload);

		if (!parsed.success) {
			console.error("Invalid capture audio payload:", parsed.error.flatten());
			return;
		}

		captureOrchestrator.handleAudioChunk(parsed.data);
	});

	ipcMain.on(IpcChannels.CaptureClip, (_event, payload: unknown) => {
		const parsed = captureClipPayloadSchema.safeParse(payload);

		if (!parsed.success) {
			console.error("Invalid capture clip payload:", parsed.error.flatten());
			return;
		}

		captureOrchestrator.handleClip(parsed.data);
	});

	ipcMain.on(IpcChannels.CaptureLevel, (_event, payload: unknown) => {
		const parsed = captureAudioLevelPayloadSchema.safeParse(payload);

		if (!parsed.success) {
			console.error("Invalid capture level payload:", parsed.error.flatten());
			return;
		}

		captureOrchestrator.handleAudioLevel(parsed.data);
	});

	ipcMain.on(IpcChannels.CaptureError, (_event, payload: unknown) => {
		const parsed = captureErrorPayloadSchema.safeParse(payload);

		if (!parsed.success) {
			console.error("Invalid capture error payload:", parsed.error.flatten());
			return;
		}

		captureOrchestrator.handleError(parsed.data);
	});
}
