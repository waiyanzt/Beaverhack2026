import React, { useCallback, useEffect, useState } from "react";
import type { VtsConnectionConfig } from "../../shared/types/config.types";
import { useVTS } from "../hooks/useVTS";

type HotkeyMapping = {
  id: string;
  triggerType: "manual" | "obs_event" | "capture_event";
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
      return "Manual";
    case "obs_event":
      return "OBS Event";
    case "capture_event":
      return "Capture Event";
    default:
      return "Manual";
  }
};

export function HotkeyMapper(): React.JSX.Element {
  const {
    status,
    hotkeys,
    loading,
    busyAction,
    error,
    connect,
    disconnect,
    authenticate,
    refreshHotkeys,
    triggerHotkey,
  } = useVTS();
  const [mappings, setMappings] = useState<HotkeyMapping[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [connectionForm, setConnectionForm] = useState<VtsConnectionConfig>({
    host: "127.0.0.1",
    port: 8001,
    pluginName: "AuTuber",
    pluginDeveloper: "AuTuber Development Team",
  });
  const [formData, setFormData] = useState<{
    triggerType: "manual" | "obs_event" | "capture_event";
    hotkeyID: string;
    cooldownMs: number;
  }>({
    triggerType: "manual",
    hotkeyID: "",
    cooldownMs: 0,
  });

  useEffect(() => {
    if (status) {
      setConnectionForm(status.config);
    }
  }, [status]);

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
      triggerType: "manual",
      hotkeyID: "",
      cooldownMs: 0,
    });
    setShowForm(false);
  }, [formData, hotkeys]);

  const handleRemoveMapping = useCallback((id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleCancel = useCallback(() => {
    setFormData({
      triggerType: "manual",
      hotkeyID: "",
      cooldownMs: 0,
    });
    setShowForm(false);
  }, []);

  const handleConnect = useCallback(async () => {
    await connect(connectionForm);
  }, [connect, connectionForm]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleAuthenticate = useCallback(async () => {
    await authenticate();
  }, [authenticate]);

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">VTube Studio</p>
          <h2 className="panel__title">Hotkey Mapper</h2>
          <p className="panel__subtitle">Map trigger events to VTube Studio hotkeys.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary-button">
          + Add Mapping
        </button>
      </header>

      <div className="panel__grid" style={{ marginTop: "24px" }}>
        <div className="panel__card">
          <h3 style={{ margin: 0 }}>Connection</h3>
          <label className="field">
            <span>Host</span>
            <input
              value={connectionForm.host}
              onChange={(event) =>
                setConnectionForm((current) => ({ ...current, host: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Port</span>
            <input
              type="number"
              min="1"
              max="65535"
              value={connectionForm.port}
              onChange={(event) =>
                setConnectionForm((current) => ({
                  ...current,
                  port: Math.max(1, Math.min(65535, Number.parseInt(event.target.value, 10) || 8001)),
                }))
              }
            />
          </label>
          <label className="field">
            <span>Plugin Name</span>
            <input
              value={connectionForm.pluginName}
              onChange={(event) =>
                setConnectionForm((current) => ({ ...current, pluginName: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Plugin Developer</span>
            <input
              value={connectionForm.pluginDeveloper}
              onChange={(event) =>
                setConnectionForm((current) => ({ ...current, pluginDeveloper: event.target.value }))
              }
            />
          </label>
          <div className="panel__actions">
            <button
              onClick={handleConnect}
              className="primary-button"
              disabled={loading || busyAction !== null}
            >
              {busyAction === "connect" ? "Connecting..." : "Connect"}
            </button>
            <button
              onClick={handleDisconnect}
              className="ghost-button"
              disabled={loading || busyAction !== null || !status?.connected}
            >
              {busyAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
          <p className="panel__hint" style={{ margin: 0 }}>
            Connect first, then approve the plugin popup inside VTube Studio.
          </p>
        </div>

        <div className="panel__card">
          <h3 style={{ margin: 0 }}>Runtime Status</h3>
          {loading || !status ? (
            <p className="panel__hint">Loading VTube Studio status...</p>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                Connection: <strong>{status.connected ? "Connected" : "Disconnected"}</strong>
              </p>
              <p style={{ margin: 0 }}>
                Authentication:{" "}
                <strong>
                  {status.authenticationState === "authenticated"
                    ? "Authenticated"
                    : status.authenticationState === "authenticating"
                      ? "Authenticating"
                      : "Not authenticated"}
                </strong>
              </p>
              <p style={{ margin: 0 }}>
                Model: <strong>{status.modelName ?? "No model data yet"}</strong>
              </p>
              <p style={{ margin: 0 }}>
                Hotkeys: <strong>{status.hotkeyCount}</strong>
              </p>
              {status.lastError ? <p className="panel__error">{status.lastError}</p> : null}
            </>
          )}
          <div className="panel__actions">
            <button
              onClick={handleAuthenticate}
              className="secondary-button"
              disabled={loading || busyAction !== null || !status?.connected}
            >
              {busyAction === "authenticate" ? "Waiting for approval..." : "Authenticate"}
            </button>
            <button
              onClick={() => void refreshHotkeys()}
              className="ghost-button"
              disabled={loading || busyAction !== null || !status?.authenticated}
            >
              {busyAction === "refresh-hotkeys" ? "Refreshing..." : "Refresh Hotkeys"}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="panel__error" style={{ marginTop: "16px" }}>{error}</p> : null}

      {showForm && (
        <div className="panel__card">
          <div className="field">
            <span>Trigger Type</span>
            <select
              value={formData.triggerType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  triggerType: e.target.value as "manual" | "obs_event" | "capture_event",
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
                <button onClick={() => void refreshHotkeys()} className="ghost-button ghost-button--compact" style={{ marginTop: "8px" }}>
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
            <button onClick={handleCancel} className="ghost-button">
              Cancel
            </button>
            <button onClick={handleAddMapping} disabled={!formData.hotkeyID} className="primary-button">
              Save
            </button>
          </div>
        </div>
      )}

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
              <button onClick={() => handleRemoveMapping(mapping.id)} className="ghost-button ghost-button--compact">
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel__card" style={{ marginTop: "24px", gap: "0", padding: "0" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(148, 163, 184, 0.2)" }}>
          <h3 style={{ margin: 0 }}>Available Hotkeys</h3>
        </div>
        {hotkeys.length === 0 ? (
          <p className="panel__hint" style={{ margin: 0, padding: "16px 20px" }}>
            Authenticate and refresh to load the current model hotkeys.
          </p>
        ) : (
          hotkeys.map((hotkey, index) => (
            <div
              key={hotkey.hotkeyID}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 20px",
                borderBottom: index < hotkeys.length - 1 ? "1px solid rgba(148, 163, 184, 0.2)" : "none",
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{hotkey.name}</p>
                <p className="panel__hint" style={{ margin: "4px 0 0" }}>
                  {hotkey.type}
                  {hotkey.description ? ` • ${hotkey.description}` : ""}
                </p>
              </div>
              <button
                onClick={() => void triggerHotkey(hotkey.hotkeyID)}
                className="secondary-button"
                disabled={!status?.authenticated || busyAction !== null}
              >
                Test Trigger
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
