import type React from 'react';

export function SettingsPanel(): React.JSX.Element {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Preferences</p>
          <h2 className="panel__title">Settings</h2>
          <p className="panel__subtitle">Application-level configuration.</p>
        </div>
      </header>

      <div className="panel__card">
        <label className="toggle">
          <input type="checkbox" defaultChecked={false} />
          <span>Start on launch</span>
        </label>

        <label className="toggle">
          <input type="checkbox" defaultChecked={false} />
          <span>Show notifications</span>
        </label>

        <label className="toggle">
          <input type="checkbox" defaultChecked={true} disabled />
          <span>Dark mode</span>
        </label>

        <p className="panel__hint" style={{ marginTop: '16px' }}>
          Changes apply after restart.
        </p>
      </div>
    </section>
  );
}
