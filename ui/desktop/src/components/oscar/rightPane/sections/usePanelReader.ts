// Sprint 20-M3 (ADR-083): polled-fetch hook for right-pane section bodies.
// Mirrors useOscarProfile's opt-in pollMs shape but kept separate so the
// profile hook's contract doesn't widen. Re-runs when deps change; halts
// on unmount; late returns are dropped so a slow fetch can't overwrite a
// later one.

import { useEffect, useRef, useState, type DependencyList } from 'react';

const DEFAULT_POLL_MS = 2000;

export interface UsePanelReaderOptions {
  pollMs?: number;
}

export interface UsePanelReaderResult<T> {
  data: T | null;
  error: Error | null;
}

export function usePanelReader<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options?: UsePanelReaderOptions,
): UsePanelReaderResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;

  useEffect(() => {
    let active = true;

    const tick = async () => {
      try {
        const next = await fetcherRef.current();
        if (!active) return;
        setData(next);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), pollMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
    // deps is the caller-supplied dependency list — the lint rule can't
    // verify it, but that's exactly the hook's contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, pollMs]);

  return { data, error };
}
