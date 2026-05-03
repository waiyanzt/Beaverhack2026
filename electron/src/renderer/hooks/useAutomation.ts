import { useCallback, useState } from "react";
import type { AutomationAnalyzeNowResult } from "../../shared/types/action-plan.types";

interface UseAutomationState {
  busy: boolean;
  lastResult: AutomationAnalyzeNowResult | null;
  runAutomation: (transcript?: string, dryRun?: boolean) => Promise<void>;
}

export function useAutomation(): UseAutomationState {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<AutomationAnalyzeNowResult | null>(null);

  const runAutomation = useCallback(async (transcript?: string, dryRun = false) => {
    setBusy(true);

    try {
      const result = await window.desktop.automationAnalyzeNow({
        transcript: transcript?.trim() ? transcript.trim() : undefined,
        dryRun,
      });
      setLastResult(result);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    busy,
    lastResult,
    runAutomation,
  };
}
