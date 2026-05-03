import type React from 'react';

export function ManualControlPanel(): React.JSX.Element {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Controls</p>
          <h2 className="panel__title">Manual Control</h2>
          <p className="panel__subtitle">Trigger automation actions directly.</p>
        </div>
      </header>

      <div className="panel__actions">
        <button className="secondary-button" disabled>
          Trigger Capture
        </button>
        <button className="secondary-button" disabled>
          Send to AI
        </button>
        <button className="secondary-button" disabled>
          Run Automation
        </button>
        <button className="secondary-button" disabled>
          Reset State
        </button>
      </div>

      <p className="panel__hint">Connect to a running session to enable controls.</p>
    </section>
  );
}
