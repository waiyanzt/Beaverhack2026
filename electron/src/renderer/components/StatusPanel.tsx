import type React from "react";
import { useVTS } from "../hooks/useVTS";

export function StatusPanel(): React.JSX.Element {
  const { status, loading, error, refreshStatus } = useVTS();

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Runtime</p>
          <h2 className="panel__title">Status</h2>
          <p className="panel__subtitle">Connection and agent health at a glance.</p>
        </div>
        <button className="ghost-button" onClick={() => void refreshStatus()} disabled={loading}>
          Refresh
        </button>
      </header>

      <div className="panel__status-grid">
        <div>
          <h4>App</h4>
          <p>Status: -</p>
          <p>Uptime: -</p>
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
          <p>Running: -</p>
          <p>Buffers: -</p>
        </div>
        <div>
          <h4>AI Model</h4>
          <p>Loaded: -</p>
          <p>Ready: -</p>
        </div>
      </div>
    </section>
  );
}
