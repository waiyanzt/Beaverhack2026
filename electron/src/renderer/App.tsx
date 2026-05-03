import React, { useState } from "react";
import { CapturePanel } from "./components/CapturePanel";
import { HotkeyMapper } from "./components/HotkeyMapper";

const tabs = ["Status", "Capture", "OBS", "VTube Studio", "Model", "Hotkey Mapper", "Settings", "Logs"] as const;

type AppTab = (typeof tabs)[number];

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTab>("Hotkey Mapper");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50">
      <div className="flex h-10 shrink-0 items-center gap-6 border-b border-slate-200 bg-white px-4">
        <div className="whitespace-nowrap text-sm font-bold text-slate-800">AuTuber</div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                activeTab === tab
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {activeTab === "Hotkey Mapper" ? (
          <HotkeyMapper />
        ) : activeTab === "Capture" ? (
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
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400">{activeTab} coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
