import { useCallback, useEffect, useState } from "react";
import type { VtsConnectionConfig } from "../../shared/types/config.types";
import type {
  VtsCatalogOverride,
  VtsCatalogSummary,
  VtsHotkey,
  VtsStatus,
} from "../../shared/types/vts.types";

interface UseVtsReturn {
  status: VtsStatus | null;
  hotkeys: VtsHotkey[];
  catalog: VtsCatalogSummary | null;
  loading: boolean;
  busyAction:
    | "connect"
    | "disconnect"
    | "authenticate"
    | "refresh-hotkeys"
    | "refresh-catalog"
    | `trigger:${string}`
    | `override:${string}`
    | null;
  error: string | null;
  connect: (config: VtsConnectionConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  authenticate: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshHotkeys: () => Promise<void>;
  refreshCatalog: (forceRegenerate?: boolean) => Promise<void>;
  updateCatalogOverride: (hotkeyId: string, override: VtsCatalogOverride | null) => Promise<void>;
  triggerHotkey: (hotkeyId: string) => Promise<void>;
}

export function useVTS(): UseVtsReturn {
  const [status, setStatus] = useState<VtsStatus | null>(null);
  const [hotkeys, setHotkeys] = useState<VtsHotkey[]>([]);
  const [catalog, setCatalog] = useState<VtsCatalogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<UseVtsReturn["busyAction"]>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const response = await window.desktop.vtsGetStatus();
    setStatus(response.status);
    setCatalog(response.status.catalog);
    setError(response.ok ? null : response.message);
  }, []);

  const refreshHotkeys = useCallback(async () => {
    setBusyAction("refresh-hotkeys");

    try {
      const response = await window.desktop.vtsGetHotkeys();
      setStatus(response.status);
      setHotkeys(response.hotkeys);
      setCatalog(response.status.catalog);
      setError(response.ok ? null : response.message);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const connect = useCallback(async (config: VtsConnectionConfig) => {
    setBusyAction("connect");

    try {
      const response = await window.desktop.vtsConnect(config);
      setStatus(response.status);
      setCatalog(response.status.catalog);
      setHotkeys([]);
      setError(response.ok ? null : response.message);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusyAction("disconnect");

    try {
      const response = await window.desktop.vtsDisconnect();
      setStatus(response.status);
      setCatalog(response.status.catalog);
      setHotkeys([]);
      setError(response.ok ? null : response.message);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const authenticate = useCallback(async () => {
    setBusyAction("authenticate");

    try {
      const response = await window.desktop.vtsAuthenticate();
      setStatus(response.status);
      setCatalog(response.status.catalog);
      setError(response.ok ? null : response.message);

      if (response.ok) {
        await refreshHotkeys();
      } else {
        setHotkeys([]);
      }
    } finally {
      setBusyAction(null);
    }
  }, [refreshHotkeys]);

  const triggerHotkey = useCallback(async (hotkeyId: string) => {
    setBusyAction(`trigger:${hotkeyId}`);

    try {
      const response = await window.desktop.vtsTriggerHotkey({ hotkeyId });
      setStatus(response.status);
      setCatalog(response.status.catalog);
      setError(response.ok ? null : response.message);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const refreshCatalog = useCallback(async (forceRegenerate = false) => {
    setBusyAction("refresh-catalog");

    try {
      const response = await window.desktop.vtsRefreshCatalog({ forceRegenerate });
      setStatus(response.status);
      setCatalog(response.catalog);
      setError(response.ok ? null : response.message);

      if (response.status.authenticated) {
        const hotkeyResponse = await window.desktop.vtsGetHotkeys();
        setStatus(hotkeyResponse.status);
        setHotkeys(hotkeyResponse.hotkeys);
        setCatalog(hotkeyResponse.status.catalog);
        setError(hotkeyResponse.ok ? null : hotkeyResponse.message);
      }
    } finally {
      setBusyAction(null);
    }
  }, []);

  const updateCatalogOverride = useCallback(async (hotkeyId: string, override: VtsCatalogOverride | null) => {
    setBusyAction(`override:${hotkeyId}`);

    try {
      const response = await window.desktop.vtsUpdateCatalogOverride({ hotkeyId, override });
      setStatus(response.status);
      setCatalog(response.catalog);
      setError(response.ok ? null : response.message);
    } finally {
      setBusyAction(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setLoading(true);

      try {
        const response = await window.desktop.vtsGetStatus();

        if (cancelled) {
          return;
        }

        setStatus(response.status);
        setCatalog(response.status.catalog);
        setError(response.ok ? null : response.message);

        if (response.status.authenticated) {
          const hotkeyResponse = await window.desktop.vtsGetHotkeys();

          if (!cancelled) {
            setStatus(hotkeyResponse.status);
            setHotkeys(hotkeyResponse.hotkeys);
            setCatalog(hotkeyResponse.status.catalog);
            setError(hotkeyResponse.ok ? null : hotkeyResponse.message);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    status,
    hotkeys,
    catalog,
    loading,
    busyAction,
    error,
    connect,
    disconnect,
    authenticate,
    refreshStatus,
    refreshHotkeys,
    refreshCatalog,
    updateCatalogOverride,
    triggerHotkey,
  };
}
