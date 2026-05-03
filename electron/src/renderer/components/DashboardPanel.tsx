import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  createIdleModelMonitorStatus,
  createModelMonitorCaptureConfig,
  MODEL_MONITOR_DEFAULT_TIMING,
} from "../../shared/model-monitor.defaults";
import type { AutomationDecisionRole } from "../../shared/types/action-plan.types";
import type { CaptureMediaDeviceInfo, CaptureSourceInfo } from "../../shared/types/capture.types";
import type { AfkOverlayConfig, DashboardConfig } from "../../shared/types/config.types";
import type { ModelMonitorEvent, ModelMonitorStatus, SecondaryModelMode } from "../../shared/types/model-monitor.types";
import type { ObsStatus } from "../../shared/types/obs.types";
import { useCapture } from "../hooks/useCapture";

const emptyMonitorStatus: ModelMonitorStatus = createIdleModelMonitorStatus();
const emptyAfkOverlayConfig: AfkOverlayConfig = {
  enabled: false,
  sceneName: null,
  sourceName: null,
  vacantEnterDelayMs: 5_000,
};

type MonitorLogEntry = {
  id: string;
  createdAt: string;
  text: string;
};

type ModelMonitorResponseEvent = Extract<ModelMonitorEvent, { type: "response" }>;
type ModelPreview = {
  response: MonitorLogEntry | null;
  mediaUrl: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const formatActionPlanForDisplay = (
  actionPlan: unknown,
  fallback: string,
  reviewedActions: ModelMonitorResponseEvent["reviewedActions"],
  actionResults: ModelMonitorResponseEvent["actionResults"],
): string => {
  const localOutcomes = formatLocalActionOutcomes(reviewedActions, actionResults);

  if (!isRecord(actionPlan)) {
    return [fallback || "Model returned no parsed ActionPlan.", localOutcomes].filter(Boolean).join("\n\n");
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
    localOutcomes,
  ].join("\n");
};

const formatLocalActionOutcomes = (
  reviewedActions: ModelMonitorResponseEvent["reviewedActions"],
  actionResults: ModelMonitorResponseEvent["actionResults"],
): string => {
  const reviewedSummary = reviewedActions?.map((reviewedAction, index) => {
    const type = reviewedAction.action.type;
    return `${index + 1}. ${type}:${reviewedAction.status} - ${reviewedAction.reason}`;
  }) ?? [];
  const resultSummary = actionResults?.map((result, index) => {
    const error = result.errorMessage ? ` (${result.errorMessage})` : "";
    return `${index + 1}. ${result.type}:${result.status} - ${result.reason}${error}`;
  }) ?? [];

  if (reviewedSummary.length === 0 && resultSummary.length === 0) {
    return "";
  }

  return [
    "Local Review:",
    reviewedSummary.length > 0 ? reviewedSummary.join("\n") : "No reviewed local actions.",
    "",
    "Execution Results:",
    resultSummary.length > 0 ? resultSummary.join("\n") : "No execution results.",
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
    `Pre-model latency: ${event.timing.conversionLatencyMs}ms`,
    `Provider request latency: ${event.timing.requestLatencyMs}ms`,
    `Clip end -> response: ${event.timing.endToResponseLatencyMs ?? "-"}ms`,
    "",
    "Request Debug:",
    `Request number: ${event.debug.requestNumber}`,
    `Pipeline latency: ${event.debug.pipelineLatencyMs ?? "-"}ms`,
    `Observation build: ${event.debug.observationLatencyMs ?? "-"}ms`,
    `Capture/mux input: ${event.debug.captureInputLatencyMs ?? "-"}ms`,
    `Prompt build: ${event.debug.promptBuildLatencyMs ?? "-"}ms`,
    `Provider request: ${event.debug.modelRequestLatencyMs ?? "-"}ms`,
    `Parse/validate/execute: ${event.debug.parseValidateExecuteLatencyMs ?? "-"}ms`,
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

const toSelectValue = (value: string | null): string => value ?? "";

const toStoredValue = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isImageDataUrl = (value: string): boolean => value.startsWith("data:image/");
const emptyPreview: ModelPreview = {
  response: null,
  mediaUrl: null,
};

const getAfkOverlayStatus = (
  config: AfkOverlayConfig,
  obsStatus: ObsStatus,
): { tone: "muted" | "ready" | "warning"; message: string } => {
  if (!obsStatus.connected) {
    return {
      tone: "warning",
      message: "AFK overlay is unavailable until OBS is connected.",
    };
  }

  if (!config.sceneName || !config.sourceName) {
    return {
      tone: "warning",
      message: "Select both an OBS scene and source for AFK overlay automation.",
    };
  }

  const scene = obsStatus.scenes.find((candidate) => candidate.name === config.sceneName);
  if (!scene) {
    return {
      tone: "warning",
      message: `Selected scene "${config.sceneName}" is not currently available in OBS.`,
    };
  }

  const source = scene.sources.find((candidate) => candidate.name === config.sourceName);
  if (!source) {
    return {
      tone: "warning",
      message: `Selected source "${config.sourceName}" is not currently available in "${config.sceneName}".`,
    };
  }

  if (!config.enabled) {
    return {
      tone: "muted",
      message: "AFK overlay target is valid, but automation is currently disabled.",
    };
  }

  if (source.visible) {
    return {
      tone: "muted",
      message: "AFK overlay source is already visible in OBS. The app will not emit another show action.",
    };
  }

  return {
    tone: "ready",
    message: `AFK overlay is armed for "${scene.name}" → "${source.name}" with a ${Math.round(config.vacantEnterDelayMs / 1000)}s delay.`,
  };
};

const DashboardPanel = (): React.JSX.Element => {
  const { status: captureStatus } = useCapture();
  const [monitorStatus, setMonitorStatus] = useState<ModelMonitorStatus>(emptyMonitorStatus);
  const [primaryPreview, setPrimaryPreview] = useState<ModelPreview>(emptyPreview);
  const [secondaryPreview, setSecondaryPreview] = useState<ModelPreview>(emptyPreview);
  const [isServiceBusy, setIsServiceBusy] = useState(false);

  const [sources, setSources] = useState<CaptureSourceInfo[]>([]);
  const [mediaDevices, setMediaDevices] = useState<CaptureMediaDeviceInfo[]>([]);
  const [obsStatus, setObsStatus] = useState<ObsStatus>({ connected: false });
  const [afkOverlayConfig, setAfkOverlayConfig] = useState<AfkOverlayConfig>(emptyAfkOverlayConfig);
  const [isLoadingSources, setIsLoadingSources] = useState(true);

  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("");
  const [selectedScreenSourceId, setSelectedScreenSourceId] = useState<string>("");
  const [secondaryModelMode, setSecondaryModelMode] = useState<SecondaryModelMode>("auto_unsupported");
  const [cameraPreviewError, setCameraPreviewError] = useState<string | null>(null);
  const [screenPreviewError, setScreenPreviewError] = useState<string | null>(null);
  const [audioPreviewError, setAudioPreviewError] = useState<string | null>(null);
  const [liveAudioLevel, setLiveAudioLevel] = useState<number | null>(null);
  const [liveAudioLevels, setLiveAudioLevels] = useState<number[]>([]);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);
  const latestDisplayedRequestNumberByRoleRef = useRef<Record<AutomationDecisionRole, number>>({
    primary_emote: 0,
    secondary_director: 0,
  });

  const persistDashboardConfig = async (config: DashboardConfig): Promise<void> => {
    await window.desktop.settingsUpdate({
      dashboard: config,
    });
  };

  const buildDashboardConfig = (overrides: Partial<DashboardConfig> = {}): DashboardConfig => ({
    selectedAudioDeviceId: toStoredValue(selectedAudioDeviceId),
    selectedVideoDeviceId: toStoredValue(selectedVideoDeviceId),
    selectedScreenSourceId: toStoredValue(selectedScreenSourceId),
    secondaryModelMode,
    ...overrides,
  });

  const persistAfkOverlayConfig = async (config: AfkOverlayConfig): Promise<void> => {
    setAfkOverlayConfig(config);
    await window.desktop.settingsUpdate({
      afkOverlay: config,
    });
  };

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

    const [settingsResult, sourcesResult, devicesResult, obsResult] = await Promise.all([
      window.desktop.settingsGet(),
      window.desktop.listCaptureSources(),
      window.desktop.listMediaDevices(),
      window.desktop.obsGetStatus(),
    ]);
    const storedDashboard = settingsResult.settings.dashboard;
    const storedAfkOverlay = settingsResult.settings.afkOverlay ?? emptyAfkOverlayConfig;
    let nextAudioDeviceId = toSelectValue(storedDashboard.selectedAudioDeviceId);
    let nextVideoDeviceId = toSelectValue(storedDashboard.selectedVideoDeviceId);
    let nextScreenSourceId = toSelectValue(storedDashboard.selectedScreenSourceId);
    const nextSecondaryModelMode = storedDashboard.secondaryModelMode;

    if (sourcesResult.ok) {
      setSources(sourcesResult.sources);
      const hasStoredScreenSource = sourcesResult.sources.some((source) => source.id === nextScreenSourceId);
      nextScreenSourceId = hasStoredScreenSource ? nextScreenSourceId : sourcesResult.sources[0]?.id ?? "";
      setSelectedScreenSourceId(nextScreenSourceId);
    } else {
      setSources([]);
      nextScreenSourceId = "";
    }

    if (devicesResult.ok) {
      setMediaDevices(devicesResult.devices);
      const audioDevices = devicesResult.devices.filter((device) => device.kind === "audioinput");
      const videoDevices = devicesResult.devices.filter((device) => device.kind === "videoinput");
      const hasStoredAudioDevice = audioDevices.some((device) => device.deviceId === nextAudioDeviceId);
      const hasStoredVideoDevice = videoDevices.some((device) => device.deviceId === nextVideoDeviceId);
      nextAudioDeviceId = hasStoredAudioDevice ? nextAudioDeviceId : audioDevices[0]?.deviceId ?? "";
      nextVideoDeviceId = hasStoredVideoDevice ? nextVideoDeviceId : videoDevices[0]?.deviceId ?? "";
      setSelectedAudioDeviceId(nextAudioDeviceId);
      setSelectedVideoDeviceId(nextVideoDeviceId);
    } else {
      setMediaDevices([]);
      nextAudioDeviceId = "";
      nextVideoDeviceId = "";
    }

    if (obsResult.ok && obsResult.status.connected) {
      const storedScene = storedAfkOverlay.sceneName;
      const selectedScene = obsResult.status.scenes.find((scene) => scene.name === storedScene) ?? null;
      const selectedSource = selectedScene?.sources.find((source) => source.name === storedAfkOverlay.sourceName) ?? null;
      const nextAfkOverlay = {
        ...storedAfkOverlay,
        enabled: storedAfkOverlay.enabled && selectedScene !== null && selectedSource !== null,
        sceneName: selectedScene?.name ?? storedAfkOverlay.sceneName,
        sourceName: selectedSource?.name ?? storedAfkOverlay.sourceName,
      };
      setObsStatus(obsResult.status);
      setAfkOverlayConfig(nextAfkOverlay);
      if (nextAfkOverlay.enabled !== storedAfkOverlay.enabled) {
        await persistAfkOverlayConfig(nextAfkOverlay);
      }
    } else {
      setObsStatus(obsResult.status);
      setAfkOverlayConfig(storedAfkOverlay);
    }

    setSecondaryModelMode(nextSecondaryModelMode);

    await persistDashboardConfig({
      selectedAudioDeviceId: toStoredValue(nextAudioDeviceId),
      selectedVideoDeviceId: toStoredValue(nextVideoDeviceId),
      selectedScreenSourceId: toStoredValue(nextScreenSourceId),
      secondaryModelMode: nextSecondaryModelMode,
    });
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
        const role = event.debug.decisionRole;
        if (event.debug.requestNumber < latestDisplayedRequestNumberByRoleRef.current[role]) {
          return;
        }
        latestDisplayedRequestNumberByRoleRef.current[role] = event.debug.requestNumber;
        const updatePreview = (previousPreview: ModelPreview): ModelPreview => ({
          response: logEntry ?? previousPreview.response,
          mediaUrl: event.modelMediaDataUrl ?? previousPreview.mediaUrl,
        });

        if (role === "secondary_director") {
          setSecondaryPreview(updatePreview);
        } else {
          setPrimaryPreview(updatePreview);
        }
      } else if (event.type === "error" && logEntry) {
        setSecondaryPreview((previousPreview) => ({
          ...previousPreview,
          response: logEntry,
        }));
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
      const body = formatActionPlanForDisplay(
        event.actionPlan,
        event.content,
        event.reviewedActions,
        event.actionResults,
      );
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
        tickIntervalMs: MODEL_MONITOR_DEFAULT_TIMING.tickIntervalMs,
        windowMs: MODEL_MONITOR_DEFAULT_TIMING.windowMs,
        secondaryMode: secondaryModelMode,
        capture: createModelMonitorCaptureConfig({
          audioDeviceId: selectedAudioDeviceId || null,
          screenSourceId: selectedScreenSourceId || null,
          videoDeviceId: selectedVideoDeviceId || null,
        }),
      });

      setMonitorStatus(result.status);
      if (!result.ok) {
        setSecondaryPreview((previousPreview) => ({
          ...previousPreview,
          response: {
            id: `start-error-${Date.now()}`,
            createdAt: new Date().toISOString(),
            text: result.message,
          },
        }));
      }
    } else {
      const result = await window.desktop.modelMonitorStop();
      setMonitorStatus(result.status);
      if (!result.ok) {
        setSecondaryPreview((previousPreview) => ({
          ...previousPreview,
          response: {
            id: `stop-error-${Date.now()}`,
            createdAt: new Date().toISOString(),
            text: result.message,
          },
        }));
      }
    }

    setIsServiceBusy(false);
  };

  const audioDevices = mediaDevices.filter((d) => d.kind === "audioinput");
  const videoDevices = mediaDevices.filter((d) => d.kind === "videoinput");
  const obsScenes = obsStatus.connected ? obsStatus.scenes : [];
  const selectedObsScene = obsScenes.find((scene) => scene.name === afkOverlayConfig.sceneName) ?? null;
  const selectedObsSources = selectedObsScene?.sources ?? [];
  const afkOverlayStatus = getAfkOverlayStatus(afkOverlayConfig, obsStatus);
  const audioLevels = liveAudioLevels.length > 0 ? liveAudioLevels : captureStatus.audio.recentLevels;
  const audioLevelPercent = Math.round((liveAudioLevel ?? captureStatus.audio.lastLevel ?? 0) * 100);
  const selectedAudioDeviceLabel =
    audioDevices.find((device) => device.deviceId === selectedAudioDeviceId)?.label || "Default microphone";
  const selectedVideoDeviceLabel =
    videoDevices.find((device) => device.deviceId === selectedVideoDeviceId)?.label || "Default camera";
  const selectedScreenSourceLabel =
    sources.find((source) => source.id === selectedScreenSourceId)?.name || "No screen source selected";
  const renderModelPreview = (
    title: string,
    preview: ModelPreview,
    emptyText: string,
    imageAlt: string,
  ): React.JSX.Element => (
    <div className="panel__card panel__card--wide">
      <h3>{title}</h3>
      <div className="preview preview--media">
        {preview.mediaUrl ? (
          isImageDataUrl(preview.mediaUrl) ? (
            <img src={preview.mediaUrl} alt={imageAlt} />
          ) : (
            <video key={preview.mediaUrl} src={preview.mediaUrl} controls muted playsInline />
          )
        ) : (
          <div className="preview__empty">{emptyText}</div>
        )}
      </div>
      <p className="meter__label">This media sample and text are from the same model response event.</p>
      <textarea
        className="response-log"
        readOnly
        value={preview.response?.text || "Waiting for the first paired model response."}
      />
    </div>
  );

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
              onChange={(event) => {
                const nextValue = event.target.value;
                setSelectedAudioDeviceId(nextValue);
                void persistDashboardConfig(buildDashboardConfig({ selectedAudioDeviceId: toStoredValue(nextValue) }));
              }}
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
              onChange={(event) => {
                const nextValue = event.target.value;
                setSelectedVideoDeviceId(nextValue);
                void persistDashboardConfig(buildDashboardConfig({ selectedVideoDeviceId: toStoredValue(nextValue) }));
              }}
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
              onChange={(event) => {
                const nextValue = event.target.value;
                setSelectedScreenSourceId(nextValue);
                void persistDashboardConfig(buildDashboardConfig({ selectedScreenSourceId: toStoredValue(nextValue) }));
              }}
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

        <div className="panel__card">
          <h3>AFK Overlay</h3>
          <label className="toggle">
            <input
              type="checkbox"
              checked={afkOverlayConfig.enabled}
              disabled={
                isLoadingSources ||
                (!afkOverlayConfig.enabled &&
                  (!obsStatus.connected || !afkOverlayConfig.sceneName || !afkOverlayConfig.sourceName))
              }
              onChange={(event) => {
                void persistAfkOverlayConfig({
                  ...afkOverlayConfig,
                  enabled: event.target.checked,
                });
              }}
            />
            <span>{afkOverlayConfig.enabled ? "Enabled" : "Disabled"}</span>
          </label>
          <div className="field">
            <span>OBS scene</span>
            <select
              value={afkOverlayConfig.sceneName ?? ""}
              disabled={isLoadingSources || !obsStatus.connected || obsScenes.length === 0}
              onChange={(event) => {
                const sceneName = toStoredValue(event.target.value);
                const nextScene = obsScenes.find((scene) => scene.name === sceneName) ?? null;
                const nextSourceName = nextScene?.sources[0]?.name ?? null;
                void persistAfkOverlayConfig({
                  ...afkOverlayConfig,
                  enabled: false,
                  sceneName,
                  sourceName: nextSourceName,
                });
              }}
            >
              <option value="">Select a scene</option>
              {obsScenes.map((scene) => (
                <option key={scene.name} value={scene.name}>
                  {scene.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>Overlay source</span>
            <select
              value={afkOverlayConfig.sourceName ?? ""}
              disabled={isLoadingSources || !selectedObsScene || selectedObsSources.length === 0}
              onChange={(event) => {
                void persistAfkOverlayConfig({
                  ...afkOverlayConfig,
                  enabled: false,
                  sourceName: toStoredValue(event.target.value),
                });
              }}
            >
              <option value="">Select a source</option>
              {selectedObsSources.map((source) => (
                <option key={source.name} value={source.name}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>AFK delay seconds</span>
            <input
              type="number"
              min={0}
              max={300}
              step={1}
              value={Math.round(afkOverlayConfig.vacantEnterDelayMs / 1000)}
              onChange={(event) => {
                const seconds = Number(event.target.value);
                const vacantEnterDelayMs = Number.isFinite(seconds)
                  ? Math.max(0, Math.min(Math.round(seconds * 1000), 300000))
                  : afkOverlayConfig.vacantEnterDelayMs;
                void persistAfkOverlayConfig({
                  ...afkOverlayConfig,
                  vacantEnterDelayMs,
                });
              }}
            />
          </div>
          <p className="meter__label">
            OBS: {obsStatus.connected ? "Connected" : "Disconnected"}
          </p>
          <p
            className={
              afkOverlayStatus.tone === "warning"
                ? "panel__error"
                : afkOverlayStatus.tone === "ready"
                  ? "panel__hint panel__hint--success"
                  : "panel__hint"
            }
          >
            {afkOverlayStatus.message}
          </p>
        </div>

        <div className="panel__card">
          <h3>Secondary Model</h3>
          <div className="field">
            <span>Routing</span>
            <select
              value={secondaryModelMode}
              disabled={isLoadingSources || monitorStatus.running}
              onChange={(event) => {
                const nextMode = event.target.value as SecondaryModelMode;
                setSecondaryModelMode(nextMode);
                void persistDashboardConfig(buildDashboardConfig({ secondaryModelMode: nextMode }));
              }}
            >
              <option value="auto_unsupported">Run primary + secondary</option>
              <option value="forced">Force secondary model</option>
              <option value="off">Primary model only</option>
            </select>
          </div>
          <p className="meter__label">Primary uses LM Studio frame analysis. Secondary uses remote video/audio analysis.</p>
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
          <p>Active Requests: {monitorStatus.activeRequestCount}/{monitorStatus.maxInFlightRequests}</p>
          <p>Ticks Sent: {monitorStatus.tickCount}</p>
          <p>Ticks Skipped: {monitorStatus.skippedTickCount}</p>
          <p>Secondary: {monitorStatus.secondaryMode}</p>
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

      {renderModelPreview(
        "Primary Model Request Pair",
        primaryPreview,
        "Waiting for the first primary frame sent to the model",
        "Latest frame sent to the primary model",
      )}

      {renderModelPreview(
        "Secondary Model Request Pair",
        secondaryPreview,
        "Waiting for the first secondary clip sent to the model",
        "Latest media sent to the secondary model",
      )}
    </section>
  );
};

export { DashboardPanel };
