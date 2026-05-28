// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Tabular Review full-window surface (Sprint 35, ADR-113): one screen with the
// grid (centre), a cell→source citation drill, and the SAME matter agent as a
// docked chat rail. Mounted as a bare route OUTSIDE AppLayout so the split owns
// the whole window. The grid and the rail share NO React state — the on-disk
// manifest is the single source of truth (ADR-111): the rail's agent writes it
// via the oscar-tabular MCP; the grid re-reads it on a 2 s poll.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatProvider, DEFAULT_CHAT_TITLE } from '../../../contexts/ChatContext';
import BaseChat from '../../BaseChat';
import { ChatType } from '../../../types/chat';
import { TabularGrid, type SelectedCell } from './TabularGrid';
import { SourceDrawer } from './SourceDrawer';
import { useManifestPoll } from './useManifestPoll';
import { summaryChips } from './cellState';

export default function TabularReviewView() {
  const [params] = useSearchParams();
  const areaId = params.get('areaId');
  const slug = params.get('slug');
  const reviewId = params.get('reviewId');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [chat, setChat] = useState<ChatType>({
    sessionId: '',
    name: DEFAULT_CHAT_TITLE,
    messages: [],
    recipe: null,
  });

  // Activate the matter (sets OSCAR_MATTER_DIR + Top of Mind so the rail's agent
  // and the MCP point at this matter) and resolve its bound chat session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!areaId || !slug) {
        setResolving(false);
        return;
      }
      await window.electron.matters.setActive(areaId, slug);
      const got = await window.electron.matters.get(areaId, slug);
      if (cancelled) return;
      setSessionId(got?.entry.session_id ?? null);
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [areaId, slug]);

  const { manifest } = useManifestPoll(areaId, slug, reviewId);
  const chips = useMemo(() => (manifest ? summaryChips(manifest.summary) : []), [manifest]);

  if (!areaId || !slug || !reviewId) {
    return <div className="oscar oscar__tabular-empty">Missing review coordinates.</div>;
  }

  return (
    <ChatProvider chat={chat} setChat={setChat} contextKey="tabular">
      <div className="oscar oscar__tabular-shell">
        <header className="oscar__tabular-header">
          <div>
            <div className="oscar__tabular-eyebrow">Tabular Review</div>
            <h1 className="oscar__tabular-h1">{manifest?.title ?? 'Loading review…'}</h1>
          </div>
          <div className="oscar__tabular-chips">
            {chips.map((c) => (
              <span key={c.label} className="oscar__tabular-chip" style={{ color: c.color }}>
                <span className="oscar__tabular-chip-n">{c.n}</span> {c.label}
              </span>
            ))}
          </div>
        </header>

        <div className="oscar__tabular-body">
          <main className="oscar__tabular-grid-pane">
            {manifest ? (
              <TabularGrid manifest={manifest} selected={selected} onCellClick={(documentId, columnId) => setSelected({ documentId, columnId })} />
            ) : (
              <div className="oscar__tabular-empty">No review on disk yet, or it is still being created.</div>
            )}
          </main>

          {manifest && selected && (
            <SourceDrawer areaId={areaId} slug={slug} manifest={manifest} selected={selected} onClose={() => setSelected(null)} />
          )}

          <div className="oscar__tabular-rail">
            {resolving ? (
              <div className="oscar__tabular-empty">Opening the matter agent…</div>
            ) : sessionId ? (
              <BaseChat setChat={setChat} sessionId={sessionId} isActiveSession suppressEmptyState={false} />
            ) : (
              <div className="oscar__tabular-empty">
                This matter has no open chat session. Open the matter from its page to start one, then
                reopen the review.
              </div>
            )}
          </div>
        </div>
      </div>
    </ChatProvider>
  );
}
