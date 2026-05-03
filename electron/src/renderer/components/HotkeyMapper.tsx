import React, { useState, useCallback } from 'react';
import { Trash2, RefreshCw, Plus } from 'lucide-react';
import { useVTS } from '../hooks/useVTS';

type HotkeyMapping = {
  id: string;
  triggerType: 'manual' | 'obs_event' | 'capture_event';
  hotkeyID: string;
  hotkeyName: string;
  cooldownMs: number;
};

export function HotkeyMapper(): React.JSX.Element {
  const { hotkeys, loading, error, refetch } = useVTS();
  const [mappings, setMappings] = useState<HotkeyMapping[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    triggerType: 'manual' as const,
    hotkeyID: '',
    cooldownMs: 0,
  });

  const handleAddMapping = useCallback(() => {
    if (!formData.hotkeyID) {
      return;
    }

    const selectedHotkey = hotkeys.find((h) => h.hotkeyID === formData.hotkeyID);
    if (!selectedHotkey) {
      return;
    }

    const newMapping: HotkeyMapping = {
      id: crypto.randomUUID(),
      triggerType: formData.triggerType,
      hotkeyID: formData.hotkeyID,
      hotkeyName: selectedHotkey.name,
      cooldownMs: formData.cooldownMs,
    };

    setMappings((prev) => [...prev, newMapping]);
    setFormData({
      triggerType: 'manual',
      hotkeyID: '',
      cooldownMs: 0,
    });
    setShowForm(false);
  }, [formData, hotkeys]);

  const handleRemoveMapping = useCallback((id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleCancel = useCallback(() => {
    setFormData({
      triggerType: 'manual',
      hotkeyID: '',
      cooldownMs: 0,
    });
    setShowForm(false);
  }, []);

  const getTriggerBadgeColor = (triggerType: string) => {
    switch (triggerType) {
      case 'manual':
        return 'bg-slate-100 text-slate-600';
      case 'obs_event':
        return 'bg-blue-50 text-blue-700';
      case 'capture_event':
        return 'bg-emerald-50 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="bg-slate-50 min-h-full p-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Hotkey Mapper</h2>
            <p className="text-xs text-slate-500">
              Map trigger events to VTube Studio hotkeys
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Mapping
          </button>
        </div>

        {/* Add Mapping Form */}
        {showForm && (
          <div className="border-t border-slate-200 p-4 flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-600 block mb-1">
                Trigger Type
              </label>
              <select
                value={formData.triggerType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    triggerType: e.target.value as 'manual' | 'obs_event' | 'capture_event',
                  })
                }
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual</option>
                <option value="obs_event">OBS Event</option>
                <option value="capture_event">Capture Event</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-600 block mb-1">
                VTS Hotkey
              </label>
              {loading && !hotkeys.length ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse bg-slate-100 rounded h-4 w-full"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-rose-600">{error}</p>
                  <button
                    onClick={refetch}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors text-xs font-medium"
                  >
                    <RefreshCw size={14} />
                    Retry
                  </button>
                </div>
              ) : hotkeys.length === 0 ? (
                <select disabled className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-500 bg-slate-50">
                  <option>No hotkeys available</option>
                </select>
              ) : (
                <select
                  value={formData.hotkeyID}
                  onChange={(e) =>
                    setFormData({ ...formData, hotkeyID: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a hotkey...</option>
                  {hotkeys.map((hotkey) => (
                    <option key={hotkey.hotkeyID} value={hotkey.hotkeyID}>
                      {hotkey.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-600 block mb-1">
                Cooldown (ms)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={formData.cooldownMs}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cooldownMs: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMapping}
                disabled={!formData.hotkeyID}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Mapping List */}
        <div>
          {mappings.length === 0 && !showForm ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">
                No mappings yet. Add one to get started.
              </p>
            </div>
          ) : (
            <div>
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center gap-4 py-3 px-4 border-b border-slate-100 last:border-0"
                >
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${getTriggerBadgeColor(
                      mapping.triggerType
                    )}`}
                  >
                    {mapping.triggerType === 'manual'
                      ? 'Manual'
                      : mapping.triggerType === 'obs_event'
                        ? 'OBS Event'
                        : 'Capture Event'}
                  </span>
                  <span className="text-sm text-slate-800 flex-1">
                    {mapping.hotkeyName}
                  </span>
                  <span className="text-xs text-slate-500">
                    {mapping.cooldownMs}ms
                  </span>
                  <button
                    onClick={() => handleRemoveMapping(mapping.id)}
                    className="text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
