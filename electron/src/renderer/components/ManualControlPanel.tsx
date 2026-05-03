import React, { useState } from "react";
import { useAutomation } from "../hooks/useAutomation";

export function ManualControlPanel(): React.JSX.Element {
  const [transcript, setTranscript] = useState("");
  const { busy, lastResult, runAutomation } = useAutomation();

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Controls</p>
          <h2 className="panel__title">Manual Control</h2>
          <p className="panel__subtitle">Run the live capture-to-model-to-VTS pipeline on demand.</p>
        </div>
      </header>

      <div className="panel__actions">
        <button className="secondary-button" disabled>
          Trigger Capture
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            void runAutomation(transcript, true);
          }}
        >
          {busy ? "Analyzing..." : "Send to AI"}
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            void runAutomation(transcript, false);
          }}
        >
          {busy ? "Running..." : "Run Automation"}
        </button>
        <button className="secondary-button" disabled>
          Reset State
        </button>
      </div>

      <label className="panel__hint" style={{ display: "grid", gap: "0.5rem" }}>
        Optional transcript context
        <textarea
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="Paste recent transcript or notes to help the model choose a reaction."
          rows={5}
          style={{
            width: "100%",
            resize: "vertical",
            borderRadius: "12px",
            padding: "0.875rem",
            background: "rgba(15, 23, 42, 0.5)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            color: "inherit",
          }}
        />
      </label>

      {lastResult ? (
        <div className="panel__hint" style={{ marginTop: "1rem" }}>
          {lastResult.ok ? (
            <>
              <p>
                Last plan returned {lastResult.plan.actions.length} action(s). Reviewed outcomes:{" "}
                {lastResult.actionResults.map((result) => `${result.type}:${result.status}`).join(", ")}
              </p>
              <p>
                Allowed actions:{" "}
                {lastResult.modelContext.services.policy.allowedActions.join(", ")}
              </p>
            </>
          ) : (
            <p>{lastResult.message}</p>
          )}
        </div>
      ) : (
        <p className="panel__hint">
          Run a dry run or full pass after capture is live to inspect VTS-only automation.
        </p>
      )}
    </section>
  );
}
