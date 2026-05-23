// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sprint 21 (ADR-071) + Sprint 24-A rebrand (ADR-078) + Sprint 27 (ADR-092):
// Oscar LLP firm-mode roster at /oscar-llp. Per partner: header (name +
// specialism + blurb), an inline session list (top N visible, scrollable
// beyond), and a "+ New chat" affordance.
//
// Click semantics (ADR-092):
//   - Click partner header  → resume sessions[0] (most-recent); fall through
//                              to fresh-spawn if sessions[] empty or the
//                              most-recent session was deleted server-side.
//   - Click "+ New chat"    → always fresh createSession + prepend to
//                              sessions[] via llp.bindSession.
//   - Click session row     → resume that specific session.
//
// All three paths share the same matters.detachActive() + llp.ensureDir()
// preamble; the resume-on-existing dance mirrors MattersLanding.openMatter
// (lines 121-138 of MattersLanding.tsx).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../../../sessions';
import { AppEvents } from '../../../constants/events';
import { errorMessage } from '../../../utils/conversionUtils';
import { getSession } from '../../../api';
import { useConfig } from '../../ConfigContext';
import { useOscarProfile } from '../hooks/useOscarProfile';
import { deriveEnabledPlatformExtensions } from '../recipe/enabledPlatformExtensions';
import { buildOscarLLPPartnerRecipe } from './buildOscarLLPPartnerRecipe';
import {
  useOscarLLPPartners,
  type OscarLLPPartnerWithState,
  type OscarLLPSessionRow,
} from './useOscarLLPPartners';
import type { OscarLLPPartner } from './partners';

const MAX_VISIBLE_SESSIONS = 5;

// Ported from ChatHistorySearch.tsx:41-54. Inline-copy per CLAUDE.md
// (no premature abstraction); extract to src/utils/date.ts if a third call
// site appears.
function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Sprint 27 label fallback chain (ADR-092): user-set label in partners.json
// → goosed Session.name (auto-emitted, typically first-message-derived) →
// "Session <date>". Recipe.title is identical for all sessions of one
// partner so it's useless as a per-session disambiguator.
function labelOf(s: OscarLLPSessionRow): string {
  if (s.label && s.label.trim().length > 0) return s.label;
  if (s.name && s.name.trim().length > 0) return s.name;
  return `Session ${new Date(s.created_at).toLocaleDateString()}`;
}

