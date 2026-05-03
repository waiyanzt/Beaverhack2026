import React, { useCallback, useEffect, useState } from "react";
import type { VtsConnectionConfig, VtsEmoteMappingConfig } from "../../shared/types/config.types";
import { useVTS } from "../hooks/useVTS";

const createDefaultEmoteMapping = (
  hotkeyId: string,
  hotkeyName: string,
  description: string | null,
): VtsEmoteMappingConfig => ({
  hotkeyId,
  name: hotkeyName.trim().slice(0, 32) || "emote",
  description: (description?.trim() || `Trigger the ${hotkeyName.trim() || "selected"} VTS reaction.`).slice(0, 240),
  enabled: true,
});

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
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [hasUnsavedMappings, setHasUnsavedMappings] = useState(false);
  const [emoteMappings, setEmoteMappings] = useState<VtsEmoteMappingConfig[]>([]);
  const [connectionForm, setConnectionForm] = useState<VtsConnectionConfig>({
    host: "127.0.0.1",
    port: 8001,
    pluginName: "AuTuber",
    pluginDeveloper: "AuTuber Development Team",
    emoteMappings: [],
  });

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async (): Promise<void> => {
      setSettingsLoading(true);
      const result = await window.desktop.settingsGet();

      if (cancelled) {
        return;
      }

      setConnectionForm(result.settings.vts);
      setEmoteMappings(result.settings.vts.emoteMappings);
      setHasUnsavedMappings(false);
      setSettingsMessage(result.ok ? null : result.message);
      setSettingsLoading(false);
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status) {
      setConnectionForm(status.config);
      if (!hasUnsavedMappings) {
        setEmoteMappings(status.config.emoteMappings);
      }
    }
  }, [hasUnsavedMappings, status]);

  const persistVtsConfig = useCallback(async (nextConfig: VtsConnectionConfig): Promise<void> => {
    setSettingsMessage(null);
    const result = await window.desktop.settingsUpdate({ vts: nextConfig });

    setConnectionForm(result.settings.vts);
    setEmoteMappings(result.settings.vts.emoteMappings);
    setHasUnsavedMappings(false);
    setSettingsMessage(result.ok ? "VTS emote settings saved." : result.message);
  }, []);

  const persistMappings = useCallback(async (nextMappings: VtsEmoteMappingConfig[]): Promise<void> => {
    await persistVtsConfig({
      ...connectionForm,
      emoteMappings: nextMappings,
    });
  }, [connectionForm, persistVtsConfig]);

  const handleAddEmote = useCallback((hotkeyID: string) => {
    const selectedHotkey = hotkeys.find((hotkey) => hotkey.hotkeyID === hotkeyID);
    if (!selectedHotkey || emoteMappings.some((mapping) => mapping.hotkeyId === hotkeyID)) {
      return;
    }

    setEmoteMappings((currentMappings) => [
      ...currentMappings,
      createDefaultEmoteMapping(selectedHotkey.hotkeyID, selectedHotkey.name, selectedHotkey.description),
    ]);
    setHasUnsavedMappings(true);
    setSettingsMessage("Unsaved emote mapping changes.");
  }, [emoteMappings, hotkeys]);

  const updateEmoteMapping = useCallback((
    hotkeyId: string,
    update: Partial<VtsEmoteMappingConfig>,
  ): void => {
    setEmoteMappings((currentMappings) =>
      currentMappings.map((mapping) => mapping.hotkeyId === hotkeyId ? { ...mapping, ...update } : mapping),
    );
    setHasUnsavedMappings(true);
    setSettingsMessage("Unsaved emote mapping changes.");
  }, []);

  const removeEmoteMapping = useCallback((hotkeyId: string): void => {
    setEmoteMappings((currentMappings) => currentMappings.filter((mapping) => mapping.hotkeyId !== hotkeyId));
    setHasUnsavedMappings(true);
    setSettingsMessage("Unsaved emote mapping changes.");
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

  const handleRetryActivation = useCallback(async () => {
    await window.desktop.servicesActivate();
    await refreshHotkeys();
  }, [refreshHotkeys]);

  const handleSaveConnection = useCallback(async (): Promise<void> => {
    await persistVtsConfig({
      ...connectionForm,
      emoteMappings,
    });
  }, [connectionForm, emoteMappings, persistVtsConfig]);

  const handleSaveMappings = useCallback(async (): Promise<void> => {
    await persistMappings(emoteMappings);
    await refreshHotkeys();
  }, [emoteMappings, persistMappings, refreshHotkeys]);

  const mappedHotkeyIds = new Set(emoteMappings.map((mapping) => mapping.hotkeyId));
  const hasInvalidMappings = emoteMappings.some(
    (mapping) => mapping.name.trim().length === 0 || mapping.description.trim().length === 0,
  );

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">VTube Studio</p>
          <h2 className="panel__title">Prompt Emotes</h2>
          <p className="panel__subtitle">
            Choose the VTS hotkeys the model may use, then give each one a short prompt name and description.
          </p>
        </div>
        <button
          onClick={() => void handleSaveMappings()}
          className="primary-button"
          disabled={settingsLoading || hasInvalidMappings}
        >
          Save Emote Settings
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
              onClick={() => void handleSaveConnection()}
              className="secondary-button"
              disabled={settingsLoading || loading || busyAction !== null}
            >
              Save Connection
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
              <p style={{ margin: 0 }}>
                Prompt Emotes: <strong>{status.catalog.safeAutoCount}</strong>
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
            <button
              onClick={() => void handleRetryActivation()}
              className="ghost-button"
              disabled={loading || busyAction !== null}
            >
              Retry Activation
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="panel__error" style={{ marginTop: "16px" }}>
          {error}
        </p>
      ) : null}

      {settingsMessage ? (
        <p className="panel__status-message">{settingsMessage}</p>
      ) : null}

      <div className="panel__card" style={{ marginTop: "24px", gap: "16px" }}>
        <div>
          <h3 style={{ margin: 0 }}>Model Prompt Emote List</h3>
          <p className="panel__hint" style={{ marginTop: "6px" }}>
            Only enabled entries in this list are shown to the model. The real VTS hotkey IDs stay local.
          </p>
        </div>

        {emoteMappings.length === 0 ? (
          <p className="panel__hint">No prompt emotes yet. Add entries from the current VTS hotkey list below.</p>
        ) : (
          emoteMappings.map((mapping) => {
            const hotkey = hotkeys.find((candidate) => candidate.hotkeyID === mapping.hotkeyId);

            return (
              <div key={mapping.hotkeyId} className="panel__card" style={{ background: "rgba(2, 6, 23, 0.28)" }}>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={mapping.enabled}
                    onChange={(event) => updateEmoteMapping(mapping.hotkeyId, { enabled: event.target.checked })}
                  />
                  <span>{hotkey?.name ?? "Unavailable VTS hotkey"}</span>
                </label>
                <label className="field">
                  <span>Short prompt name</span>
                  <input
                    value={mapping.name}
                    maxLength={32}
                    onChange={(event) => updateEmoteMapping(mapping.hotkeyId, { name: event.target.value })}
                    placeholder="wave"
                  />
                </label>
                <label className="field">
                  <span>Prompt description</span>
                  <textarea
                    className="response-log"
                    style={{ minHeight: "84px", resize: "vertical" }}
                    value={mapping.description}
                    maxLength={240}
                    onChange={(event) => updateEmoteMapping(mapping.hotkeyId, { description: event.target.value })}
                    placeholder="Use when the streamer greets chat or waves at the camera."
                  />
                </label>
                <div className="panel__actions" style={{ marginTop: 0 }}>
                  <button
                    onClick={() => void triggerHotkey(mapping.hotkeyId)}
                    className="secondary-button"
                    disabled={!status?.authenticated || busyAction !== null || !hotkey}
                  >
                    Test Trigger
                  </button>
                  <button onClick={() => removeEmoteMapping(mapping.hotkeyId)} className="ghost-button">
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="panel__card" style={{ marginTop: "24px", gap: "0", padding: "0" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(148, 163, 184, 0.2)" }}>
          <h3 style={{ margin: 0 }}>Available VTS Hotkeys</h3>
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
                borderBottom:
                  index < hotkeys.length - 1 ? "1px solid rgba(148, 163, 184, 0.2)" : "none",
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
                onClick={() => handleAddEmote(hotkey.hotkeyID)}
                className="primary-button"
                disabled={mappedHotkeyIds.has(hotkey.hotkeyID)}
              >
                {mappedHotkeyIds.has(hotkey.hotkeyID) ? "Added" : "Add to Prompt"}
              </button>
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
