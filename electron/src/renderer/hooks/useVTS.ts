import { useEffect, useState, useCallback } from "react";
import { z } from "zod";

const VtsHotkeySchema = z.object({
  hotkeyID: z.string(),
  name: z.string(),
  type: z.string(),
});

export type VtsHotkey = z.infer<typeof VtsHotkeySchema>;

interface UseVtsReturn {
  hotkeys: VtsHotkey[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useVTS(): UseVtsReturn {
  const [hotkeys, setHotkeys] = useState<VtsHotkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHotkeys = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await window.desktop?.getHotkeys();

      if (!response) {
        throw new Error("No response from getHotkeys");
      }

      const parsed = z.array(VtsHotkeySchema).parse(response);
      setHotkeys(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error fetching hotkeys";
      setError(message);
      setHotkeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHotkeys();
  }, [fetchHotkeys]);

  const refetch = useCallback(() => {
    fetchHotkeys();
  }, [fetchHotkeys]);

  return { hotkeys, loading, error, refetch };
}
