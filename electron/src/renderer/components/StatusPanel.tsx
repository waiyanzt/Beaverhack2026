import type React from "react";
import { useEffect, useState } from "react";
import type { ModelMonitorStatus } from "../../shared/types/model-monitor.types";
import { useCapture } from "../hooks/useCapture";
import { useVTS } from "../hooks/useVTS";

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

export function StatusPanel(): React.JSX.Element {
  const { status, loading, error, refreshStatus } = useVTS();
  const { status: captureStatus, refreshStatus: refreshCaptureStatus } = useCapture();
  const [monitorStatus, setMonitorStatus] = useState<ModelMonitorStatus>(emptyMonitorStatus);
  const [monitorError, setMonitorError] = useState<string | null>(null);

  const refreshMonitorStatus = async (): Promise<void> => {
    const result = await window.desktop.modelMonitorStatus();
    setMonitorStatus(result.status);
    setMonitorError(result.ok ? null : result.message);
  };

  useEffect(() => {
    void refreshMonitorStatus();
  }, []);

  useEffect(() => {
    const intervalMs = monitorStatus.running ? 1000 : 2000;
    const timer = window.setInterval(() => {
      void refreshMonitorStatus();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [monitorStatus.running]);

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([refreshStatus(), refreshCaptureStatus(), refreshMonitorStatus()]);
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

      <div className="panel__status-grid">
        <div>
          <h4>App</h4>
          <p>Status: {monitorStatus.running ? "Automation active" : "Idle"}</p>
          <p>Started: {monitorStatus.startedAt ?? "-"}</p>
        </div>
        <div>
          <h4>OBS Connection</h4>
          <p>Connected: -</p>
          <p>Version: -</p>
        </div>
        <div>
          <h4>VTube Studio Connection</h4>
          <p>Connected: {loading ? "-" : status?.connected ? "Yes" : "No"}</p>
          <p>Authenticated: {loading ? "-" : status?.authenticated ? "Yes" : "No"}</p>
          <p>Hotkeys: {loading ? "-" : status?.hotkeyCount ?? 0}</p>
          <p>Model: {loading ? "-" : status?.modelName ?? "Unknown"}</p>
          {error ? <p className="panel__error">{error}</p> : null}
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
    </section>
  );
}
