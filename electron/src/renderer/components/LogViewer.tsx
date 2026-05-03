import type React from 'react';

export function LogViewer(): React.JSX.Element {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Activity</p>
          <h2 className="panel__title">Log Viewer</h2>
          <p className="panel__subtitle">Recent events from capture, AI, and automation.</p>
        </div>
      </header>

      <div className="panel__card" style={{ minHeight: '300px', overflowY: 'auto' }}>
        <p className="panel__hint">No log entries yet.</p>
      </div>
    </section>
  );
}
