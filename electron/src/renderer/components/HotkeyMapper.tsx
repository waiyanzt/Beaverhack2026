import React, { useState, useCallback } from 'react';
import { useVTS } from '../hooks/useVTS';

type HotkeyMapping = {
  id: string;
  triggerType: 'manual' | 'obs_event' | 'capture_event';
  hotkeyID: string;
  hotkeyName: string;
  cooldownMs: number;
};

const getTriggerBadgeClass = (triggerType: string): string => {
  switch (triggerType) {
    case 'manual':
      return 'status-pill--manual';
    case 'obs_event':
      return 'status-pill--obs';
    case 'capture_event':
      return 'status-pill--capture';
    default:
      return 'status-pill--manual';
  }
};

const getTriggerLabel = (triggerType: string): string => {
  switch (triggerType) {
    case 'manual':
      return 'Manual';
    case 'obs_event':
      return 'OBS Event';
    case 'capture_event':
      return 'Capture Event';
    default:
      return 'Manual';
  }
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

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">VTube Studio</p>
          <h2 className="panel__title">Hotkey Mapper</h2>
          <p className="panel__subtitle">Map trigger events to VTube Studio hotkeys.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="primary-button"
        >
          + Add Mapping
        </button>
      </header>

      {/* Add Mapping Form */}
      {showForm && (
        <div className="panel__card">
          <div className="field">
            <span>Trigger Type</span>
            <select
              value={formData.triggerType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  triggerType: e.target.value as 'manual' | 'obs_event' | 'capture_event',
                })
              }
            >
              <option value="manual">Manual</option>
              <option value="obs_event">OBS Event</option>
              <option value="capture_event">Capture Event</option>
            </select>
          </div>

          <div className="field">
            <span>VTS Hotkey</span>
            {loading && !hotkeys.length ? (
              <p className="panel__hint">Loading hotkeys...</p>
            ) : error ? (
              <div>
                <p className="panel__error">{error}</p>
                <button
                  onClick={refetch}
                  className="ghost-button ghost-button--compact"
                  style={{ marginTop: '8px' }}
                >
                  ↻ Retry
                </button>
              </div>
            ) : hotkeys.length === 0 ? (
              <select disabled>
                <option>No hotkeys available</option>
              </select>
            ) : (
              <select
                value={formData.hotkeyID}
                onChange={(e) =>
                  setFormData({ ...formData, hotkeyID: e.target.value })
                }
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

          <div className="field">
            <span>Cooldown (ms)</span>
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
            />
          </div>

          <div className="panel__actions" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={handleCancel}
              className="ghost-button"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMapping}
              disabled={!formData.hotkeyID}
              className="primary-button"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Mapping List */}
      {mappings.length === 0 && !showForm ? (
        <p className="panel__hint">No mappings yet. Add one to get started.</p>
      ) : (
        <div className="panel__card" style={{ gap: '0', padding: '0' }}>
          {mappings.map((mapping, index) => (
            <div
              key={mapping.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: index < mappings.length - 1 ? '1px solid rgba(148, 163, 184, 0.2)' : 'none',
              }}
            >
              <span className={`status-pill ${getTriggerBadgeClass(mapping.triggerType)}`}>
                {getTriggerLabel(mapping.triggerType)}
              </span>
              <span style={{ flex: 1, fontSize: '0.9rem' }}>
                {mapping.hotkeyName}
              </span>
              <span className="panel__hint" style={{ flex: 0 }}>
                {mapping.cooldownMs}ms
              </span>
              <button
                onClick={() => handleRemoveMapping(mapping.id)}
                className="ghost-button ghost-button--compact"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
