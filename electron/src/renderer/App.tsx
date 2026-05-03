import React, { useState } from "react";
import { CapturePanel } from "./components/CapturePanel";
import { HotkeyMapper } from "./components/HotkeyMapper";
import { StatusPanel } from "./components/StatusPanel";
import { LogViewer } from "./components/LogViewer";
import { ManualControlPanel } from "./components/ManualControlPanel";
import { ModelProviderPanel } from "./components/ModelProviderPanel";
import { SettingsPanel } from "./components/SettingsPanel";

const tabs = ["Status", "Capture", "OBS", "VTube Studio", "Model", "Hotkey Mapper", "Settings", "Logs"] as const;

type AppTab = (typeof tabs)[number];

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTab>("Capture");

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav__brand">AuTuber</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`app-nav__tab ${activeTab === tab ? "app-nav__tab--active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>
      <div className="app-nav__content">
        {activeTab === "Status" && <StatusPanel />}
        {activeTab === "Capture" && (
          <div className="capture-dev-shell">
            <header className="capture-dev-header">
              <div>
                <p className="capture-dev-kicker">Dev Reference</p>
                <h1>Capture Console</h1>
              </div>
              <div className="capture-dev-badge">Hidden Capture</div>
            </header>
            <CapturePanel />
          </div>
        )}
        {activeTab === "OBS" && <ManualControlPanel />}
        {activeTab === "VTube Studio" && <HotkeyMapper />}
        {activeTab === "Model" && <ModelProviderPanel />}
        {activeTab === "Hotkey Mapper" && <p className="panel__hint">See VTube Studio tab.</p>}
        {activeTab === "Settings" && <SettingsPanel />}
        {activeTab === "Logs" && <LogViewer />}
      </div>
    </div>
  );
}

export default App;
