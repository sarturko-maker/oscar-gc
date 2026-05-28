// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Live coupling between the grid and the agent's writes (Sprint 35, ADR-111):
// the agent (via the oscar-tabular MCP) rewrites manifest.json; this hook
// re-reads it every 2 s and re-renders. Disk is the single source of truth — no
// shared React state with the chat rail. Re-render is gated on `updated_at` so a
// large grid does not reconcile every tick when nothing changed. Mirrors the
// right-pane usePanelReader poll pattern.

import { useEffect, useRef, useState, useCallback } from 'react';
import { isManifest, type Manifest } from './types';

const POLL_MS = 2000;

export function useManifestPoll(
  areaId: string | null,
  slug: string | null,
  reviewId: string | null,
): { manifest: Manifest | null; refresh: () => void } {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const lastUpdatedRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (!areaId || !slug || !reviewId || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const raw = await window.electron.tabular.readManifest(areaId, slug, reviewId);
      if (!isManifest(raw)) return;
      if (raw.updated_at !== lastUpdatedRef.current) {
        lastUpdatedRef.current = raw.updated_at;
        setManifest(raw);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [areaId, slug, reviewId]);

  useEffect(() => {
    lastUpdatedRef.current = null;
    setManifest(null);
    void fetchOnce();
    const id = setInterval(() => void fetchOnce(), POLL_MS);
    return () => clearInterval(id);
  }, [fetchOnce]);

  return { manifest, refresh: () => void fetchOnce() };
}
