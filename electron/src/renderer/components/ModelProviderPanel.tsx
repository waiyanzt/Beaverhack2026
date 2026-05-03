import React, { useEffect, useState } from "react";
import type {
  ModelProviderConfig,
  ModelProviderTestResult,
} from "../../shared/model.types";

type Status = "idle" | "checking" | "ok" | "fail";

export function ModelProviderPanel(): React.JSX.Element {
  const [provider, setProvider] = useState<ModelProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ModelProviderTestResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await window.desktop.modelListProviders();
        if (cancelled) return;
        const active = list.find((p) => p.id === "vllm") ?? list[0] ?? null;
        setProvider(active);
        if (active) {
          await window.desktop.modelSetProvider(active.id);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load provider.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTest = async (): Promise<void> => {
    setStatus("checking");
    setResult(null);
    const r = await window.desktop.modelTestConnection();
    setResult(r);
    setStatus(r.ok ? "ok" : "fail");
  };

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">AI</p>
          <h2 className="panel__title">Model Provider</h2>
          <p className="panel__subtitle">
            Endpoint that powers the stagehand. Reachable over your Tailscale tunnel.
          </p>
        </div>
        <div className="panel__status">
          <StatusPill status={status} />
        </div>
      </header>

      {loading && <p className="panel__hint" style={{ marginTop: 24 }}>Loading provider…</p>}

      {!loading && loadError && (
        <p className="panel__hint" style={{ marginTop: 24, color: "#fda4af" }}>
          {loadError}
        </p>
      )}

      {!loading && !loadError && !provider && (
        <p className="panel__hint" style={{ marginTop: 24 }}>No provider configured.</p>
      )}

      {!loading && !loadError && provider && (
        <div className="panel__card" style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{provider.label}</h3>
            <span
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(226, 232, 240, 0.55)",
              }}
            >
              {provider.id}
            </span>
          </div>

          <KeyValueRow label="Endpoint" value={`${provider.baseUrl}/v1/chat/completions`} />
          <KeyValueRow label="Model" value={shortModelName(provider.model)} title={provider.model} />
          <KeyValueRow
            label="Auth"
            value={provider.apiKey ? "API key set" : "None (LAN / Tailscale)"}
          />
          <KeyValueRow
            label="Capabilities"
            value={[
              provider.supportsToolCalling && "tools",
              provider.supportsJsonMode && "json",
              provider.vllm?.enableThinking && "reasoning",
            ]
              .filter(Boolean)
              .join(" · ")}
          />

          <div className="panel__actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleTest()}
              disabled={status === "checking"}
            >
              {status === "checking" ? "Testing…" : "Test connection"}
            </button>
          </div>

          {result && <TestResultBlock result={result} />}
        </div>
      )}
    </section>
  );
}

function KeyValueRow({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 12,
        alignItems: "baseline",
        paddingTop: 6,
      }}
    >
      <span
        style={{
          fontSize: "0.68rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(226, 232, 240, 0.55)",
        }}
      >
        {label}
      </span>
      <span
        title={title}
        style={{
          fontSize: "0.82rem",
          color: "var(--ink)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: Status }): React.JSX.Element {
  const map: Record<Status, { label: string; bg: string; color: string }> = {
    idle: {
      label: "Untested",
      bg: "rgba(148, 163, 184, 0.18)",
      color: "#cbd5f5",
    },
    checking: {
      label: "Checking",
      bg: "rgba(14, 165, 233, 0.18)",
      color: "#7dd3fc",
    },
    ok: {
      label: "Online",
      bg: "rgba(16, 185, 129, 0.2)",
      color: "#34d399",
    },
    fail: {
      label: "Offline",
      bg: "rgba(244, 63, 94, 0.18)",
      color: "#fda4af",
    },
  };
  const s = map[status];
  return (
    <span
      style={{
        padding: "6px 14px",
        borderRadius: 999,
        fontSize: "0.78rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

function TestResultBlock({ result }: { result: ModelProviderTestResult }): React.JSX.Element {
  const ok = result.ok;
  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${ok ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)"}`,
        background: ok ? "rgba(16, 185, 129, 0.08)" : "rgba(244, 63, 94, 0.08)",
        fontSize: "0.85rem",
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: ok ? "#34d399" : "#fda4af",
          marginBottom: 6,
        }}
      >
        {ok ? "Success" : "Failed"}
        {result.status !== null ? ` · HTTP ${result.status}` : ""}
      </div>
      <div style={{ color: "var(--ink)", wordBreak: "break-word" }}>{result.message}</div>
    </div>
  );
}

function shortModelName(model: string): string {
  if (!model.startsWith("/")) return model;
  const segs = model.split("/").filter(Boolean);
  for (const seg of segs) {
    if (seg.startsWith("models--")) {
      return seg.replace(/^models--/, "").replace(/--/g, "/");
    }
  }
  return segs[segs.length - 1] ?? model;
}
