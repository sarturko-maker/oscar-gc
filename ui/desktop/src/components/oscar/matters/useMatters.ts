// Sprint 12 (ADR-036): renderer hook over the matters IPC. Owns the list
// state; the IPC is the source of truth.

import { useCallback, useEffect, useState } from 'react';
import type { MatterEntry, NewMatterInput } from './types';

declare global {
  interface Window {
    electron: {
      matters: {
        list: (areaId: string) => Promise<MatterEntry[]>;
        get: (
          areaId: string,
          slug: string,
        ) => Promise<{ entry: MatterEntry; matter_md: string | null } | null>;
        create: (areaId: string, input: NewMatterInput) => Promise<MatterEntry>;
        bindSession: (areaId: string, slug: string, sessionId: string) => Promise<{ ok: boolean }>;
        archive: (areaId: string, slug: string) => Promise<{ ok: boolean }>;
        setActive: (
          areaId: string,
          slug: string,
        ) => Promise<{ ok: boolean; folder?: string }>;
        detachActive: () => Promise<{ ok: boolean }>;
      };
    };
  }
}

export function useMatters(areaId: string) {
  const [matters, setMatters] = useState<MatterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await window.electron.matters.list(areaId);
      setMatters(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list matters');
    } finally {
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: NewMatterInput): Promise<MatterEntry> => {
      const entry = await window.electron.matters.create(areaId, input);
      await refresh();
      return entry;
    },
    [areaId, refresh],
  );

  const archive = useCallback(
    async (slug: string): Promise<{ ok: boolean }> => {
      const r = await window.electron.matters.archive(areaId, slug);
      await refresh();
      return r;
    },
    [areaId, refresh],
  );

  return { matters, loading, error, refresh, create, archive };
}
