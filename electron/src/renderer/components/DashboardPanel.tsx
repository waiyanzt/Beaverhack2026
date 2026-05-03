import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { CaptureMediaDeviceInfo, CaptureSourceInfo } from "../../shared/types/capture.types";
import type { ModelMonitorEvent, ModelMonitorStatus } from "../../shared/types/model-monitor.types";
import { useCapture } from "../hooks/useCapture";

const emptyMonitorStatus: ModelMonitorStatus = {
	running: false,
	startedAt: null,
	tickIntervalMs: 500,
	windowMs: 2_000,
	inFlight: false,
	tickCount: 0,
	skippedTickCount: 0,
	lastTickAt: null,
	lastResponseAt: null,
	lastMediaEndedAt: null,
	lastRequestStartedAt: null,
	lastEndToResponseLatencyMs: null,
	lastRequestLatencyMs: null,
	lastError: null,
};

type MonitorLogEntry = {
	id: string;
	createdAt: string;
	text: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const formatActionPlanForDisplay = (actionPlan: unknown, fallback: string): string => {
	if (!isRecord(actionPlan)) {
		return fallback || "Model returned no parsed ActionPlan.";
	}

	const actions = Array.isArray(actionPlan.actions) ? actionPlan.actions : [];
	const response = isRecord(actionPlan.response) ? actionPlan.response : null;
	const responseText = typeof response?.text === "string" && response.text.trim().length > 0
		? response.text.trim()
		: "No observation sentence returned.";
	const audioTranscript = typeof response?.audioTranscript === "string" && response.audioTranscript.trim().length > 0
		? response.audioTranscript.trim()
		: "No audio transcript returned.";
	const actionSummary = actions
		.map((action, index) => {
			if (!isRecord(action)) {
				return `${index + 1}. unknown action`;
			}

			const type = typeof action.type === "string" ? action.type : "unknown";
			const reason = typeof action.reason === "string" ? action.reason : "No reason provided.";
			return `${index + 1}. ${type}: ${reason}`;
		})
		.join("\n");

	return [
		"Tool call: create_action_plan",
		`Tick: ${typeof actionPlan.tickId === "string" ? actionPlan.tickId : "unknown"}`,
		`Created: ${typeof actionPlan.createdAt === "string" ? actionPlan.createdAt : "unknown"}`,
		`Audio Transcript: ${audioTranscript}`,
		`Observation: ${responseText}`,
		"Actions:",
		actionSummary || "No actions returned.",
		"",
		"Parsed ActionPlan:",
		JSON.stringify(actionPlan, null, 2),
	].join("\n");
};

const formatTimingForDisplay = (event: Extract<ModelMonitorEvent, { type: "response" }>): string =>
	[
		"Timing:",
		`Media window: ${event.timing.mediaStartedAt ?? "-"} -> ${event.timing.mediaEndedAt ?? "-"}`,
		`Window length: ${event.timing.mediaWindowMs ?? "-"}ms`,
		`Media age at request: ${event.timing.mediaAgeAtRequestMs ?? "-"}ms`,
		`Request started: ${event.timing.requestStartedAt}`,
		`Response received: ${event.timing.responseReceivedAt}`,
		`Convert/mux latency: ${event.timing.conversionLatencyMs}ms`,
		`Model request latency: ${event.timing.requestLatencyMs}ms`,
		`Clip end -> response: ${event.timing.endToResponseLatencyMs ?? "-"}ms`,
		"",
		"Request Debug:",
		`Request number: ${event.debug.requestNumber}`,
		`Prompt text bytes: ${event.debug.promptTextBytes}`,
		`Media data URL bytes: ${event.debug.mediaDataUrlBytes}`,
		`Request content bytes: ${event.debug.requestContentBytes}`,
		`Source clip count: ${event.debug.sourceClipCount}`,
		`Model media sha256: ${event.debug.modelMediaSha256 ?? "-"}`,
		`Source window key: ${event.debug.sourceWindowKey}`,
		`Prompt tokens: ${event.debug.promptTokens ?? "-"}`,
		`Completion tokens: ${event.debug.completionTokens ?? "-"}`,
		`Total tokens: ${event.debug.totalTokens ?? "-"}`,
	].join("\n");

const DashboardPanel = (): React.JSX.Element => {
	const { status: captureStatus } = useCapture();
	const [monitorStatus, setMonitorStatus] = useState<ModelMonitorStatus>(emptyMonitorStatus);
	const [latestModelResponse, setLatestModelResponse] = useState<MonitorLogEntry | null>(null);
	const [latestModelMediaUrl, setLatestModelMediaUrl] = useState<string | null>(null);
	const [isServiceBusy, setIsServiceBusy] = useState(false);

	const [sources, setSources] = useState<CaptureSourceInfo[]>([]);
	const [mediaDevices, setMediaDevices] = useState<CaptureMediaDeviceInfo[]>([]);
	const [isLoadingSources, setIsLoadingSources] = useState(true);

	const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");
	const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("");
	const [selectedScreenSourceId, setSelectedScreenSourceId] = useState<string>("");
	const [cameraPreviewError, setCameraPreviewError] = useState<string | null>(null);
	const [screenPreviewError, setScreenPreviewError] = useState<string | null>(null);
	const [audioPreviewError, setAudioPreviewError] = useState<string | null>(null);
	const [liveAudioLevel, setLiveAudioLevel] = useState<number | null>(null);
	const [liveAudioLevels, setLiveAudioLevels] = useState<number[]>([]);
	const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
	const screenPreviewRef = useRef<HTMLVideoElement | null>(null);

	const buildDesktopVideoConstraints = (sourceId: string): MediaTrackConstraints =>
		({
			mandatory: {
				chromeMediaSource: "desktop",
				chromeMediaSourceId: sourceId,
				minFrameRate: 1,
				maxFrameRate: 30,
			},
		}) as unknown as MediaTrackConstraints;

	const loadSources = async (): Promise<void> => {
		setIsLoadingSources(true);

		const [sourcesResult, devicesResult] = await Promise.all([
			window.desktop.listCaptureSources(),
			window.desktop.listMediaDevices(),
		]);

		if (sourcesResult.ok) {
			setSources(sourcesResult.sources);
			setSelectedScreenSourceId((prev) => prev || sourcesResult.sources[0]?.id || "");
		} else {
			setSources([]);
		}

		if (devicesResult.ok) {
			setMediaDevices(devicesResult.devices);
			setSelectedAudioDeviceId(
				(prev) =>
					prev ||
					devicesResult.devices.find((d) => d.kind === "audioinput")?.deviceId ||
					"",
			);
			setSelectedVideoDeviceId(
				(prev) =>
					prev ||
					devicesResult.devices.find((d) => d.kind === "videoinput")?.deviceId ||
					"",
			);
		} else {
			setMediaDevices([]);
		}

		setIsLoadingSources(false);
	};

	useEffect(() => {
		void loadSources();
	}, []);

	useEffect(() => {
		const removeListener = window.desktop.onModelMonitorEvent((event) => {
			setMonitorStatus(event.status);
			const logEntry = formatMonitorEvent(event);
			if (event.type === "response") {
				if (event.modelMediaDataUrl) {
					setLatestModelMediaUrl(event.modelMediaDataUrl);
				}
				if (logEntry) {
					setLatestModelResponse(logEntry);
				}
			} else if (event.type === "error" && logEntry) {
				setLatestModelResponse(logEntry);
			}
		});

		void window.desktop.modelMonitorStatus().then((result) => {
			setMonitorStatus(result.status);
		});

		return () => {
			removeListener();
		};
	}, []);

	useEffect(() => {
		let mounted = true;
		let stream: MediaStream | null = null;

		const startPreview = async (): Promise<void> => {
			if (!cameraPreviewRef.current) {
				return;
			}

			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true,
					audio: false,
				});

				if (!mounted || !cameraPreviewRef.current) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				cameraPreviewRef.current.srcObject = stream;
				await cameraPreviewRef.current.play();
				setCameraPreviewError(null);
			} catch (error: unknown) {
				setCameraPreviewError(error instanceof Error ? error.message : "Camera preview unavailable.");
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
	}, [selectedVideoDeviceId]);

	useEffect(() => {
		let mounted = true;
		let stream: MediaStream | null = null;

		const startPreview = async (): Promise<void> => {
			if (!selectedScreenSourceId || !screenPreviewRef.current) {
				return;
			}

			stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: buildDesktopVideoConstraints(selectedScreenSourceId),
			});

			if (!mounted || !screenPreviewRef.current) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}

			screenPreviewRef.current.srcObject = stream;
			await screenPreviewRef.current.play();
			setScreenPreviewError(null);
		};

		void startPreview().catch((error: unknown) => {
			setScreenPreviewError(error instanceof Error ? error.message : "Screen preview unavailable.");
		});

		return () => {
			mounted = false;
			if (screenPreviewRef.current) {
				screenPreviewRef.current.srcObject = null;
			}
			stream?.getTracks().forEach((track) => track.stop());
		};
	}, [selectedScreenSourceId]);

	useEffect(() => {
		let mounted = true;
		let stream: MediaStream | null = null;
		let audioContext: AudioContext | null = null;
		let animationFrameId: number | null = null;

		const startPreview = async (): Promise<void> => {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
				video: false,
			});

			if (!mounted) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}

			audioContext = new AudioContext();
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			audioContext.createMediaStreamSource(stream).connect(analyser);

			const samples = new Uint8Array(analyser.frequencyBinCount);
			const updateLevel = (): void => {
				analyser.getByteTimeDomainData(samples);
				let sum = 0;
				for (const sample of samples) {
					const normalized = (sample - 128) / 128;
					sum += normalized * normalized;
				}

				const nextLevel = Math.min(Math.sqrt(sum / samples.length) * 2, 1);
				setLiveAudioLevel(nextLevel);
				setLiveAudioLevels((previousLevels) => [...previousLevels.slice(-31), nextLevel]);
				animationFrameId = window.requestAnimationFrame(updateLevel);
			};

			setAudioPreviewError(null);
			updateLevel();
		};

		void startPreview().catch((error: unknown) => {
			setAudioPreviewError(error instanceof Error ? error.message : "Audio preview unavailable.");
			setLiveAudioLevel(null);
			setLiveAudioLevels([]);
		});

		return () => {
			mounted = false;
			if (animationFrameId !== null) {
				window.cancelAnimationFrame(animationFrameId);
			}
			stream?.getTracks().forEach((track) => track.stop());
			void audioContext?.close();
		};
	}, [selectedAudioDeviceId]);

	const handleRefresh = (): void => {
		void loadSources();
	};

	const formatMonitorEvent = (event: ModelMonitorEvent): MonitorLogEntry | null => {
		if (event.type === "response") {
			const body = formatActionPlanForDisplay(event.actionPlan, event.content);
			return {
				id: `${event.tickId}-${event.createdAt}`,
				createdAt: event.createdAt,
				text: `[${event.createdAt}] ${event.ok ? "OK" : "FAILED"} ${event.providerId} (${event.statusCode ?? "no status"})\n${formatTimingForDisplay(event)}\n\n${body}`,
			};
		}

		if (event.type === "error") {
			return {
				id: `${event.tickId}-${event.createdAt}`,
				createdAt: event.createdAt,
				text: `[${event.createdAt}] ERROR\n${event.message}`,
			};
		}

		return null;
	};

	const handleToggleService = async (): Promise<void> => {
		setIsServiceBusy(true);

		if (!monitorStatus.running) {
			const result = await window.desktop.modelMonitorStart({
				tickIntervalMs: 500,
				windowMs: 2_000,
				capture: {
					camera: {
						enabled: true,
						fps: 15,
						maxFrames: 8,
						resolution: "640x360",
						jpegQuality: 75,
						detail: "low",
						clipDurationSeconds: 2,
						maxClips: 12,
						deviceId: selectedVideoDeviceId || null,
					},
					screen: {
						enabled: false,
						fps: 0,
						maxFrames: 4,
						resolution: "640x360",
						jpegQuality: 70,
						detail: "low",
						clipDurationSeconds: 2,
						maxClips: 1,
						sourceId: null,
					},
					audio: {
						enabled: true,
						sampleRate: 16000,
						channels: 1,
						bufferDurationSeconds: 2,
						transcriptionEnabled: false,
						sendRawAudio: false,
						deviceId: selectedAudioDeviceId || null,
					},
				},
			});

			setMonitorStatus(result.status);
			if (!result.ok) {
				setLatestModelResponse({
					id: `start-error-${Date.now()}`,
					createdAt: new Date().toISOString(),
					text: result.message,
				});
			}
		} else {
			const result = await window.desktop.modelMonitorStop();
			setMonitorStatus(result.status);
			if (!result.ok) {
				setLatestModelResponse({
					id: `stop-error-${Date.now()}`,
					createdAt: new Date().toISOString(),
					text: result.message,
				});
			}
		}

		setIsServiceBusy(false);
	};

	const audioDevices = mediaDevices.filter((d) => d.kind === "audioinput");
	const videoDevices = mediaDevices.filter((d) => d.kind === "videoinput");
	const audioLevels = liveAudioLevels.length > 0 ? liveAudioLevels : captureStatus.audio.recentLevels;
	const audioLevelPercent = Math.round((liveAudioLevel ?? captureStatus.audio.lastLevel ?? 0) * 100);
	const selectedAudioDeviceLabel =
		audioDevices.find((device) => device.deviceId === selectedAudioDeviceId)?.label || "Default microphone";
	const selectedVideoDeviceLabel =
		videoDevices.find((device) => device.deviceId === selectedVideoDeviceId)?.label || "Default camera";
	const selectedScreenSourceLabel =
		sources.find((source) => source.id === selectedScreenSourceId)?.name || "No screen source selected";

	return (
		<section className="panel">
			<header className="panel__header">
				<div>
					<p className="panel__eyebrow">Dashboard</p>
					<h2 className="panel__title">Source Selection</h2>
					<p className="panel__subtitle">Choose audio, video, and screen capture sources.</p>
				</div>
				<div className="panel__status">
					<span className={`status-pill status-pill--${monitorStatus.running ? "live" : "idle"}`}>
						{monitorStatus.running ? "Running" : "Idle"}
					</span>
				</div>
			</header>

			<div className="panel__grid">
				<div className="panel__card">
					<h3>Camera Live</h3>
					<div className="preview preview--media">
						<video ref={cameraPreviewRef} autoPlay muted playsInline />
					</div>
					<p className="meter__label">Selected: {selectedVideoDeviceLabel}</p>
					<p className="meter__label">Last frame: {captureStatus.camera.lastFrameAt ?? "-"}</p>
					{cameraPreviewError ? <p className="panel__error">{cameraPreviewError}</p> : null}
				</div>

				<div className="panel__card">
					<h3>Screen Live</h3>
					<div className="preview preview--media">
						{selectedScreenSourceId ? (
							<video ref={screenPreviewRef} autoPlay muted playsInline />
						) : (
							<div className="preview__empty">Select a screen source</div>
						)}
					</div>
					<p className="meter__label">Selected: {selectedScreenSourceLabel}</p>
					<p className="meter__label">Last frame: {captureStatus.screen.lastFrameAt ?? "-"}</p>
					{screenPreviewError ? <p className="panel__error">{screenPreviewError}</p> : null}
				</div>

				<div className="panel__card">
					<h3>Audio Monitor</h3>
					<div className="meter">
						<div className="meter__bar" style={{ width: `${audioLevelPercent}%` }} />
					</div>
					<p className="meter__label">Level: {audioLevelPercent}%</p>
					<div className="waveform waveform--compact" aria-label="Audio waveform">
						{audioLevels.length > 0 ? (
							audioLevels.map((level, index) => (
								<span
									key={`dashboard-level-${index}`}
									className="waveform__bar"
									style={{ height: `${Math.max(level * 100, 4)}%` }}
								/>
							))
						) : (
							<div className="preview__empty">Waiting for audio levels</div>
						)}
					</div>
					<p className="meter__label">Selected: {selectedAudioDeviceLabel}</p>
					<p className="meter__label">Last chunk: {captureStatus.audio.lastChunkAt ?? "-"}</p>
					{audioPreviewError ? <p className="panel__error">{audioPreviewError}</p> : null}
				</div>

				<div className="panel__card">
					<h3>Audio Source</h3>
					<div className="field">
						<span>Microphone</span>
						<select
							value={selectedAudioDeviceId}
							disabled={isLoadingSources || audioDevices.length === 0}
							onChange={(event) => setSelectedAudioDeviceId(event.target.value)}
						>
							<option value="">Default microphone</option>
							{audioDevices.map((device) => (
								<option key={device.deviceId} value={device.deviceId}>
									{device.label}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="panel__card">
					<h3>Video Source</h3>
					<div className="field">
						<span>Camera</span>
						<select
							value={selectedVideoDeviceId}
							disabled={isLoadingSources || videoDevices.length === 0}
							onChange={(event) => setSelectedVideoDeviceId(event.target.value)}
						>
							<option value="">Default camera</option>
							{videoDevices.map((device) => (
								<option key={device.deviceId} value={device.deviceId}>
									{device.label}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="panel__card">
					<h3>Screen Capture</h3>
					<div className="field">
						<span>Source</span>
						<select
							value={selectedScreenSourceId}
							disabled={isLoadingSources || sources.length === 0}
							onChange={(event) => setSelectedScreenSourceId(event.target.value)}
						>
							<option value="">Select a source</option>
							{sources.map((source) => (
								<option key={source.id} value={source.id}>
									{source.name}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			<div className="panel__actions">
				<button
					className={monitorStatus.running ? "secondary-button" : "primary-button"}
					onClick={() => void handleToggleService()}
					disabled={isServiceBusy}
				>
					{isServiceBusy
						? !monitorStatus.running
							? "Starting..."
							: "Stopping..."
						: monitorStatus.running
							? "Stop Service"
							: "Start Service"}
				</button>
				<button
					className="ghost-button"
					onClick={handleRefresh}
					disabled={isLoadingSources}
					type="button"
				>
					{isLoadingSources ? "Refreshing..." : "Refresh Sources"}
				</button>
			</div>

			<div className="panel__status-grid">
				<div>
					<h4>Model Loop</h4>
					<p>In Flight: {monitorStatus.inFlight ? "Yes" : "No"}</p>
					<p>Ticks Sent: {monitorStatus.tickCount}</p>
					<p>Ticks Skipped: {monitorStatus.skippedTickCount}</p>
				</div>
				<div>
					<h4>Timing</h4>
					<p>Interval: {monitorStatus.tickIntervalMs}ms</p>
					<p>Window: {monitorStatus.windowMs}ms</p>
					<p>Last Tick: {monitorStatus.lastTickAt ?? "-"}</p>
					<p>Media End: {monitorStatus.lastMediaEndedAt ?? "-"}</p>
				</div>
				<div>
					<h4>Latest Response</h4>
					<p>Last Response: {monitorStatus.lastResponseAt ?? "-"}</p>
					<p>Model Latency: {monitorStatus.lastRequestLatencyMs ?? "-"}ms</p>
					<p>End To Response: {monitorStatus.lastEndToResponseLatencyMs ?? "-"}ms</p>
					<p>Error: {monitorStatus.lastError ?? "-"}</p>
				</div>
			</div>

			<div className="panel__card panel__card--wide">
				<h3>Latest Model Request Pair</h3>
				<div className="preview preview--media">
					{latestModelMediaUrl ? (
						<video key={latestModelMediaUrl} src={latestModelMediaUrl} controls muted playsInline />
					) : (
						<div className="preview__empty">Waiting for the first MP4 sent to the model</div>
					)}
				</div>
				<p className="meter__label">This video and text are from the same latest response event.</p>
				<textarea
					className="response-log"
					readOnly
					value={latestModelResponse?.text || "Waiting for the first paired model response."}
				/>
			</div>

		</section>
	);
};

export { DashboardPanel };
