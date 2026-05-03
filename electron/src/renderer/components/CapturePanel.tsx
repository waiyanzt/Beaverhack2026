import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
	CaptureMediaDeviceInfo,
	CaptureSourceInfo,
	CaptureStartRequest,
} from "../../shared/types/capture.types";
import { useCapture } from "../hooks/useCapture";

const defaultConfig: CaptureStartRequest = {
	camera: {
		enabled: true,
		fps: 30,
		maxFrames: 8,
		resolution: "1280x720",
		jpegQuality: 75,
		detail: "low",
		clipDurationSeconds: 10,
		maxClips: 3,
		deviceId: null,
	},
	screen: {
		enabled: false,
		fps: 30,
		maxFrames: 4,
		resolution: "1280x720",
		jpegQuality: 70,
		detail: "low",
		clipDurationSeconds: 10,
		maxClips: 3,
		sourceId: null,
	},
	audio: {
		enabled: true,
		sampleRate: 16000,
		channels: 1,
		bufferDurationSeconds: 30,
		transcriptionEnabled: true,
		sendRawAudio: false,
		deviceId: null,
	},
};

export const CapturePanel = (): React.JSX.Element => {
	const { status, isBusy, lastError, startCapture, stopCapture, refreshStatus } = useCapture();
	const [config, setConfig] = useState<CaptureStartRequest>(defaultConfig);
	const [sources, setSources] = useState<CaptureSourceInfo[]>([]);
	const [mediaDevices, setMediaDevices] = useState<CaptureMediaDeviceInfo[]>([]);
	const [isLoadingSources, setIsLoadingSources] = useState(true);
	const [sourceLoadError, setSourceLoadError] = useState<string | null>(null);
	const [deviceLoadError, setDeviceLoadError] = useState<string | null>(null);
	const [isExportingClip, setIsExportingClip] = useState(false);
	const [activeAction, setActiveAction] = useState<string | null>(null);
	const [exportMessage, setExportMessage] = useState<string | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
	const screenPreviewRef = useRef<HTMLVideoElement | null>(null);
	const audioLevelPercent = Math.round((status.audio.lastLevel ?? 0) * 100);

	const buildDesktopVideoConstraints = (
		sourceId: string,
		width: number,
		height: number,
		fps: number,
	): MediaTrackConstraints => {
		const normalizedFps = Math.max(Math.round(fps), 1);
		return {
			mandatory: {
				chromeMediaSource: "desktop",
				chromeMediaSourceId: sourceId,
				minWidth: width,
				maxWidth: width,
				minHeight: height,
				maxHeight: height,
				minFrameRate: normalizedFps,
				maxFrameRate: normalizedFps,
			},
		} as unknown as MediaTrackConstraints;
	};

	const parseResolution = (resolution: string): { width: number; height: number } => {
		const [widthText, heightText] = resolution.split("x");
		const width = Number(widthText);
		const height = Number(heightText);
		if (!Number.isFinite(width) || !Number.isFinite(height)) {
			return { width: 640, height: 360 };
		}

		return { width, height };
	};

	useEffect(() => {
		let isMounted = true;

		const loadSources = async (): Promise<void> => {
			setIsLoadingSources(true);
			const result = await window.desktop.listCaptureSources();
			const devicesResult = await window.desktop.listMediaDevices();

			if (!isMounted) {
				return;
			}

			if (result.ok) {
				setSources(result.sources);
				setSourceLoadError(null);
				setConfig((prev) => {
					if (prev.screen.sourceId || result.sources.length === 0) {
						return prev;
					}

					return {
						...prev,
						screen: {
							...prev.screen,
							sourceId: result.sources[0].id,
						},
					};
				});
			} else {
				setSources([]);
				setSourceLoadError(result.message);
			}

			if (devicesResult.ok) {
				setMediaDevices(devicesResult.devices);
				setDeviceLoadError(null);
				setConfig((prev) => ({
					...prev,
					camera: {
						...prev.camera,
						deviceId:
							prev.camera.deviceId ??
							devicesResult.devices.find((device) => device.kind === "videoinput")?.deviceId ??
							null,
					},
					audio: {
						...prev.audio,
						deviceId:
							prev.audio.deviceId ??
							devicesResult.devices.find((device) => device.kind === "audioinput")?.deviceId ??
							null,
					},
				}));
			} else {
				setMediaDevices([]);
				setDeviceLoadError(devicesResult.message);
			}

			setIsLoadingSources(false);
		};

		void loadSources();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		let mounted = true;
		let stream: MediaStream | null = null;

		const startPreview = async (): Promise<void> => {
			if (!config.camera.enabled || !cameraPreviewRef.current) {
				return;
			}

			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: config.camera.deviceId ? { deviceId: { exact: config.camera.deviceId } } : true,
					audio: false,
				});

				if (!mounted || !cameraPreviewRef.current) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				cameraPreviewRef.current.srcObject = stream;
				await cameraPreviewRef.current.play();
				setPreviewError(null);
			} catch (error: unknown) {
				setPreviewError(error instanceof Error ? error.message : "Camera preview unavailable.");
			}
		};

		void startPreview();

		return () => {
			mounted = false;
			if (cameraPreviewRef.current) {
				cameraPreviewRef.current.srcObject = null;
			}

			stream?.getTracks().forEach((track) => track.stop());
		};
	}, [config.camera.deviceId, config.camera.enabled]);

	useEffect(() => {
		let mounted = true;
		let stream: MediaStream | null = null;

		const startPreview = async (): Promise<void> => {
			if (!config.screen.enabled || !config.screen.sourceId || !screenPreviewRef.current) {
				return;
			}

			const { width, height } = parseResolution(config.screen.resolution);
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: buildDesktopVideoConstraints(
						config.screen.sourceId,
						width,
						height,
						config.screen.fps,
					),
				});
			} catch {
				stream = await navigator.mediaDevices.getDisplayMedia({
					audio: false,
					video: {
						width: { ideal: width },
						height: { ideal: height },
						frameRate: { ideal: config.screen.fps },
					},
				});
			}

			if (!mounted || !screenPreviewRef.current) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}

			screenPreviewRef.current.srcObject = stream;
			await screenPreviewRef.current.play();
			setPreviewError(null);
		};

		void startPreview().catch((error: unknown) => {
			setPreviewError(error instanceof Error ? error.message : "Screen preview unavailable.");
		});

		return () => {
			mounted = false;
			if (screenPreviewRef.current) {
				screenPreviewRef.current.srcObject = null;
			}

			stream?.getTracks().forEach((track) => track.stop());
		};
	}, [config.screen.enabled, config.screen.fps, config.screen.resolution, config.screen.sourceId]);

	const statusLabel = useMemo(() => {
		if (!status.running) {
			return "Idle";
		}

		return "Running";
	}, [status.running]);

	const handleStart = async () => {
		setActiveAction("Starting capture...");
		setExportMessage(null);
		await startCapture(config);
		setActiveAction(null);
	};

	const handleStop = async () => {
		setActiveAction("Stopping capture...");
		await stopCapture();
		setActiveAction(null);
	};

	const handleRefreshSources = async (): Promise<void> => {
		setActiveAction("Refreshing screens and devices...");
		setIsLoadingSources(true);
		const result = await window.desktop.listCaptureSources();
		const devicesResult = await window.desktop.listMediaDevices();

		if (result.ok) {
			setSources(result.sources);
			setSourceLoadError(null);
			setConfig((prev) => {
				const hasCurrentSource = result.sources.some((source) => source.id === prev.screen.sourceId);

				if (hasCurrentSource || result.sources.length === 0) {
					return prev;
				}

				return {
					...prev,
					screen: {
						...prev.screen,
						sourceId: result.sources[0].id,
					},
				};
			});
		} else {
			setSources([]);
			setSourceLoadError(result.message);
		}

		if (devicesResult.ok) {
			setMediaDevices(devicesResult.devices);
			setDeviceLoadError(null);
		} else {
			setMediaDevices([]);
			setDeviceLoadError(devicesResult.message);
		}

		setIsLoadingSources(false);
		setActiveAction(null);
	};

	const cameraDevices = mediaDevices.filter((device) => device.kind === "videoinput");
	const audioDevices = mediaDevices.filter((device) => device.kind === "audioinput");
	const captureActionLabel = isBusy && !status.running ? "Starting..." : "Start Capture";
	const stopActionLabel = isBusy && status.running ? "Stopping..." : "Stop Capture";
	const refreshActionLabel = isLoadingSources ? "Refreshing..." : "Refresh Sources";
	const actionStatusMessage =
		activeAction ??
		(isExportingClip ? "Exporting MP4..." : null) ??
		(isLoadingSources ? "Refreshing screens and devices..." : null);

	const handleExportClip = async (
		kind: "camera" | "screen" | "audio",
		includeAudio: boolean = false,
	): Promise<void> => {
		setActiveAction(
			kind === "audio"
				? "Opening save dialog for audio MP4..."
				: includeAudio
					? `Opening save dialog for ${kind} + audio MP4...`
					: `Opening save dialog for ${kind} MP4...`,
		);
		setExportMessage(null);
		setIsExportingClip(true);
		const result = await window.desktop.captureExportClip({ kind, includeAudio });
		setIsExportingClip(false);
		setActiveAction(null);

		if (result.ok) {
			setExportMessage(`Saved ${kind} clip to ${result.path}`);
			return;
		}

		if (result.canceled) {
			return;
		}

		setExportMessage(result.message);
	};

	return (
		<section className="panel">
			<header className="panel__header">
				<div>
					<p className="panel__eyebrow">Capture Control</p>
					<h2 className="panel__title">Hidden Capture Layer</h2>
					<p className="panel__subtitle">Stream-safe sampling for camera, screen, and audio.</p>
				</div>
				<div className="panel__status">
					<span className={`status-pill status-pill--${status.running ? "live" : "idle"}`}>
						{statusLabel}
					</span>
					<button className="primary-button" onClick={refreshStatus} disabled={isBusy || isExportingClip}>
						Refresh
					</button>
				</div>
			</header>

			<div className="panel__grid">
				<div className="panel__card">
					<h3>Camera</h3>
					<div className="preview">
						{config.camera.enabled ? (
							<video ref={cameraPreviewRef} autoPlay muted playsInline />
						) : (
							<div className="preview__empty">No frame yet</div>
						)}
					</div>
					<label className="toggle">
						<input
							type="checkbox"
							checked={config.camera.enabled}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									camera: { ...prev.camera, enabled: event.target.checked },
								}))
							}
						/>
						<span>Enabled</span>
					</label>
					<div className="field">
						<span>Resolution</span>
						<input
							value={config.camera.resolution}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									camera: { ...prev.camera, resolution: event.target.value },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Camera Input</span>
						<select
							value={config.camera.deviceId ?? ""}
							disabled={cameraDevices.length === 0}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									camera: {
										...prev.camera,
										deviceId: event.target.value || null,
									},
								}))
							}
						>
							<option value="">Default camera</option>
							{cameraDevices.map((device) => (
								<option key={device.deviceId} value={device.deviceId}>
									{device.label}
								</option>
							))}
						</select>
					</div>
					<div className="field">
						<span>FPS</span>
						<input
							type="number"
							min={0}
							step={0.1}
							value={config.camera.fps}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									camera: { ...prev.camera, fps: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Max Frames</span>
						<input
							type="number"
							min={0}
							value={config.camera.maxFrames}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									camera: { ...prev.camera, maxFrames: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>JPEG Quality</span>
						<input
							type="number"
							min={1}
							max={100}
							value={config.camera.jpegQuality}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									camera: { ...prev.camera, jpegQuality: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Clip Length (sec)</span>
						<input
							type="number"
							min={1}
							value={config.camera.clipDurationSeconds}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									camera: {
										...prev.camera,
										clipDurationSeconds: Number(event.target.value),
									},
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Max Clips</span>
						<input
							type="number"
							min={1}
							value={config.camera.maxClips}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									camera: { ...prev.camera, maxClips: Number(event.target.value) },
								}))
							}
						/>
					</div>
				</div>

				<div className="panel__card">
					<h3>Screen</h3>
					<div className="preview">
						{config.screen.enabled ? (
							<video ref={screenPreviewRef} autoPlay muted playsInline />
						) : (
							<div className="preview__empty">No frame yet</div>
						)}
					</div>
					<label className="toggle">
						<input
							type="checkbox"
							checked={config.screen.enabled}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									screen: { ...prev.screen, enabled: event.target.checked },
								}))
							}
						/>
						<span>Enabled</span>
					</label>
					<div className="field">
						<span>Resolution</span>
						<input
							value={config.screen.resolution}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									screen: { ...prev.screen, resolution: event.target.value },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Source</span>
						<div className="field__meta">
							<span>
								{isLoadingSources
									? "Loading sources..."
									: `${sources.length} source${sources.length === 1 ? "" : "s"} available`}
							</span>
							<button
								className="ghost-button ghost-button--compact"
								onClick={() => {
									void handleRefreshSources();
								}}
								disabled={isBusy || isLoadingSources || isExportingClip}
								type="button"
							>
								{refreshActionLabel}
							</button>
						</div>
						<select
							value={config.screen.sourceId ?? ""}
							disabled={isLoadingSources || sources.length === 0}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									screen: {
										...prev.screen,
										sourceId: event.target.value || null,
									},
								}))
							}
						>
							<option value="">Select a source</option>
							{sources.map((source) => (
								<option key={source.id} value={source.id}>
									{source.name}
								</option>
							))}
						</select>
						{sourceLoadError ? <p className="field__message">{sourceLoadError}</p> : null}
						{!isLoadingSources && sources.length === 0 && !sourceLoadError ? (
							<p className="field__message">No screen sources were returned.</p>
						) : null}
					</div>
					<div className="field">
						<span>FPS</span>
						<input
							type="number"
							min={0}
							step={0.1}
							value={config.screen.fps}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									screen: { ...prev.screen, fps: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Max Frames</span>
						<input
							type="number"
							min={0}
							value={config.screen.maxFrames}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									screen: { ...prev.screen, maxFrames: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>JPEG Quality</span>
						<input
							type="number"
							min={1}
							max={100}
							value={config.screen.jpegQuality}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									screen: { ...prev.screen, jpegQuality: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Clip Length (sec)</span>
						<input
							type="number"
							min={1}
							value={config.screen.clipDurationSeconds}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									screen: {
										...prev.screen,
										clipDurationSeconds: Number(event.target.value),
									},
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Max Clips</span>
						<input
							type="number"
							min={1}
							value={config.screen.maxClips}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									screen: { ...prev.screen, maxClips: Number(event.target.value) },
								}))
							}
						/>
					</div>
				</div>

				<div className="panel__card">
					<h3>Audio</h3>
					<div className="meter">
						<div className="meter__bar" style={{ width: `${audioLevelPercent}%` }} />
					</div>
					<p className="meter__label">Level: {audioLevelPercent}%</p>
					<div className="waveform">
						{status.audio.recentLevels.length > 0
							? status.audio.recentLevels.map((level, index) => (
									<span
										key={`level-${index}`}
										className="waveform__bar"
										style={{ height: `${Math.max(level * 100, 4)}%` }}
									/>
								))
							: null}
					</div>
					<label className="toggle">
						<input
							type="checkbox"
							checked={config.audio.enabled}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									audio: { ...prev.audio, enabled: event.target.checked },
								}))
							}
						/>
						<span>Enabled</span>
					</label>
					<div className="field">
						<span>Microphone Input</span>
						<select
							value={config.audio.deviceId ?? ""}
							disabled={audioDevices.length === 0}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									audio: {
										...prev.audio,
										deviceId: event.target.value || null,
									},
								}))
							}
						>
							<option value="">Default microphone</option>
							{audioDevices.map((device) => (
								<option key={device.deviceId} value={device.deviceId}>
									{device.label}
								</option>
							))}
						</select>
						{deviceLoadError ? <p className="field__message">{deviceLoadError}</p> : null}
					</div>
					<div className="field">
						<span>Sample Rate</span>
						<input
							type="number"
							min={8000}
							value={config.audio.sampleRate}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									audio: { ...prev.audio, sampleRate: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Channels</span>
						<input
							type="number"
							min={1}
							max={2}
							value={config.audio.channels}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									audio: { ...prev.audio, channels: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<div className="field">
						<span>Buffer (sec)</span>
						<input
							type="number"
							min={1}
							value={config.audio.bufferDurationSeconds}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									audio: { ...prev.audio, bufferDurationSeconds: Number(event.target.value) },
								}))
							}
						/>
					</div>
					<label className="toggle">
						<input
							type="checkbox"
							checked={config.audio.transcriptionEnabled}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									audio: { ...prev.audio, transcriptionEnabled: event.target.checked },
								}))
							}
						/>
						<span>Transcription</span>
					</label>
					<label className="toggle">
						<input
							type="checkbox"
							checked={config.audio.sendRawAudio}
							onChange={(event) =>
								setConfig((prev) => ({
									...prev,
									audio: { ...prev.audio, sendRawAudio: event.target.checked },
								}))
							}
						/>
						<span>Send Raw Audio</span>
					</label>
				</div>
			</div>

			<div className="panel__actions">
				<button className="primary-button" onClick={handleStart} disabled={isBusy || isExportingClip}>
					{captureActionLabel}
				</button>
				<button className="secondary-button" onClick={handleStop} disabled={isBusy || isExportingClip}>
					{stopActionLabel}
				</button>
				<button
					className="secondary-button"
					onClick={() => {
						void handleExportClip("camera");
					}}
					disabled={isBusy || isExportingClip || (status.buffers.cameraClips?.entryCount ?? 0) === 0}
				>
					{isExportingClip && activeAction?.includes("camera MP4") ? "Working..." : "Save Camera MP4"}
				</button>
				<button
					className="secondary-button"
					onClick={() => {
						void handleExportClip("screen");
					}}
					disabled={isBusy || isExportingClip || (status.buffers.screenClips?.entryCount ?? 0) === 0}
				>
					{isExportingClip && activeAction?.includes("screen MP4") ? "Working..." : "Save Screen MP4"}
				</button>
				<button
					className="secondary-button"
					onClick={() => {
						void handleExportClip("audio");
					}}
					disabled={isBusy || isExportingClip || (status.buffers.audioClips?.entryCount ?? 0) === 0}
				>
					{isExportingClip && activeAction?.includes("audio MP4") ? "Working..." : "Save Audio MP4"}
				</button>
				<button
					className="secondary-button"
					onClick={() => {
						void handleExportClip("camera", true);
					}}
					disabled={
						isBusy ||
						isExportingClip ||
						(status.buffers.cameraClips?.entryCount ?? 0) === 0 ||
						(status.buffers.audioClips?.entryCount ?? 0) === 0
					}
				>
					{isExportingClip && activeAction?.includes("camera + audio MP4") ? "Working..." : "Save Camera + Audio MP4"}
				</button>
				<button
					className="secondary-button"
					onClick={() => {
						void handleExportClip("screen", true);
					}}
					disabled={
						isBusy ||
						isExportingClip ||
						(status.buffers.screenClips?.entryCount ?? 0) === 0 ||
						(status.buffers.audioClips?.entryCount ?? 0) === 0
					}
				>
					{isExportingClip && activeAction?.includes("screen + audio MP4") ? "Working..." : "Save Screen + Audio MP4"}
				</button>
				<p className="panel__hint">Restart capture to apply config changes.</p>
			</div>

			{actionStatusMessage ? <p className="panel__status-message">{actionStatusMessage}</p> : null}

			<div className="panel__status-grid">
				<div>
					<h4>Camera</h4>
					<p>Active: {status.camera.active ? "Yes" : "No"}</p>
					<p>Last Frame: {status.camera.lastFrameAt ?? "-"}</p>
					<p>Last Clip: {status.camera.lastClipAt ?? "-"}</p>
					<p>Clip Format: {status.camera.lastClipMimeType ?? "-"}</p>
					<p>Frames Buffered: {status.buffers.camera?.entryCount ?? 0}</p>
					<p>Bytes Buffered: {status.buffers.camera?.totalBytes ?? 0}</p>
					<p>Clips Buffered: {status.buffers.cameraClips?.entryCount ?? 0}</p>
					<p>Error: {status.camera.lastError ?? "-"}</p>
				</div>
				<div>
					<h4>Screen</h4>
					<p>Active: {status.screen.active ? "Yes" : "No"}</p>
					<p>Last Frame: {status.screen.lastFrameAt ?? "-"}</p>
					<p>Last Clip: {status.screen.lastClipAt ?? "-"}</p>
					<p>Clip Format: {status.screen.lastClipMimeType ?? "-"}</p>
					<p>Frames Buffered: {status.buffers.screen?.entryCount ?? 0}</p>
					<p>Bytes Buffered: {status.buffers.screen?.totalBytes ?? 0}</p>
					<p>Clips Buffered: {status.buffers.screenClips?.entryCount ?? 0}</p>
					<p>Error: {status.screen.lastError ?? "-"}</p>
				</div>
				<div>
					<h4>Audio</h4>
					<p>Active: {status.audio.active ? "Yes" : "No"}</p>
					<p>Last Chunk: {status.audio.lastChunkAt ?? "-"}</p>
					<p>Chunks Buffered: {status.buffers.audio?.entryCount ?? 0}</p>
					<p>Audio Clips Buffered: {status.buffers.audioClips?.entryCount ?? 0}</p>
					<p>Bytes Buffered: {status.buffers.audio?.totalBytes ?? 0}</p>
					<p>Error: {status.audio.lastError ?? "-"}</p>
				</div>
			</div>

			{exportMessage ? <p className="panel__hint">{exportMessage}</p> : null}
			{previewError ? <p className="panel__error">{previewError}</p> : null}
			{lastError ? <p className="panel__error">{lastError}</p> : null}
		</section>
	);
};
