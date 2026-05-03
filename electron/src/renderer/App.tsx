import React, { useState } from 'react';
import { HotkeyMapper } from './components/HotkeyMapper';

const tabs = ['Status', 'Capture', 'OBS', 'VTube Studio', 'Model', 'Hotkey Mapper', 'Settings', 'Logs'];

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('Hotkey Mapper');

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 flex items-center gap-6 h-10 shrink-0">
        <div className="text-sm font-bold text-slate-800 whitespace-nowrap">AuTuber</div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                activeTab === tab
                  ? 'text-blue-700 bg-blue-50 font-medium'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {activeTab === 'Hotkey Mapper' ? (
          <HotkeyMapper />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400">{activeTab} coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
