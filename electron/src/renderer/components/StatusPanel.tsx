import type React from 'react';

export function StatusPanel(): React.JSX.Element {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Runtime</p>
          <h2 className="panel__title">Status</h2>
          <p className="panel__subtitle">Connection and agent health at a glance.</p>
        </div>
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
          <p>Connected: -</p>
          <p>Hotkeys: -</p>
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
