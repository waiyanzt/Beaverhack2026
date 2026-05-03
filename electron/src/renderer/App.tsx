import React, { useState } from "react";
import { DashboardPanel } from "./components/DashboardPanel";
import { HotkeyMapper } from "./components/HotkeyMapper";

const tabs = ["Dashboard", "VTS Catalog"] as const;

type AppTab = (typeof tabs)[number];

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTab>("Dashboard");

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
        {activeTab === "Dashboard" && <DashboardPanel />}
        {activeTab === "VTS Catalog" && <HotkeyMapper />}
      </div>
    </div>
  );
}

export default App;
