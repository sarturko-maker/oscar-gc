// Sprint 19 (ADR-066 D2): the sidebar's grouped tree.
//
//   Quick chats             ← only when ≥1 unscoped session exists
//   · session-name
//
//   Practice areas
//   01 Commercial           ← always-render all 13 areas
//      · Acme — MSA renewal ← nested matter rows when this area is active
//      · Globex — DPA review
//   02 Commercial Disputes
//   ...
//
// The active practice area auto-expands its matters. Other areas stay
// collapsed; navigating to /practice/:areaId expands that area.
//
// Click handlers:
//   - Area row     → navigate to /practice/:areaId
//   - Matter row   → if session_id is set, setActive (so Top of Mind is
//                    repopulated) + dispatch ADD_ACTIVE_SESSION + navigate;
//                    if no session, fall through to the area landing.
//   - Session row  → dispatch + navigate. (Quick-chat sessions only; no
//                    ToM to restore.)

import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { cn } from '../../../utils';
import { AppEvents } from '../../../constants/events';
import { useChatHistory, type ChatHistoryMatter } from './useChatHistory';
import type { Session } from '../../../api';

const sessionDisplayName = (s: Session): string =>
  s.name && s.name.trim().length > 0 ? s.name : 'Untitled session';

// Sprint 19b: cap visible matters per area at the 10 most-recent. Areas
// with more matters show a "+ N more — view all" link that navigates to
// the area landing (full list, scrollable, with grouping by stakeholder).
const MAX_VISIBLE_MATTERS_PER_AREA = 10;

export default function ChatHistoryTree() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { quickChats, areas, loading, error } = useChatHistory();

  const activeAreaId = useMemo(() => {
    const match = pathname.match(/^\/practice\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const activeSessionId = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get('resumeSessionId');
  }, [search]);

  const openSession = (sessionId: string): void => {
    window.dispatchEvent(
      new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
        detail: { sessionId, initialMessage: undefined },
      }),
    );
    navigate(`/pair?resumeSessionId=${encodeURIComponent(sessionId)}`, {
      state: { disableAnimation: true },
    });
  };

  const openMatterSession = async (
    areaId: string,
    m: ChatHistoryMatter,
  ): Promise<void> => {
    if (!m.session) {
      navigate(`/practice/${areaId}`);
      return;
    }
    try {
      // Repopulate Top of Mind for this matter (ADR-044). The session
      // already carries its recipe; resume uses the bound config.
      await window.electron.matters.setActive(areaId, m.matter.slug);
    } catch (err) {
      console.error('matters.setActive failed', err);
    }
    openSession(m.session.id);
  };

  return (
    <nav className="oscar__sidebar-list flex-1 overflow-y-auto">
      {quickChats.length > 0 && (
        <div className="oscar__sidebar-group">
          <div className="oscar__eyebrow oscar__sidebar-eyebrow">Quick chats</div>
          {quickChats.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openSession(s.id)}
              className={cn(
                'oscar__sidebar-item oscar__sidebar-item--session',
                s.id === activeSessionId && 'oscar__sidebar-item--active',
              )}
              title={sessionDisplayName(s)}
            >
              <MessageSquare className="oscar__sidebar-item-icon" size={14} />
              <span className="oscar__sidebar-item-label">
                {sessionDisplayName(s)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Sprint 21 (ADR-071): Lavern firm-mode. Sits between Quick chats
          (ephemeral, scope-less) and Practice areas (in-house work) — the
          natural conceptual progression. Single-row group; the 10-partner
          roster lives on /lavern, not inline in the sidebar. */}
      <div className="oscar__sidebar-group">
        <div className="oscar__eyebrow oscar__sidebar-eyebrow">Lavern</div>
        <Link
          to="/lavern"
          className={cn(
            'oscar__sidebar-item',
            pathname.startsWith('/lavern') && 'oscar__sidebar-item--active',
          )}
        >
          Browse partners
        </Link>
      </div>

      <div className="oscar__sidebar-group">
        <div className="oscar__eyebrow oscar__sidebar-eyebrow">Practice areas</div>
        {areas.map(({ area, matters }, idx) => {
          const isActiveArea = activeAreaId === area.id;
          const expanded = isActiveArea && matters.length > 0;
          return (
            <div key={area.id} className="oscar__sidebar-area">
              <Link
                to={`/practice/${area.id}`}
                className={cn(
                  'oscar__sidebar-item',
                  isActiveArea && 'oscar__sidebar-item--active',
                )}
              >
                <span className="oscar__sidebar-item-num">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                {area.name}
              </Link>
              {expanded && (
                <div className="oscar__sidebar-matters">
                  {matters.slice(0, MAX_VISIBLE_MATTERS_PER_AREA).map((m) => {
                    const isActiveMatter =
                      m.session?.id === activeSessionId && activeSessionId !== null;
                    return (
                      <button
                        key={m.matter.slug}
                        type="button"
                        onClick={() => void openMatterSession(area.id, m)}
                        className={cn(
                          'oscar__sidebar-item oscar__sidebar-item--matter',
                          isActiveMatter && 'oscar__sidebar-item--active',
                        )}
                        title={m.matter.name}
                      >
                        <span className="oscar__sidebar-item-matter-bullet">
                          ·
                        </span>
                        <span className="oscar__sidebar-item-label">
                          {m.matter.name}
                        </span>
                        {!m.session && (
                          <span className="oscar__sidebar-item-aside">
                            no session
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {matters.length > MAX_VISIBLE_MATTERS_PER_AREA && (
                    <Link
                      to={`/practice/${area.id}`}
                      className="oscar__sidebar-item oscar__sidebar-item--matter oscar__sidebar-item--more"
                    >
                      <span className="oscar__sidebar-item-matter-bullet">·</span>
                      <span className="oscar__sidebar-item-label">
                        + {matters.length - MAX_VISIBLE_MATTERS_PER_AREA} more
                        — view all
                      </span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading && <p className="oscar__sidebar-loading">Loading…</p>}
      {error && <p className="oscar__sidebar-error">{error}</p>}
    </nav>
  );
}
