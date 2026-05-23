// Sprint 21 (ADR-071) + Sprint 24-A rebrand (ADR-078) + Sprint 27 (ADR-092):
// hook joining the static OSCAR_LLP_PARTNERS registry with both the per-partner
// session-array binding (~/.config/oscar/state/oscar-llp/partners.json, owned
// by main.ts) and the goosed Session list (id → metadata). v1 entries migrate
// lazily at read-time in main.ts; this hook only sees v2 shape.
//
// Returns one row per partner with the resolved session list, sorted by
// Session.updated_at DESC. Sessions that no longer exist server-side
// (deleted out-of-band) drop out of the list silently. The roster click
// handler still verifies the session at click time before dispatching
// resume-on-existing — this hook's join is a UX hint, not a correctness gate.

import { useCallback, useEffect, useState } from 'react';
import { listSessions } from '../../../api';
import type { Session } from '../../../api';
import { AppEvents } from '../../../constants/events';
import { OSCAR_LLP_PARTNERS, type OscarLLPPartner } from './partners';

export interface OscarLLPSessionRow {
  id: string;
  label: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  user_set_name: boolean;
}

export interface OscarLLPPartnerWithState {
  partner: OscarLLPPartner;
  sessions: OscarLLPSessionRow[];
}

const SUBSCRIBED_EVENTS: AppEvents[] = [
  AppEvents.SESSION_CREATED,
  AppEvents.SESSION_DELETED,
  AppEvents.SESSION_RENAMED,
  AppEvents.SESSION_FORKED,
];

export interface UseOscarLLPPartnersResult {
  partners: OscarLLPPartnerWithState[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOscarLLPPartners(): UseOscarLLPPartnersResult {
  const [partners, setPartners] = useState<OscarLLPPartnerWithState[]>(() =>
    OSCAR_LLP_PARTNERS.map((p) => ({ partner: p, sessions: [] })),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [states, sessionsResp] = await Promise.all([
        window.electron.llp.listPartnerStates(),
        listSessions({ throwOnError: false }),
      ]);
      const sessionMap = new Map<string, Session>();
      for (const s of sessionsResp.data?.sessions ?? []) {
        sessionMap.set(s.id, s);
      }
      const rows: OscarLLPPartnerWithState[] = OSCAR_LLP_PARTNERS.map((p) => {
        const entries = states[p.slug]?.sessions ?? [];
        const resolved: OscarLLPSessionRow[] = [];
        for (const entry of entries) {
          const meta = sessionMap.get(entry.id);
          if (!meta) continue;
          resolved.push({
            id: entry.id,
            label: entry.label,
            name: meta.name,
            created_at: meta.created_at,
            updated_at: meta.updated_at,
            user_set_name: meta.user_set_name ?? false,
          });
        }
        resolved.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        return { partner: p, sessions: resolved };
      });
      setPartners(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner sessions');
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

  return { partners, loading, error, refresh };
}
