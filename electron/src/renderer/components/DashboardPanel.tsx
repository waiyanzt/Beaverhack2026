import type * as React from "react";
import { useEffect, useState } from "react";
import type { CaptureMediaDeviceInfo, CaptureSourceInfo } from "../../shared/types/capture.types";

type ServiceStatus = "idle" | "running";

const DashboardPanel = (): React.JSX.Element => {
	const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("idle");
	const [isServiceBusy, setIsServiceBusy] = useState(false);

	const [sources, setSources] = useState<CaptureSourceInfo[]>([]);
	const [mediaDevices, setMediaDevices] = useState<CaptureMediaDeviceInfo[]>([]);
	const [isLoadingSources, setIsLoadingSources] = useState(true);

	const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");
	const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("");
	const [selectedScreenSourceId, setSelectedScreenSourceId] = useState<string>("");

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

	const handleRefresh = (): void => {
		void loadSources();
	};

	// placeholder: wire up real service start/stop logic here
	const handleToggleService = async (): Promise<void> => {
		setIsServiceBusy(true);
		if (serviceStatus === "idle") {
			// TODO: start service
			setServiceStatus("running");
		} else {
			// TODO: stop service
			setServiceStatus("idle");
		}
		setIsServiceBusy(false);
	};

	const audioDevices = mediaDevices.filter((d) => d.kind === "audioinput");
	const videoDevices = mediaDevices.filter((d) => d.kind === "videoinput");

	return (
		<section className="panel">
			<header className="panel__header">
				<div>
					<p className="panel__eyebrow">Dashboard</p>
					<h2 className="panel__title">Source Selection</h2>
					<p className="panel__subtitle">Choose audio, video, and screen capture sources.</p>
				</div>
				<div className="panel__status">
					<span className={`status-pill status-pill--${serviceStatus === "running" ? "live" : "idle"}`}>
						{serviceStatus === "running" ? "Running" : "Idle"}
					</span>
				</div>
			</header>

			<div className="panel__grid">
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
					className={serviceStatus === "running" ? "secondary-button" : "primary-button"}
					onClick={() => void handleToggleService()}
					disabled={isServiceBusy}
				>
					{isServiceBusy
						? serviceStatus === "idle"
							? "Starting..."
							: "Stopping..."
						: serviceStatus === "running"
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
		</section>
	);
};

export { DashboardPanel };
