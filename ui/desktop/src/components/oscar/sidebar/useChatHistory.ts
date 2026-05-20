// Sprint 19 (ADR-066 D2): joins three data sources to produce the
// sidebar's PA → Matter → Session tree plus a Quick chats group.
//
//   listSessions()         → all sessions (filter in renderer; native query
//                            ordered by updated_at DESC).
//   matters.list(areaId)   → matter registry per area (parallel × 13).
//   quickChats.getDir()    → the absolute working_dir prefix that
//                            identifies an unscoped session.
//
// Refreshes on SESSION_CREATED / DELETED / RENAMED / FORKED so the
// sidebar follows the live state without a parent re-render.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listSessions, type Session } from '../../../api';
import { AppEvents } from '../../../constants/events';
import { usePracticeAreas } from '../hooks/usePracticeAreas';
import type { PracticeArea } from '../practiceAreas';
import type { MatterEntry } from '../matters/types';

export interface ChatHistoryMatter {
  matter: MatterEntry;
  session: Session | null;
}

export interface ChatHistoryArea {
  area: PracticeArea;
  matters: ChatHistoryMatter[];
}

export interface ChatHistory {
  quickChats: Session[];
  areas: ChatHistoryArea[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const SUBSCRIBED_EVENTS: AppEvents[] = [
  AppEvents.SESSION_CREATED,
  AppEvents.SESSION_DELETED,
  AppEvents.SESSION_RENAMED,
  AppEvents.SESSION_FORKED,
];

export function useChatHistory(): ChatHistory {
  const areas = usePracticeAreas();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matterByArea, setMatterByArea] = useState<Record<string, MatterEntry[]>>(
    {},
  );
  const [quickChatsDir, setQuickChatsDir] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [sessionsResp, dir, ...matterLists] = await Promise.all([
        listSessions({ throwOnError: false }),
        window.electron.quickChats.getDir(),
        ...areas.map((a) => window.electron.matters.list(a.id)),
      ]);
      const list: Session[] = sessionsResp.data?.sessions ?? [];
      const byArea: Record<string, MatterEntry[]> = {};
      areas.forEach((a, i) => {
        byArea[a.id] = matterLists[i] as MatterEntry[];
      });
      setSessions(list);
      setMatterByArea(byArea);
      setQuickChatsDir(dir);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('useChatHistory refresh failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [areas]);

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

  const { quickChats, areaTree } = useMemo(() => {
    // Sprint 19 (ADR-066 D2): partition sessions by working_dir prefix.
    // A quick-chat is one whose working_dir is the dedicated scratch dir
    // (exact match handles the OSCAR_QUICK_CHATS_DIR root; startsWith
    // catches sub-paths if anything ever lands there).
    const qcPrefix = quickChatsDir;
    const sessionById = new Map<string, Session>();
    for (const s of sessions) sessionById.set(s.id, s);

    const quickChatsList: Session[] = qcPrefix
      ? sessions.filter(
          (s) =>
            s.working_dir === qcPrefix ||
            s.working_dir.startsWith(qcPrefix + '/'),
        )
      : [];
    // Most-recent first.
    quickChatsList.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    const tree: ChatHistoryArea[] = areas.map((area) => {
      const matters = matterByArea[area.id] ?? [];
      // Mirror MattersLanding's ordering: most-recently-accessed first.
      const sorted = [...matters].sort((a, b) =>
        b.last_accessed_at.localeCompare(a.last_accessed_at),
      );
      const rows: ChatHistoryMatter[] = sorted.map((matter) => ({
        matter,
        session: matter.session_id ? sessionById.get(matter.session_id) ?? null : null,
      }));
      return { area, matters: rows };
    });

    return { quickChats: quickChatsList, areaTree: tree };
  }, [sessions, matterByArea, quickChatsDir, areas]);

  return {
    quickChats,
    areas: areaTree,
    loading,
    error,
    refresh: () => void refresh(),
  };
}
