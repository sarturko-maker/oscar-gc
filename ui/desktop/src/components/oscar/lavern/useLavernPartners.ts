// Sprint 21 (ADR-071): hook joining the static LAVERN_PARTNERS registry with
// the per-partner session-binding state file. Returns one row per partner
// with the slug → session_id binding (null if no prior conversation). The
// roster shows a "Resume" vs "Start chat" badge from this. Mirrors the
// resume-state surface useChatHistory exposes for matters, simplified for
// the partner case (no working_dir-based session-list partitioning needed).

import { useCallback, useEffect, useState } from 'react';
import { AppEvents } from '../../../constants/events';
import { LAVERN_PARTNERS, type LavernPartner } from './partners';

export interface LavernPartnerWithState {
  partner: LavernPartner;
  // Bound session_id from ~/.config/oscar/state/lavern/partners.json, or null
  // if the partner has never been opened. The roster click-handler verifies
  // the session still exists at click time (resume-or-fresh-spawn flow);
  // this binding is treated as a UX hint for the badge, not a correctness gate.
  session_id: string | null;
}

const SUBSCRIBED_EVENTS: AppEvents[] = [
  AppEvents.SESSION_CREATED,
  AppEvents.SESSION_DELETED,
  AppEvents.SESSION_RENAMED,
];

export interface UseLavernPartnersResult {
  partners: LavernPartnerWithState[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLavernPartners(): UseLavernPartnersResult {
  const [states, setStates] = useState<Record<string, { session_id: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await window.electron.lavern.listPartnerStates();
      setStates(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner states');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (): void => {
      void refresh();
    };
    for (const ev of SUBSCRIBED_EVENTS) {
      window.addEventListener(ev, onChange);
    }
    return () => {
      for (const ev of SUBSCRIBED_EVENTS) {
        window.removeEventListener(ev, onChange);
      }
    };
  }, [refresh]);

  const partners: LavernPartnerWithState[] = LAVERN_PARTNERS.map((p) => ({
    partner: p,
    session_id: states[p.slug]?.session_id ?? null,
  }));

  return { partners, loading, error, refresh };
}
