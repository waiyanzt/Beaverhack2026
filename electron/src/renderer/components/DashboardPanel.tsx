import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createIdleModelMonitorStatus,
  createModelMonitorCaptureConfig,
  MODEL_MONITOR_DEFAULT_TIMING,
} from "../../shared/model-monitor.defaults";
import type { CaptureMediaDeviceInfo, CaptureSourceInfo } from "../../shared/types/capture.types";
import type { DashboardConfig } from "../../shared/types/config.types";
import type { ModelMonitorEvent, ModelMonitorStatus } from "../../shared/types/model-monitor.types";
import { useCapture } from "../hooks/useCapture";

const emptyMonitorStatus: ModelMonitorStatus = createIdleModelMonitorStatus();

type MonitorLogEntry = {
  id: string;
  createdAt: string;
  text: string;
};

type ActionDisplay = {
  type: string;
  reason: string;
  friendlyText: string;
};

type ActivitySummary = {
  observation: string;
  actions: ActionDisplay[];
  isError: boolean;
  errorMessage: string;
  wasNoop: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getFriendlyActionText = (action: Record<string, unknown>): string => {
  const type = typeof action.type === "string" ? action.type : "";
  const reason = typeof action.reason === "string" ? action.reason : "";

  if (type === "noop") return "";
  if (type === "vts.trigger_hotkey") {
    const cueLabels = Array.isArray(action.cueLabels)
      ? action.cueLabels.filter((l): l is string => typeof l === "string")
      : [];
    if (cueLabels.length > 0) return cueLabels.join(", ");
    const hotkeyId = typeof action.hotkeyId === "string" ? action.hotkeyId : "";
    return hotkeyId || reason;
  }
  if (type === "vts.set_parameter") {
    const paramId = typeof action.parameterId === "string" ? action.parameterId : "";
    const value = typeof action.value === "number" ? action.value : 0;
    return `${paramId} = ${value}`;
  }
  if (type === "obs.set_scene") {
    const scene = typeof action.sceneName === "string" ? action.sceneName : "";
    return scene || reason;
  }
  if (type === "obs.set_source_visibility") {
    const source = typeof action.sourceName === "string" ? action.sourceName : "";
    const visible = action.visible === true;
    return `${visible ? "Show" : "Hide"} ${source}`;
  }
  if (type === "overlay.message") {
    const msg = typeof action.message === "string" ? action.message : "";
    return msg || reason;
  }
  return reason || type;
};

const getFriendlyActionType = (type: string): string => {
  if (type === "noop") return "Wait";
  if (type === "vts.trigger_hotkey") return "Trigger emote";
  if (type === "vts.set_parameter") return "Set parameter";
  if (type === "obs.set_scene") return "Switch scene";
  if (type === "obs.set_source_visibility") return "Toggle source";
  if (type === "overlay.message") return "Show message";
  return type;
};

const parseValidationError = (content: string): string | null => {
  const prefix = "Action plan validation failed: ";
  if (!content.startsWith(prefix)) return null;

  try {
    const jsonPart = content.slice(prefix.length);
    const errors = JSON.parse(jsonPart);
    if (Array.isArray(errors) && errors.length > 0) {
      const messages = errors
        .map((e: Record<string, unknown>) => typeof e.message === "string" ? e.message : null)
        .filter((m): m is string => m !== null);
      if (messages.length > 0) return messages.join("; ");
    }
  } catch {
    return null;
  }
  return null;
};

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

const extractActivitySummary = (event: Extract<ModelMonitorEvent, { type: "response" }>): ActivitySummary => {
  if (!event.ok) {
    const contentText = typeof event.content === "string" ? event.content : "";
    const friendlyError = parseValidationError(contentText);
    const plan = isRecord(event.actionPlan) ? event.actionPlan : null;
    const response = plan && isRecord(plan.response) ? plan.response : null;
    const observation = typeof response?.text === "string" ? response.text.trim() : "";
    return {
      observation,
      actions: [],
      isError: true,
      errorMessage: friendlyError || "Action could not be completed",
      wasNoop: false,
    };
  }

  const plan = isRecord(event.actionPlan) ? event.actionPlan : null;
  const response = plan && isRecord(plan.response) ? plan.response : null;
  const observation = typeof response?.text === "string" && response.text.trim().length > 0
    ? response.text.trim()
    : "";
  const rawActions = Array.isArray(plan?.actions) ? plan.actions : [];
  const actions = rawActions
    .filter((a): a is Record<string, unknown> => isRecord(a))
    .map((a) => ({
      type: typeof a.type === "string" ? a.type : "unknown",
      reason: typeof a.reason === "string" ? a.reason : "",
      friendlyText: getFriendlyActionText(a),
    }));
  const isNoop = actions.length === 0 || (actions.length === 1 && actions[0].type === "noop");
  return { observation, actions, isError: false, errorMessage: "", wasNoop: isNoop };
};

const DashboardPanel = (): React.JSX.Element => {
  const { status: captureStatus } = useCapture();
  const [monitorStatus, setMonitorStatus] = useState<ModelMonitorStatus>(emptyMonitorStatus);
  const [latestModelResponse, setLatestModelResponse] = useState<MonitorLogEntry | null>(null);
  const [latestModelMediaUrl, setLatestModelMediaUrl] = useState<string | null>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [isServiceBusy, setIsServiceBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

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
  const cameraThumbRef = useRef<HTMLVideoElement | null>(null);
  const screenThumbRef = useRef<HTMLVideoElement | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const latestDisplayedRequestNumberRef = useRef(0);

  const setCameraPreviewRef = useCallback((el: HTMLVideoElement | null) => {
    cameraPreviewRef.current = el;
    if (el && cameraStreamRef.current) {
      el.srcObject = cameraStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const setScreenPreviewRef = useCallback((el: HTMLVideoElement | null) => {
    screenPreviewRef.current = el;
    if (el && screenStreamRef.current) {
      el.srcObject = screenStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const persistDashboardConfig = async (config: DashboardConfig): Promise<void> => {
    await window.desktop.settingsUpdate({
      dashboard: config,
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

    const [settingsResult, sourcesResult, devicesResult] = await Promise.all([
      window.desktop.settingsGet(),
      window.desktop.listCaptureSources(),
      window.desktop.listMediaDevices(),
    ]);
    const storedDashboard = settingsResult.settings.dashboard;
    let nextAudioDeviceId = toSelectValue(storedDashboard.selectedAudioDeviceId);
    let nextVideoDeviceId = toSelectValue(storedDashboard.selectedVideoDeviceId);
    let nextScreenSourceId = toSelectValue(storedDashboard.selectedScreenSourceId);

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

    await persistDashboardConfig({
      selectedAudioDeviceId: toStoredValue(nextAudioDeviceId),
      selectedVideoDeviceId: toStoredValue(nextVideoDeviceId),
      selectedScreenSourceId: toStoredValue(nextScreenSourceId),
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
        if (event.debug.requestNumber < latestDisplayedRequestNumberRef.current) {
          return;
        }
        latestDisplayedRequestNumberRef.current = event.debug.requestNumber;
        if (event.modelMediaDataUrl) {
          setLatestModelMediaUrl(event.modelMediaDataUrl);
        }
        if (logEntry) {
          setLatestModelResponse(logEntry);
        }
        setActivitySummary(extractActivitySummary(event));
      } else if (event.type === "error") {
        if (logEntry) {
          setLatestModelResponse(logEntry);
        }
        setActivitySummary({
          observation: "",
          actions: [],
          isError: true,
          errorMessage: event.message,
        });
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
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true,
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        if (cameraThumbRef.current) {
          cameraThumbRef.current.srcObject = stream;
          cameraThumbRef.current.play().catch(() => {});
        }
        if (cameraPreviewRef.current) {
          cameraPreviewRef.current.srcObject = stream;
          cameraPreviewRef.current.play().catch(() => {});
        }
        setCameraPreviewError(null);
      } catch (error: unknown) {
        setCameraPreviewError(error instanceof Error ? error.message : "Camera preview unavailable.");
      }
    };

    void startPreview();

    return () => {
      mounted = false;
      cameraStreamRef.current = null;
      if (cameraThumbRef.current) {
        cameraThumbRef.current.srcObject = null;
      }
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
      if (!selectedScreenSourceId) {
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: buildDesktopVideoConstraints(selectedScreenSourceId),
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        screenStreamRef.current = stream;
        if (screenThumbRef.current) {
          screenThumbRef.current.srcObject = stream;
          screenThumbRef.current.play().catch(() => {});
        }
        if (screenPreviewRef.current) {
          screenPreviewRef.current.srcObject = stream;
          screenPreviewRef.current.play().catch(() => {});
        }
        setScreenPreviewError(null);
      } catch (error: unknown) {
        setScreenPreviewError(error instanceof Error ? error.message : "Screen preview unavailable.");
      }
    };

    void startPreview();

    return () => {
      mounted = false;
      screenStreamRef.current = null;
      if (screenThumbRef.current) {
        screenThumbRef.current.srcObject = null;
      }
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
        tickIntervalMs: MODEL_MONITOR_DEFAULT_TIMING.tickIntervalMs,
        windowMs: MODEL_MONITOR_DEFAULT_TIMING.windowMs,
        capture: createModelMonitorCaptureConfig({
          audioDeviceId: selectedAudioDeviceId || null,
          screenSourceId: selectedScreenSourceId || null,
          videoDeviceId: selectedVideoDeviceId || null,
        }),
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

  const isAudioActive = Boolean(selectedAudioDeviceId) && monitorStatus.running && audioEnabled;
  const isVideoActive = Boolean(selectedVideoDeviceId) && monitorStatus.running && cameraEnabled;
  const isScreenActive = Boolean(selectedScreenSourceId) && monitorStatus.running && screenEnabled;

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Dashboard</p>
          <h2 className="panel__title">Sources</h2>
        </div>
        <div className="panel__status">
          <span className={`status-pill status-pill--${monitorStatus.running ? "live" : "idle"}`}>
            {monitorStatus.running ? "Running" : "Idle"}
          </span>
        </div>
      </header>

      <div className="source-row">
        <div className={`source-row__item${!cameraEnabled ? " source-row__item--disabled" : ""}`}>
          <span className="source-row__label">Camera</span>
          <select
            value={selectedVideoDeviceId}
            disabled={isLoadingSources || videoDevices.length === 0}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSelectedVideoDeviceId(nextValue);
              void persistDashboardConfig({
                selectedAudioDeviceId: toStoredValue(selectedAudioDeviceId),
                selectedVideoDeviceId: toStoredValue(nextValue),
                selectedScreenSourceId: toStoredValue(selectedScreenSourceId),
              });
            }}
          >
            <option value="">Default camera</option>
            {videoDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          {isVideoActive ? (
            <div className="source-row__thumb">
              <video ref={cameraThumbRef} autoPlay muted playsInline />
            </div>
          ) : null}
        </div>

        <div className={`source-row__item${!screenEnabled ? " source-row__item--disabled" : ""}`}>
          <span className="source-row__label">Screen</span>
          <select
            value={selectedScreenSourceId}
            disabled={isLoadingSources || sources.length === 0}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSelectedScreenSourceId(nextValue);
              void persistDashboardConfig({
                selectedAudioDeviceId: toStoredValue(selectedAudioDeviceId),
                selectedVideoDeviceId: toStoredValue(selectedVideoDeviceId),
                selectedScreenSourceId: toStoredValue(nextValue),
              });
            }}
          >
            <option value="">Select a source</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
          {isScreenActive ? (
            <div className="source-row__thumb">
              <video ref={screenThumbRef} autoPlay muted playsInline />
            </div>
          ) : null}
        </div>

        <div className={`source-row__item${!audioEnabled ? " source-row__item--disabled" : ""}`}>
          <span className="source-row__label">Microphone</span>
          <select
            value={selectedAudioDeviceId}
            disabled={isLoadingSources || audioDevices.length === 0}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSelectedAudioDeviceId(nextValue);
              void persistDashboardConfig({
                selectedAudioDeviceId: toStoredValue(nextValue),
                selectedVideoDeviceId: toStoredValue(selectedVideoDeviceId),
                selectedScreenSourceId: toStoredValue(selectedScreenSourceId),
              });
            }}
          >
            <option value="">Default microphone</option>
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          {isAudioActive ? (
            <div className="source-row__thumb source-row__thumb--audio">
              <div className="source-row__meter">
                <div className="source-row__meter-bar" style={{ width: `${audioLevelPercent}%` }} />
              </div>
              <span className="source-row__thumb-label">{audioLevelPercent}%</span>
            </div>
          ) : null}
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

      <div className="model-activity">
        <div className="model-activity__header">
          <h3>Model Activity</h3>
          <span className="model-activity__stats">
            {monitorStatus.tickCount} ticks · {monitorStatus.lastRequestLatencyMs ?? "-"}ms latency
          </span>
        </div>
        <div className="model-activity__body">
          <div className="model-activity__media">
            {latestModelMediaUrl ? (
              isImageDataUrl(latestModelMediaUrl) ? (
                <img src={latestModelMediaUrl} alt="Latest frame sent to the model" />
              ) : (
                <video key={latestModelMediaUrl} src={latestModelMediaUrl} controls muted playsInline />
              )
            ) : (
              <div className="preview__empty">Waiting for media</div>
            )}
          </div>
          <div className="model-activity__info">
            {activitySummary?.isError ? (
              <p className="model-activity__error">{activitySummary.errorMessage}</p>
            ) : activitySummary ? (
              <>
                {activitySummary.observation ? (
                  <p className="observation">{activitySummary.observation}</p>
                ) : null}
                {activitySummary.wasNoop ? (
                  <p className="model-activity__empty">Model is watching — no action needed at this moment.</p>
                ) : (
                  activitySummary.actions.map((action, i) => (
                    <p key={i} className="action">
                      <span style={{ fontWeight: 600 }}>{getFriendlyActionType(action.type)}</span>
                      {action.friendlyText ? `: ${action.friendlyText}` : ""}
                    </p>
                  ))
                )}
              </>
            ) : (
              <p className="model-activity__empty">Waiting for the first model response.</p>
            )}
          </div>
        </div>
        <div className="model-activity__debug">
          {latestModelResponse ? (
            <>
              <button
                className="ghost-button ghost-button--compact"
                onClick={() => setDebugOpen(!debugOpen)}
              >
                {debugOpen ? "Hide" : "Show"} Details
              </button>
              {debugOpen ? (
                <textarea
                  className="response-log"
                  readOnly
                  value={latestModelResponse.text}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="collapsible">
        <button
          className="collapsible__trigger"
          onClick={() => setAdvancedOpen(!advancedOpen)}
        >
          {advancedOpen ? "▼" : "▶"} Advanced
        </button>
        {advancedOpen ? (
          <div className="collapsible__content">
            <div className="panel__grid">
              <div className="panel__card">
                <div className="preview-toggle">
                  <h3 style={{ margin: 0 }}>Camera Live</h3>
                  <label>
                    <input type="checkbox" checked={cameraEnabled} onChange={() => setCameraEnabled(!cameraEnabled)} />
                    Enabled
                  </label>
                </div>
                <div className="preview preview--media">
                  <video ref={setCameraPreviewRef} autoPlay muted playsInline />
                </div>
                <p className="meter__label">Selected: {selectedVideoDeviceLabel}</p>
                <p className="meter__label">Last frame: {captureStatus.camera.lastFrameAt ?? "-"}</p>
                {cameraPreviewError ? <p className="panel__error">{cameraPreviewError}</p> : null}
              </div>

              <div className="panel__card">
                <div className="preview-toggle">
                  <h3 style={{ margin: 0 }}>Screen Live</h3>
                  <label>
                    <input type="checkbox" checked={screenEnabled} onChange={() => setScreenEnabled(!screenEnabled)} />
                    Enabled
                  </label>
                </div>
                <div className="preview preview--media">
                  {selectedScreenSourceId ? (
                    <video ref={setScreenPreviewRef} autoPlay muted playsInline />
                  ) : (
                    <div className="preview__empty">Select a screen source</div>
                  )}
                </div>
                <p className="meter__label">Selected: {selectedScreenSourceLabel}</p>
                <p className="meter__label">Last frame: {captureStatus.screen.lastFrameAt ?? "-"}</p>
                {screenPreviewError ? <p className="panel__error">{screenPreviewError}</p> : null}
              </div>

              <div className="panel__card">
                <div className="preview-toggle">
                  <h3 style={{ margin: 0 }}>Audio Monitor</h3>
                  <label>
                    <input type="checkbox" checked={audioEnabled} onChange={() => setAudioEnabled(!audioEnabled)} />
                    Enabled
                  </label>
                </div>
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
            </div>

            <div className="panel__status-grid">
              <div>
                <h4>Model Loop</h4>
                <p>In Flight: {monitorStatus.inFlight ? "Yes" : "No"}</p>
                <p>Active Requests: {monitorStatus.activeRequestCount}/{monitorStatus.maxInFlightRequests}</p>
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
          </div>
        ) : null}
      </div>
    </section>
  );
};

export { DashboardPanel };
