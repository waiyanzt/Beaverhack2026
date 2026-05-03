import { useCallback, useEffect, useState } from "react";
import type { CaptureStartRequest, CaptureStatus } from "../../shared/types/capture.types";

type CaptureControlResult = { ok: true; status: CaptureStatus } | { ok: false; message: string };

const emptyStatus: CaptureStatus = {
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

export const useCapture = () => {
	const [status, setStatus] = useState<CaptureStatus>(emptyStatus);
	const [isBusy, setIsBusy] = useState(false);
	const [lastError, setLastError] = useState<string | null>(null);

	const refreshStatus = useCallback(async () => {
		const result: CaptureControlResult = await window.desktop.captureStatus();

		if (result.ok) {
			setStatus(result.status);
			setLastError(null);
		} else {
			setLastError(result.message);
		}
	}, []);

	const startCapture = useCallback(async (config: CaptureStartRequest) => {
		setIsBusy(true);
		const result: CaptureControlResult = await window.desktop.captureStart(config);
		setIsBusy(false);

		if (result.ok) {
			setStatus(result.status);
			setLastError(null);
			return true;
		}

		setLastError(result.message);
		return false;
	}, []);

	const stopCapture = useCallback(async () => {
		setIsBusy(true);
		const result: CaptureControlResult = await window.desktop.captureStop();
		setIsBusy(false);

		if (result.ok) {
			setStatus(result.status);
			setLastError(null);
			return true;
		}

		setLastError(result.message);
		return false;
	}, []);

	useEffect(() => {
		void refreshStatus();
		const timer = window.setInterval(() => {
			void refreshStatus();
		}, 250);

		return () => {
			window.clearInterval(timer);
		};
	}, [refreshStatus]);

	return {
		status,
		isBusy,
		lastError,
		refreshStatus,
		startCapture,
		stopCapture,
	};
};
