import type React from "react";
import { useEffect, useState } from "react";
import type { ModelMonitorStatus } from "../../shared/types/model-monitor.types";
import type { ServiceActivationStatus } from "../../shared/types/service-activation.types";
import { useCapture } from "../hooks/useCapture";
import { useVTS } from "../hooks/useVTS";

const emptyMonitorStatus: ModelMonitorStatus = {
  running: false,
  startedAt: null,
  tickIntervalMs: 500,
  windowMs: 2_000,
  inFlight: false,
  activeRequestCount: 0,
  maxInFlightRequests: 2,
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

const emptyServiceStatus: ServiceActivationStatus = {
  inFlight: false,
  retryScheduled: false,
  lastTrigger: null,
  obs: {
    ready: false,
    connected: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
  },
  vts: {
    ready: false,
    connected: false,
    authenticated: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
  },
};

export function StatusPanel(): React.JSX.Element {
  const { status, loading, error, refreshStatus } = useVTS();
  const { status: captureStatus, refreshStatus: refreshCaptureStatus } = useCapture();
  const [monitorStatus, setMonitorStatus] = useState<ModelMonitorStatus>(emptyMonitorStatus);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceActivationStatus>(emptyServiceStatus);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceBusy, setServiceBusy] = useState(false);

  const refreshMonitorStatus = async (): Promise<void> => {
    const result = await window.desktop.modelMonitorStatus();
    setMonitorStatus(result.status);
    setMonitorError(result.ok ? null : result.message);
  };

  const refreshServiceStatus = async (): Promise<void> => {
    const result = await window.desktop.servicesGetStatus();
    setServiceStatus(result.status);
    setServiceError(result.ok ? null : result.message);
  };

  useEffect(() => {
    void refreshMonitorStatus();
    void refreshServiceStatus();
  }, []);

  useEffect(() => {
    const intervalMs = monitorStatus.running ? 1000 : 2000;
    const timer = window.setInterval(() => {
      void refreshMonitorStatus();
      void refreshServiceStatus();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [monitorStatus.running]);

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([
      refreshStatus(),
      refreshCaptureStatus(),
      refreshMonitorStatus(),
      refreshServiceStatus(),
    ]);
  };

  const handleRetryServices = async (): Promise<void> => {
    setServiceBusy(true);

    try {
      const result = await window.desktop.servicesActivate();
      setServiceStatus(result.status);
      setServiceError(result.ok ? null : result.message);
      await refreshStatus();
    } finally {
      setServiceBusy(false);
    }
  };

  const totalBufferEntries =
    (captureStatus.buffers.camera?.entryCount ?? 0) +
    (captureStatus.buffers.screen?.entryCount ?? 0) +
    (captureStatus.buffers.audio?.entryCount ?? 0);

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Runtime</p>
          <h2 className="panel__title">Status</h2>
          <p className="panel__subtitle">Connection and agent health at a glance.</p>
        </div>
        <button className="ghost-button" onClick={() => void handleRefresh()} disabled={loading}>
          Refresh
        </button>
      </header>

      <div className="panel__actions" style={{ marginBottom: "1rem" }}>
        <button
          className="secondary-button"
          onClick={() => void handleRetryServices()}
          disabled={serviceBusy || serviceStatus.inFlight}
        >
          {serviceBusy || serviceStatus.inFlight ? "Activating Services..." : "Retry Service Activation"}
        </button>
        <p className="panel__hint" style={{ margin: 0 }}>
          {serviceStatus.retryScheduled
            ? "Auto-retry is scheduled for services that were unavailable at startup."
            : "Service activation is idle."}
        </p>
      </div>

      <div className="panel__status-grid">
        <div>
          <h4>App</h4>
          <p>Status: {monitorStatus.running ? "Automation active" : "Idle"}</p>
          <p>Started: {monitorStatus.startedAt ?? "-"}</p>
        </div>
        <div>
          <h4>OBS Connection</h4>
          <p>Connected: {serviceStatus.obs.connected ? "Yes" : "No"}</p>
          <p>Ready: {serviceStatus.obs.ready ? "Yes" : "No"}</p>
          <p>Last Attempt: {serviceStatus.obs.lastAttemptAt ?? "-"}</p>
          <p>Error: {serviceStatus.obs.lastError ?? "-"}</p>
        </div>
        <div>
          <h4>VTube Studio Connection</h4>
          <p>Connected: {loading ? "-" : status?.connected ? "Yes" : "No"}</p>
          <p>Authenticated: {loading ? "-" : status?.authenticated ? "Yes" : "No"}</p>
          <p>Hotkeys: {loading ? "-" : status?.hotkeyCount ?? 0}</p>
          <p>Model: {loading ? "-" : status?.modelName ?? "Unknown"}</p>
          <p>Activation Ready: {serviceStatus.vts.ready ? "Yes" : "No"}</p>
          {error || serviceStatus.vts.lastError ? (
            <p className="panel__error">{error ?? serviceStatus.vts.lastError}</p>
          ) : null}
        </div>
        <div>
          <h4>Capture</h4>
          <p>Running: {captureStatus.running ? "Yes" : "No"}</p>
          <p>Buffers: {totalBufferEntries}</p>
        </div>
        <div>
          <h4>AI Model</h4>
          <p>Loaded: {monitorStatus.lastResponseAt ? "Yes" : "No"}</p>
          <p>Ready: {monitorStatus.running && !monitorStatus.inFlight ? "Yes" : "No"}</p>
          <p>Last Response: {monitorStatus.lastResponseAt ?? "-"}</p>
          <p>Error: {monitorStatus.lastError ?? monitorError ?? "-"}</p>
        </div>
      </div>
      {serviceError ? <p className="panel__error">{serviceError}</p> : null}
    </section>
  );
}
