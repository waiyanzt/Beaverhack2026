import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { VtsConnectionConfig } from "../../shared/types/config.types";
import type {
  VtsCatalogEntry,
  VtsCatalogOverride,
  VtsCueLabel,
  VtsCueLabelDefinition,
  VtsEmoteKind,
  VtsHotkey,
} from "../../shared/types/vts.types";
import { useVTS } from "../hooks/useVTS";

const emoteKinds: VtsEmoteKind[] = [
  "expression_reaction",
  "symbol_effect",
  "body_motion",
  "prop_effect",
  "appearance_toggle",
  "outfit_toggle",
  "reset",
  "unknown",
];

type OverrideDraft = {
  cueLabels: string;
  emoteKind: VtsEmoteKind;
  autoMode: VtsCatalogOverride["autoMode"];
  confidence: string;
  hasAutoDeactivate: boolean;
  manualDeactivateAfterMs: string;
};

type CueLabelDraft = {
  id: string;
  name: string;
  description: string;
};

const createDraft = (entry: VtsCatalogEntry): OverrideDraft => ({
  cueLabels: (entry.override?.cueLabels ?? entry.generatedClassification.cueLabels).join(", "),
  emoteKind: entry.override?.emoteKind ?? entry.generatedClassification.emoteKind,
  autoMode: entry.override?.autoMode ?? entry.generatedClassification.autoMode,
  confidence: String(entry.override?.confidence ?? entry.generatedClassification.confidence),
  hasAutoDeactivate: entry.override?.hasAutoDeactivate ?? entry.hasAutoDeactivate,
  manualDeactivateAfterMs: String(entry.override?.manualDeactivateAfterMs ?? entry.manualDeactivateAfterMs),
});

const parseCueLabels = (value: string, allowedCueLabels: VtsCueLabel[]): VtsCueLabel[] => {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is VtsCueLabel => allowedCueLabels.includes(item));

  return [...new Set(values)];
};

