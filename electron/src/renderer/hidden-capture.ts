import type {
  CaptureAudioPayload,
  CaptureControlMessage,
  CaptureErrorPayload,
  CaptureFramePayload,
  CaptureStartRequest,
} from "../shared/types/capture.types";

const state: {
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  audioStream: MediaStream | null;
  cameraTimer: number | null;
  screenTimer: number | null;
  cameraRecorder: MediaRecorder | null;
  screenRecorder: MediaRecorder | null;
  audioRecorder: MediaRecorder | null;
  audioClipRecorder: MediaRecorder | null;
  audioMeterTimer: number | null;
  audioContext: AudioContext | null;
  audioAnalyser: AnalyserNode | null;
  cameraCancel: (() => void) | null;
  screenCancel: (() => void) | null;
  cameraClipCancel: (() => void) | null;
  screenClipCancel: (() => void) | null;
  audioClipCancel: (() => void) | null;
} = {
  cameraStream: null,
  screenStream: null,
  audioStream: null,
  cameraTimer: null,
  screenTimer: null,
  cameraRecorder: null,
  screenRecorder: null,
  audioRecorder: null,
  audioClipRecorder: null,
  audioMeterTimer: null,
  audioContext: null,
  audioAnalyser: null,
  cameraCancel: null,
  screenCancel: null,
  cameraClipCancel: null,
  screenClipCancel: null,
  audioClipCancel: null,
};

const captureBridge = window.captureBridge;