export default function OscarLLPRoster() {
  const navigate = useNavigate();
  const config = useConfig();
  const { profile } = useOscarProfile();
  const { partners, loading, error, refresh } = useOscarLLPPartners();
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const provisionPartnerDir = async (partner: OscarLLPPartner): Promise<string> => {
    await window.electron.matters.detachActive();
    const { ok, path: workingDir } = await window.electron.llp.ensureDir(partner.slug);
    if (!ok || !workingDir) {
      throw new Error('Failed to provision partner working directory');
    }
    return workingDir;
  };

  const navigateToSession = (sessionId: string): void => {
    window.dispatchEvent(
      new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
        detail: { sessionId, initialMessage: undefined },
      }),
    );
    navigate(`/pair?resumeSessionId=${encodeURIComponent(sessionId)}`, {
      state: { disableAnimation: true },
    });
  };

  const newChat = async (partner: OscarLLPPartner): Promise<void> => {
    setOpening(partner.slug);
    setOpenError(null);
    try {
      const workingDir = await provisionPartnerDir(partner);
      const enabledPlatformExtensions = deriveEnabledPlatformExtensions(config.extensionsList);
      const recipe = buildOscarLLPPartnerRecipe({
        partner,
        workingDir,
        resourcesRoot: window.electron.oscarResourcesRoot,
        user: profile?.user ?? null,
        corporate: profile?.corporate ?? null,
        companyContext: profile?.company_context ?? null,
        enabledPlatformExtensions,
      });
      const session = await createSession(workingDir, { recipe });
      await window.electron.llp.bindSession(partner.slug, session.id);
      navigateToSession(session.id);
      void refresh();
    } catch (err) {
      setOpenError(errorMessage(err, 'Failed to open partner session'));
      setOpening(null);
    }
  };

  const resumeSession = async (
    partner: OscarLLPPartner,
    session: OscarLLPSessionRow,
  ): Promise<void> => {
    setOpening(partner.slug);
    setOpenError(null);
    try {
      await provisionPartnerDir(partner);
      const existing = await getSession({
        path: { session_id: session.id },
        throwOnError: false,
      });
      if (!existing.data) {
        // Session deleted server-side; fall through to fresh spawn so the
        // user's click doesn't dead-end. The stale entry will get filtered
        // out on next refresh once the registry is rewritten.
        return await newChat(partner);
      }
      navigateToSession(session.id);
    } catch (err) {
      setOpenError(errorMessage(err, 'Failed to resume session'));
      setOpening(null);
    }
  };

  const openCard = (row: OscarLLPPartnerWithState): Promise<void> => {
    const mostRecent = row.sessions[0];
    if (mostRecent) {
      return resumeSession(row.partner, mostRecent);
    }
    return newChat(row.partner);
  };

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 min-h-0 py-12">
        <div className="oscar__eyebrow">Oscar LLP</div>
        <h1 className="oscar__matters-title">Partners</h1>
        <p className="oscar__matters-body">
          Consult one of Oscar LLP's specialist partners alongside your in-house practice. Each
          partner has their own memory and their own posture — pick the right specialism for the
          question on your mind.
        </p>

        {loading && <p className="oscar__matters-empty mt-8">Loading partners…</p>}
        {!loading && error && <p className="oscar__matters-error mt-8">{error}</p>}

        {!loading && !error && (
          <div className="oscar__matters-list flex flex-col mt-6 overflow-y-auto min-h-0">
            {/* Sprint 24-B (ADR-079): Lavern Pipeline launcher above the
                10 partner cards. Pipeline is firm-level work — Oscar LLP's
                case team running a multi-stage review — so it sits next to
                the partners, not in a separate sidebar group. */}
            <button
              type="button"
              onClick={() => navigate('/oscar-llp/pipeline')}
              className="oscar__matter-row w-full text-left flex items-center justify-between gap-4 py-4 px-2 transition-colors"
            >
              <div className="flex flex-col min-w-0">
                <span className="oscar__matter-row-name truncate">
                  Lavern Pipeline (multi-stage contract review)
                </span>
                <div className="oscar__matter-row-meta">
                  Run Watchman → Reader → Curator on documents. Multi-doc surfaces cross-document patterns.
                </div>
              </div>
              <div className="oscar__matter-row-time">Run</div>
            </button>
            {partners.map((row) => (
              <OscarLLPPartnerCard
                key={row.partner.slug}
                row={row}
                opening={opening === row.partner.slug}
                onOpenCard={openCard}
                onNewChat={newChat}
                onResumeSession={resumeSession}
              />
            ))}
          </div>
        )}

        {opening && <p className="oscar__matters-opening mt-4">Opening {opening}…</p>}
        {openError && <p className="oscar__matters-error mt-4">{openError}</p>}
      </div>
    </div>
  );
}

interface OscarLLPPartnerCardProps {
  row: OscarLLPPartnerWithState;
  opening: boolean;
  onOpenCard: (row: OscarLLPPartnerWithState) => void;
  onNewChat: (partner: OscarLLPPartner) => void;
  onResumeSession: (partner: OscarLLPPartner, session: OscarLLPSessionRow) => void;
}

function OscarLLPPartnerCard({
  row,
  opening,
  onOpenCard,
  onNewChat,
  onResumeSession,
}: OscarLLPPartnerCardProps) {
  const visible = row.sessions.slice(0, MAX_VISIBLE_SESSIONS);
  const overflow = row.sessions.length - visible.length;
  return (
    <div className="oscar__llp-card">
      <button
        type="button"
        onClick={() => onOpenCard(row)}
        disabled={opening}
        className="oscar__matter-row oscar__llp-card-header w-full text-left flex items-center justify-between gap-4 py-4 px-2 transition-colors"
      >
        <div className="flex flex-col min-w-0">
          <span className="oscar__matter-row-name truncate">
            {row.partner.name} ({row.partner.specialism})
          </span>
          <div className="oscar__matter-row-meta">{row.partner.blurb}</div>
        </div>
      </button>

      <div className="oscar__llp-sessions">
        <button
          type="button"
          onClick={() => onNewChat(row.partner)}
          disabled={opening}
          className="oscar__llp-new-chat"
        >
          + New chat with {row.partner.name}
        </button>
        {row.sessions.length === 0 && (
          <div className="oscar__llp-no-sessions">No prior conversations</div>
        )}
        {visible.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onResumeSession(row.partner, s)}
            disabled={opening}
            className="oscar__llp-session-row"
          >
            <span className="oscar__llp-session-label truncate">· {labelOf(s)}</span>
            <span className="oscar__llp-session-time">{formatRelative(s.updated_at)}</span>
          </button>
        ))}
        {overflow > 0 && (
          <div className="oscar__llp-overflow">…{overflow} more</div>
        )}
      </div>
    </div>
  );
}