const formatCueLabels = (values: VtsCueLabel[]): string => values.join(", ");
const cueLabelIdPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function HotkeyMapper(): React.JSX.Element {
  const {
    status,
    hotkeys,
    catalog,
    loading,
    busyAction,
    error,
    connect,
    disconnect,
    authenticate,
    refreshHotkeys,
    refreshCatalog,
    updateCatalogOverride,
    updateCueLabels,
    triggerHotkey,
  } = useVTS();
  const [connectionForm, setConnectionForm] = useState<VtsConnectionConfig>({
    host: "127.0.0.1",
    port: 8001,
    pluginName: "AuTuber",
    pluginDeveloper: "AuTuber Development Team",
  });
  const [editingHotkeyId, setEditingHotkeyId] = useState<string | null>(null);
  const [editingCueLabelId, setEditingCueLabelId] = useState<string | null>(null);
  const [cueLabelDraft, setCueLabelDraft] = useState<CueLabelDraft>({
    id: "",
    name: "",
    description: "",
  });
  const [drafts, setDrafts] = useState<Record<string, OverrideDraft>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (status) {
      setConnectionForm(status.config);
    }
  }, [status]);

  const catalogEntriesByHotkey = useMemo(() => {
    return new Map((catalog?.entries ?? []).map((entry) => [entry.hotkeyId, entry]));
  }, [catalog]);

  const rows = useMemo(() => {
    return hotkeys.map((hotkey) => ({
      hotkey,
      entry: catalogEntriesByHotkey.get(hotkey.hotkeyID) ?? null,
    }));
  }, [catalogEntriesByHotkey, hotkeys]);

  const cueLabelDefinitions = status?.cueLabels ?? [];
  const cueLabelIds = useMemo(() => cueLabelDefinitions.map((cueLabel) => cueLabel.id), [cueLabelDefinitions]);
  const usedCueLabelIds = useMemo(() => {
    return new Set((catalog?.entries ?? []).flatMap((entry) => entry.cueLabels));
  }, [catalog]);

  const beginEdit = useCallback((entry: VtsCatalogEntry) => {
    setEditingHotkeyId(entry.hotkeyId);
    setDrafts((current) => ({
      ...current,
      [entry.hotkeyId]: current[entry.hotkeyId] ?? createDraft(entry),
    }));
    setValidationError(null);
  }, []);

  const handleSaveOverride = useCallback(async (entry: VtsCatalogEntry) => {
    const draft = drafts[entry.hotkeyId];
    if (!draft) {
      return;
    }

    const nextCueLabels = parseCueLabels(draft.cueLabels, cueLabelIds);
    const nextConfidence = Number.parseFloat(draft.confidence);
    const nextManualDeactivateAfterMs = Number.parseInt(draft.manualDeactivateAfterMs, 10);

    if (nextCueLabels.length === 0) {
      setValidationError("Override must include at least one valid cue label.");
      return;
    }

    if (!Number.isFinite(nextConfidence) || nextConfidence < 0 || nextConfidence > 1) {
      setValidationError("Override confidence must be between 0 and 1.");
      return;
    }

    if (
      !draft.hasAutoDeactivate
      && (!Number.isInteger(nextManualDeactivateAfterMs) || nextManualDeactivateAfterMs < 500 || nextManualDeactivateAfterMs > 300000)
    ) {
      setValidationError("Manual deactivation delay must be between 500 and 300000 ms.");
      return;
    }

    setValidationError(null);
    await updateCatalogOverride(entry.hotkeyId, {
      cueLabels: nextCueLabels,
      emoteKind: draft.emoteKind,
      autoMode: draft.autoMode,
      confidence: nextConfidence,
      hasAutoDeactivate: draft.hasAutoDeactivate,
      manualDeactivateAfterMs: draft.hasAutoDeactivate ? entry.manualDeactivateAfterMs : nextManualDeactivateAfterMs,
    });
    setEditingHotkeyId(null);
  }, [cueLabelIds, drafts, updateCatalogOverride]);

  const handleClearOverride = useCallback(async (hotkeyId: string) => {
    setValidationError(null);
    await updateCatalogOverride(hotkeyId, null);
    setEditingHotkeyId(null);
  }, [updateCatalogOverride]);

  const beginCueLabelEdit = useCallback((cueLabel: VtsCueLabelDefinition) => {
    setEditingCueLabelId(cueLabel.id);
    setCueLabelDraft({
      id: cueLabel.id,
      name: cueLabel.name,
      description: cueLabel.description,
    });
    setValidationError(null);
  }, []);

  const beginCueLabelCreate = useCallback(() => {
    setEditingCueLabelId(null);
    setCueLabelDraft({
      id: "",
      name: "",
      description: "",
    });
    setValidationError(null);
  }, []);

  const handleSaveCueLabel = useCallback(async () => {
    const id = cueLabelDraft.id.trim().toLowerCase();
    const name = cueLabelDraft.name.trim();
    const description = cueLabelDraft.description.trim();

    if (!cueLabelIdPattern.test(id)) {
      setValidationError("Cue label ID must use lowercase letters, numbers, underscores, or hyphens.");
      return;
    }

    if (name.length === 0) {
      setValidationError("Cue label name is required.");
      return;
    }

    const isEditing = editingCueLabelId !== null;
    if (isEditing && id !== editingCueLabelId) {
      setValidationError("Cue label IDs are stable. Create a new label if you need a different ID.");
      return;
    }

    if (!isEditing && cueLabelDefinitions.some((cueLabel) => cueLabel.id === id)) {
      setValidationError("A cue label with that ID already exists.");
      return;
    }

    const nextCueLabels = isEditing
      ? cueLabelDefinitions.map((cueLabel) => cueLabel.id === id ? { id, name, description } : cueLabel)
      : [...cueLabelDefinitions, { id, name, description }];

    setValidationError(null);
    await updateCueLabels(nextCueLabels);
    beginCueLabelCreate();
  }, [beginCueLabelCreate, cueLabelDefinitions, cueLabelDraft, editingCueLabelId, updateCueLabels]);

  const handleRemoveCueLabel = useCallback(async (cueLabelId: string) => {
    const nextCueLabels = cueLabelDefinitions.filter((cueLabel) => cueLabel.id !== cueLabelId);

    if (nextCueLabels.length === 0) {
      setValidationError("At least one cue label must remain configured.");
      return;
    }

    setValidationError(null);
    await updateCueLabels(nextCueLabels);
    beginCueLabelCreate();
  }, [beginCueLabelCreate, cueLabelDefinitions, updateCueLabels]);

  const renderClassification = (title: string, entry: VtsCatalogEntry | null, useGenerated: boolean): React.JSX.Element => {
    if (!entry) {
      return <p className="panel__hint">{title}: waiting for catalog data.</p>;
    }

    const source = useGenerated
      ? entry.generatedClassification
      : {
          cueLabels: entry.cueLabels,
          emoteKind: entry.emoteKind,
          autoMode: entry.autoMode,
          confidence: entry.confidence,
        };

    return (
      <div style={{ display: "grid", gap: "4px" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{title}</p>
        <p className="panel__hint" style={{ margin: 0 }}>
          Cue Labels: {formatCueLabels(source.cueLabels)}
        </p>
        <p className="panel__hint" style={{ margin: 0 }}>
          Emote Kind: {source.emoteKind}
        </p>
        <p className="panel__hint" style={{ margin: 0 }}>
          Auto Mode: {source.autoMode}
        </p>
        <p className="panel__hint" style={{ margin: 0 }}>
          Confidence: {source.confidence.toFixed(2)}
        </p>
        {!useGenerated ? (
          <p className="panel__hint" style={{ margin: 0 }}>
            Deactivation: {entry.hasAutoDeactivate ? "auto" : `manual retrigger after ${entry.manualDeactivateAfterMs} ms`}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">VTube Studio</p>
          <h2 className="panel__title">Catalog</h2>
          <p className="panel__subtitle">
            Regenerate the current model hotkey catalog and override individual classifications.
          </p>
        </div>
        <div className="panel__actions">
          <button
            onClick={() => void refreshCatalog(true)}
            className="primary-button"
            disabled={loading || busyAction !== null}
          >
            {busyAction === "refresh-catalog" ? "Regenerating..." : "Refresh Mappings"}
          </button>
        </div>
      </header>

      <div className="panel__grid" style={{ marginTop: "24px" }}>
        <div className="panel__card">
          <h3 style={{ margin: 0 }}>Connection</h3>
          <label className="field">
            <span>Host</span>
            <input
              value={connectionForm.host}
              onChange={(event) => setConnectionForm((current) => ({ ...current, host: event.target.value }))}
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
              onChange={(event) => setConnectionForm((current) => ({ ...current, pluginName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Plugin Developer</span>
            <input
              value={connectionForm.pluginDeveloper}
              onChange={(event) => setConnectionForm((current) => ({ ...current, pluginDeveloper: event.target.value }))}
            />
          </label>
          <div className="panel__actions">
            <button onClick={() => void connect(connectionForm)} className="primary-button" disabled={loading || busyAction !== null}>
              {busyAction === "connect" ? "Connecting..." : "Connect"}
            </button>
            <button onClick={() => void disconnect()} className="ghost-button" disabled={loading || busyAction !== null || !status?.connected}>
              {busyAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
            </button>
            <button onClick={() => void authenticate()} className="secondary-button" disabled={loading || busyAction !== null || !status?.connected}>
              {busyAction === "authenticate" ? "Authenticating..." : "Authenticate"}
            </button>
          </div>
        </div>

        <div className="panel__card">
          <h3 style={{ margin: 0 }}>Catalog Status</h3>
          {loading || !status ? (
            <p className="panel__hint">Loading VTube Studio status...</p>
          ) : (
            <>
              <p style={{ margin: 0 }}>Readiness: <strong>{status.readinessState}</strong></p>
              <p style={{ margin: 0 }}>Current Model: <strong>{status.modelName ?? "No model loaded"}</strong></p>
              <p style={{ margin: 0 }}>Hotkeys Loaded: <strong>{status.hotkeyCount}</strong></p>
              <p style={{ margin: 0 }}>Catalog Version: <strong>{status.catalog.version ?? "-"}</strong></p>
              <p style={{ margin: 0 }}>Safe Auto: <strong>{status.catalog.safeAutoCount}</strong></p>
              <p style={{ margin: 0 }}>Suggest-only: <strong>{status.catalog.suggestOnlyCount}</strong></p>
              <p style={{ margin: 0 }}>Manual-only: <strong>{status.catalog.manualOnlyCount}</strong></p>
            </>
          )}
          <div className="panel__actions">
            <button onClick={() => void refreshHotkeys()} className="ghost-button" disabled={loading || busyAction !== null || !status?.authenticated}>
              {busyAction === "refresh-hotkeys" ? "Refreshing Hotkeys..." : "Refresh Raw Hotkeys"}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="panel__error" style={{ marginTop: "16px" }}>{error}</p> : null}
      {validationError ? <p className="panel__error" style={{ marginTop: "16px" }}>{validationError}</p> : null}

      <div className="panel__card" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0 }}>Cue Labels</h3>
            <p className="panel__hint" style={{ margin: "6px 0 0" }}>
              The live model only receives labels currently used by safe-auto hotkey mappings. Removed labels are stripped from overrides.
            </p>
          </div>
          <button onClick={beginCueLabelCreate} className="ghost-button" disabled={busyAction !== null}>
            New Label
          </button>
        </div>

        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {cueLabelDefinitions.map((cueLabel) => (
            <div
              key={cueLabel.id}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.22)",
                borderRadius: "14px",
                padding: "12px",
                display: "grid",
                gap: "8px",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{cueLabel.name}</p>
                <p className="panel__hint" style={{ margin: "3px 0 0" }}>{cueLabel.id}</p>
                {cueLabel.description ? (
                  <p className="panel__hint" style={{ margin: "3px 0 0" }}>{cueLabel.description}</p>
                ) : null}
                <p className="panel__hint" style={{ margin: "3px 0 0" }}>
                  {usedCueLabelIds.has(cueLabel.id) ? "Mapped to a catalog entry" : "Not currently mapped"}
                </p>
              </div>
              <div className="panel__actions">
                <button onClick={() => beginCueLabelEdit(cueLabel)} className="ghost-button" disabled={busyAction !== null}>
                  Edit
                </button>
                <button
                  onClick={() => void handleRemoveCueLabel(cueLabel.id)}
                  className="ghost-button"
                  disabled={busyAction !== null}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel__card" style={{ margin: 0 }}>
          <h4 style={{ margin: 0 }}>{editingCueLabelId ? "Edit Cue Label" : "Create Cue Label"}</h4>
          <label className="field">
            <span>ID</span>
            <input
              value={cueLabelDraft.id}
              disabled={editingCueLabelId !== null}
              placeholder="big_laugh"
              onChange={(event) => setCueLabelDraft((current) => ({ ...current, id: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Name</span>
            <input
              value={cueLabelDraft.name}
              placeholder="Big Laugh"
              onChange={(event) => setCueLabelDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <input
              value={cueLabelDraft.description}
              placeholder="Use when the person is visibly laughing hard."
              onChange={(event) => setCueLabelDraft((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <div className="panel__actions" style={{ justifyContent: "flex-end" }}>
            <button onClick={beginCueLabelCreate} className="ghost-button" disabled={busyAction !== null}>
              Clear
            </button>
            <button onClick={() => void handleSaveCueLabel()} className="primary-button" disabled={busyAction !== null}>
              Save Cue Label
            </button>
          </div>
        </div>
      </div>

      <div className="panel__card" style={{ marginTop: "24px", gap: "0", padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(148, 163, 184, 0.2)" }}>
          <h3 style={{ margin: 0 }}>Current Model Hotkeys</h3>
          <p className="panel__hint" style={{ margin: "6px 0 0" }}>
            Regeneration always starts from the current raw hotkey list. Old-model entries should disappear after refresh.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="panel__hint" style={{ margin: 0, padding: "16px 20px" }}>
            Authenticate and refresh to load the current model hotkeys.
          </p>
        ) : (
          rows.map(({ hotkey, entry }, index) => {
            const isEditing = editingHotkeyId === hotkey.hotkeyID && entry !== null;
            const draft = drafts[hotkey.hotkeyID];

            return (
              <div
                key={hotkey.hotkeyID}
                style={{
                  padding: "18px 20px",
                  borderBottom: index < rows.length - 1 ? "1px solid rgba(148, 163, 184, 0.2)" : "none",
                  display: "grid",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{hotkey.name}</p>
                    <p className="panel__hint" style={{ margin: "4px 0 0" }}>
                      Raw Hotkey ID: {hotkey.hotkeyID}
                    </p>
                    <p className="panel__hint" style={{ margin: "4px 0 0" }}>
                      Catalog ID: {entry?.catalogId ?? "-"} • Source: {entry?.effectiveSource ?? "-"}
                    </p>
                  </div>
                  <div className="panel__actions">
                    <button
                      onClick={() => void triggerHotkey(hotkey.hotkeyID)}
                      className="secondary-button"
                      disabled={!status?.authenticated || busyAction !== null}
                    >
                      Test Trigger
                    </button>
                    {entry ? (
                      <button
                        onClick={() => beginEdit(entry)}
                        className="ghost-button"
                        disabled={busyAction !== null}
                      >
                        {entry.override ? "Edit Override" : "Add Override"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                  {renderClassification("Generated", entry, true)}
                  {renderClassification("Effective", entry, false)}
                </div>

                {isEditing && entry && draft ? (
                  <div className="panel__card" style={{ margin: 0 }}>
                    <h4 style={{ margin: 0 }}>Manual Override</h4>
                    <label className="field">
                      <span>Cue Labels</span>
                      <input
                        value={draft.cueLabels}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [hotkey.hotkeyID]: {
                              ...draft,
                              cueLabels: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <p className="panel__hint" style={{ margin: 0 }}>
                      Allowed labels: {cueLabelIds.join(", ")}
                    </p>
                    <label className="field">
                      <span>Emote Kind</span>
                      <select
                        value={draft.emoteKind}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [hotkey.hotkeyID]: {
                              ...draft,
                              emoteKind: event.target.value as VtsEmoteKind,
                            },
                          }))
                        }
                      >
                        {emoteKinds.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Auto Mode</span>
                      <select
                        value={draft.autoMode}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [hotkey.hotkeyID]: {
                              ...draft,
                              autoMode: event.target.value as VtsCatalogOverride["autoMode"],
                            },
                          }))
                        }
                      >
                        <option value="safe_auto">safe_auto</option>
                        <option value="suggest_only">suggest_only</option>
                        <option value="manual_only">manual_only</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Confidence</span>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={draft.confidence}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [hotkey.hotkeyID]: {
                              ...draft,
                              confidence: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Deactivation Behavior</span>
                      <select
                        value={draft.hasAutoDeactivate ? "auto" : "manual"}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [hotkey.hotkeyID]: {
                              ...draft,
                              hasAutoDeactivate: event.target.value === "auto",
                            },
                          }))
                        }
                      >
                        <option value="manual">Needs manual retrigger to deactivate</option>
                        <option value="auto">Auto-deactivates on its own</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Manual Deactivate After (ms)</span>
                      <input
                        type="number"
                        min="500"
                        max="300000"
                        step="100"
                        value={draft.manualDeactivateAfterMs}
                        disabled={draft.hasAutoDeactivate}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [hotkey.hotkeyID]: {
                              ...draft,
                              manualDeactivateAfterMs: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <p className="panel__hint" style={{ margin: 0 }}>
                      Defaults assume a hotkey stays active until AuTuber retriggers it. Mark only the hotkeys that truly auto-deactivate inside VTube Studio.
                    </p>
                    <div className="panel__actions" style={{ justifyContent: "flex-end" }}>
                      <button onClick={() => setEditingHotkeyId(null)} className="ghost-button">
                        Cancel
                      </button>
                      {entry.override ? (
                        <button
                          onClick={() => void handleClearOverride(hotkey.hotkeyID)}
                          className="ghost-button"
                          disabled={busyAction === `override:${hotkey.hotkeyID}`}
                        >
                          Clear Override
                        </button>
                      ) : null}
                      <button
                        onClick={() => void handleSaveOverride(entry)}
                        className="primary-button"
                        disabled={busyAction === `override:${hotkey.hotkeyID}`}
                      >
                        {busyAction === `override:${hotkey.hotkeyID}` ? "Saving..." : "Save Override"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
