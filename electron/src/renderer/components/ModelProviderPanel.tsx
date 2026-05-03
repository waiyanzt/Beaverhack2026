import type React from 'react';

export function ModelProviderPanel(): React.JSX.Element {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">AI</p>
          <h2 className="panel__title">Model Provider</h2>
          <p className="panel__subtitle">Configure the AI model used for analysis.</p>
        </div>
      </header>

      <div className="panel__card">
        <div className="field">
          <span>Provider</span>
          <select>
            <option>OpenAI</option>
            <option>Anthropic</option>
            <option>Local</option>
          </select>
        </div>

        <div className="field">
          <span>Model</span>
          <input type="text" placeholder="e.g. gpt-4o" />
        </div>

        <div className="field">
          <span>API Key</span>
          <input type="password" placeholder="Enter your API key" />
        </div>

        <button className="primary-button" style={{ marginTop: '16px' }}>
          Save Settings
        </button>
      </div>
    </section>
  );
}