const parseResolution = (resolution: string): { width: number; height: number } => {
  const [widthText, heightText] = resolution.split("x");
  const width = Number(widthText);
  const height = Number(heightText);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid resolution: ${resolution}`);
  }

  return { width, height };
};

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

const emitError = (source: CaptureErrorPayload["source"], error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  captureBridge.sendError({
    source,
    message,
    timestampMs: Date.now(),
  });
};

const stopStream = (stream: MediaStream | null): void => {
  stream?.getTracks().forEach((track) => track.stop());
};

const stopTimer = (timerId: number | null): void => {
  if (timerId !== null) {
    window.clearInterval(timerId);
  }
};

const captureFrame = (
  kind: CaptureFramePayload["kind"],
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  jpegQuality: number,
  detail: CaptureFramePayload["detail"],
): void => {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const quality = Math.min(Math.max(jpegQuality / 100, 0.1), 1);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  captureBridge.sendFrame({
    kind,
    timestampMs: Date.now(),
    width: canvas.width,
    height: canvas.height,
    mimeType: "image/jpeg",
    dataUrl,
    detail,
  });
};

const startVideoSampler = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  kind: CaptureFramePayload["kind"],
  detail: CaptureFramePayload["detail"],
  fps: number,
  jpegQuality: number,
  onCancel: (cancel: () => void) => void,
): void => {
  const minInterval = fps > 0 ? 1000 / fps : 1000;
  let lastSentAt = 0;

  if (typeof video.requestVideoFrameCallback === "function") {
    const loop = (now: number) => {
      if (now - lastSentAt >= minInterval) {
        captureFrame(kind, video, canvas, jpegQuality, detail);
        lastSentAt = now;
      }

      const handle = video.requestVideoFrameCallback(loop);
      onCancel(() => video.cancelVideoFrameCallback(handle));
    };

    const handle = video.requestVideoFrameCallback(loop);
    onCancel(() => video.cancelVideoFrameCallback(handle));
    return;
  }

  const intervalMs = Math.max(minInterval, 50);
  const timer = window.setInterval(() => {
    captureFrame(kind, video, canvas, jpegQuality, detail);
  }, intervalMs);
  onCancel(() => stopTimer(timer));
};

const startSegmentedRecorder = (options: {
  stream: MediaStream;
  mimeType: string;
  segmentMs: number;
  setRecorder: (recorder: MediaRecorder | null) => void;
  onSegment: (payload: { blob: Blob; timestampMs: number; durationMs: number; mimeType: string }) => Promise<void>;
}): (() => void) => {
  let stopped = false;
  let currentRecorder: MediaRecorder | null = null;

  const startCycle = (): void => {
    if (stopped) {
      return;
    }

    const recorder = new MediaRecorder(
      options.stream,
      options.mimeType ? { mimeType: options.mimeType } : undefined,
    );
    currentRecorder = recorder;
    options.setRecorder(recorder);

    const chunks: Blob[] = [];
    const startedAt = Date.now();

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      void (async () => {
        if (chunks.length > 0) {
          const mimeType = chunks[0]?.type || recorder.mimeType || options.mimeType || "application/octet-stream";
          const blob = new Blob(chunks, { type: mimeType });
          await options.onSegment({
            blob,
            timestampMs: Date.now(),
            durationMs: Math.max(Date.now() - startedAt, options.segmentMs),
            mimeType,
          });
        }

        if (!stopped && options.stream.getTracks().every((track) => track.readyState === "live")) {
          startCycle();
          return;
        }

        options.setRecorder(null);
      })().catch((error: unknown) => {
        emitError("system", error);
      });
    });

    recorder.start();
    window.setTimeout(() => {
      if (!stopped && recorder.state !== "inactive") {
        recorder.stop();
      }
    }, Math.max(options.segmentMs, 1000));
  };

  startCycle();

  return () => {
    stopped = true;

    if (currentRecorder && currentRecorder.state !== "inactive") {
      currentRecorder.stop();
    } else {
      options.setRecorder(null);
    }
  };
};

const startCameraCapture = async (config: CaptureStartRequest["camera"]): Promise<void> => {
  if (!config.enabled || config.fps <= 0) {
    return;
  }

  try {
    const { width, height } = parseResolution(config.resolution);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: config.deviceId ? { exact: config.deviceId } : undefined,
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: config.fps },
      },
      audio: false,
    });

    state.cameraStream = stream;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    const canvas = document.createElement("canvas");
    const detail = config.detail ?? "low";
    startVideoSampler(video, canvas, "camera", detail, config.fps, config.jpegQuality, (cancel) => {
      state.cameraCancel = cancel;
    });

    const mimeType = chooseVideoMimeType();
    state.cameraClipCancel = startSegmentedRecorder({
      stream,
      mimeType,
      segmentMs: config.clipDurationSeconds * 1000,
      setRecorder: (recorder) => {
        state.cameraRecorder = recorder;
      },
      onSegment: async ({ blob, timestampMs, durationMs, mimeType: segmentMimeType }) => {
        const buffer = new Uint8Array(await blob.arrayBuffer());
        captureBridge.sendClip({
          kind: "camera",
          timestampMs,
          durationMs,
          mimeType: segmentMimeType || "video/webm",
          data: buffer,
        });
      },
    });
  } catch (error: unknown) {
    emitError("camera", error);
  }
};

const startScreenCapture = async (config: CaptureStartRequest["screen"]): Promise<void> => {
  if (!config.enabled || config.fps <= 0) {
    return;
  }

  try {
    if (!config.sourceId) {
      throw new Error("No screen source selected.");
    }

    const { width, height } = parseResolution(config.resolution);
    let stream: MediaStream;
    const isWindows = /Windows/i.test(navigator.userAgent);

    if (isWindows) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildDesktopVideoConstraints(config.sourceId, width, height, config.fps),
      });
    } else {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: false,
          video: {
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: config.fps },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: buildDesktopVideoConstraints(config.sourceId, width, height, config.fps),
        });
      }
    }

    state.screenStream = stream;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    const canvas = document.createElement("canvas");
    const detail = config.detail ?? "low";
    startVideoSampler(video, canvas, "screen", detail, config.fps, config.jpegQuality, (cancel) => {
      state.screenCancel = cancel;
    });

    const mimeType = chooseVideoMimeType();
    state.screenClipCancel = startSegmentedRecorder({
      stream,
      mimeType,
      segmentMs: config.clipDurationSeconds * 1000,
      setRecorder: (recorder) => {
        state.screenRecorder = recorder;
      },
      onSegment: async ({ blob, timestampMs, durationMs, mimeType: segmentMimeType }) => {
        const buffer = new Uint8Array(await blob.arrayBuffer());
        captureBridge.sendClip({
          kind: "screen",
          timestampMs,
          durationMs,
          mimeType: segmentMimeType || "video/webm",
          data: buffer,
        });
      },
    });
  } catch (error: unknown) {
    emitError("screen", error);
  }
};

const chooseAudioMimeType = (): string => {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "";
};

const chooseVideoMimeType = (): string => {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "";
};

const chooseAudioClipDurationSeconds = (config: CaptureStartRequest): number => {
  return Math.max(
    config.camera.enabled ? config.camera.clipDurationSeconds : 0,
    config.screen.enabled ? config.screen.clipDurationSeconds : 0,
    config.audio.bufferDurationSeconds,
    1,
  );
};

const startAudioCapture = async (config: CaptureStartRequest): Promise<void> => {
  if (!config.audio.enabled) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: config.audio.deviceId
        ? {
            deviceId: { exact: config.audio.deviceId },
          }
        : true,
      video: false,
    });

    state.audioStream = stream;

    const mimeType = chooseAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    state.audioRecorder = recorder;

    const audioContext = new AudioContext();
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    state.audioContext = audioContext;
    state.audioAnalyser = analyser;

    const samples = new Uint8Array(analyser.frequencyBinCount);
    state.audioMeterTimer = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;

      for (const value of samples) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }

      const rms = Math.sqrt(sum / samples.length);
      const level = Math.min(Math.max(rms, 0), 1);

      captureBridge.sendLevel({
        timestampMs: Date.now(),
        level,
      });
    }, 200);

    recorder.addEventListener("dataavailable", async (event) => {
      if (!event.data || event.data.size === 0) {
        return;
      }

      const buffer = new Uint8Array(await event.data.arrayBuffer());
      const payload: CaptureAudioPayload = {
        timestampMs: Date.now(),
        durationMs: 1000,
        mimeType: recorder.mimeType || "audio/webm",
        data: buffer,
      };

      captureBridge.sendAudio(payload);
    });

    state.audioClipCancel = startSegmentedRecorder({
      stream,
      mimeType,
      segmentMs: chooseAudioClipDurationSeconds(config) * 1000,
      setRecorder: (nextRecorder) => {
        state.audioClipRecorder = nextRecorder;
      },
      onSegment: async ({ blob, timestampMs, durationMs, mimeType: segmentMimeType }) => {
        const buffer = new Uint8Array(await blob.arrayBuffer());
        captureBridge.sendClip({
          kind: "audio",
          timestampMs,
          durationMs,
          mimeType: segmentMimeType || "audio/webm",
          data: buffer,
        });
      },
    });

    recorder.start(1000);
  } catch (error: unknown) {
    emitError("audio", error);
  }
};

const stopCapture = (): void => {
  stopTimer(state.cameraTimer);
  stopTimer(state.screenTimer);
  stopTimer(state.audioMeterTimer);

  state.cameraCancel?.();
  state.screenCancel?.();
  state.cameraClipCancel?.();
  state.screenClipCancel?.();
  state.audioClipCancel?.();

  if (state.cameraRecorder && state.cameraRecorder.state !== "inactive") {
    state.cameraRecorder.stop();
  }

  if (state.screenRecorder && state.screenRecorder.state !== "inactive") {
    state.screenRecorder.stop();
  }

  if (state.audioRecorder && state.audioRecorder.state !== "inactive") {
    state.audioRecorder.stop();
  }

  if (state.audioClipRecorder && state.audioClipRecorder.state !== "inactive") {
    state.audioClipRecorder.stop();
  }

  stopStream(state.cameraStream);
  stopStream(state.screenStream);
  stopStream(state.audioStream);

  state.audioAnalyser?.disconnect();
  state.audioContext?.close().catch(() => undefined);

  state.cameraStream = null;
  state.screenStream = null;
  state.audioStream = null;
  state.cameraTimer = null;
  state.screenTimer = null;
  state.cameraRecorder = null;
  state.screenRecorder = null;
  state.audioRecorder = null;
  state.audioClipRecorder = null;
  state.audioMeterTimer = null;
  state.audioContext = null;
  state.audioAnalyser = null;
  state.cameraCancel = null;
  state.screenCancel = null;
  state.cameraClipCancel = null;
  state.screenClipCancel = null;
  state.audioClipCancel = null;
};

const startCapture = async (config: CaptureStartRequest): Promise<void> => {
  stopCapture();
  await startAudioCapture(config);
  await Promise.all([startCameraCapture(config.camera), startScreenCapture(config.screen)]);
};

captureBridge.onControlMessage((message: CaptureControlMessage) => {
  if (message.type === "start") {
    void startCapture(message.config);
  } else {
    stopCapture();
  }
});
