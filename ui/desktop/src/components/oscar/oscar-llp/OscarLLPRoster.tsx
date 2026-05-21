// Sprint 21 (ADR-071) + Sprint 24-A rebrand (ADR-078): Oscar LLP firm-mode
// roster page. Mounted at /oscar-llp. Lists the 10 partner cards labeled
// "[Name] ([Specialism])"; each card's click handler mirrors
// MattersLanding.openMatter resume-on-existing pattern:
//   1. matters.detachActive()           — clear Top of Mind (partners are not matters)
//   2. llp.ensureDir(slug)              — ~/Documents/Oscar GC/Oscar LLP/<slug>/
//   3. llp.lookupState(slug)            — if bound session_id + still exists, resume
//   4. else buildOscarLLPPartnerRecipe → createSession → llp.bindSession
//   5. dispatch ADD_ACTIVE_SESSION + navigate /pair?resumeSessionId=…

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
import { useOscarLLPPartners, type OscarLLPPartnerWithState } from './useOscarLLPPartners';
import type { OscarLLPPartner } from './partners';

export default function OscarLLPRoster() {
  const navigate = useNavigate();
  const config = useConfig();
  const { profile } = useOscarProfile();
  const { partners, loading, error, refresh } = useOscarLLPPartners();
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const openPartner = async (partner: OscarLLPPartner): Promise<void> => {
    setOpening(partner.slug);
    setOpenError(null);
    try {
      // Partners are not matters. Detach the active matter so Top of Mind
      // is empty for the partner session (mirrors Forge + Quick chats).
      await window.electron.matters.detachActive();

      const { ok, path: workingDir } = await window.electron.llp.ensureDir(partner.slug);
      if (!ok || !workingDir) {
        throw new Error('Failed to provision partner working directory');
      }

      // Resume-on-existing: if a session is already bound AND still exists
      // server-side, navigate to it without rebuilding the recipe. Same
      // pattern as MattersLanding.openMatter:121-138.
      const state = await window.electron.llp.lookupState(partner.slug);
      if (state?.session_id) {
        const existing = await getSession({
          path: { session_id: state.session_id },
          throwOnError: false,
        });
        if (existing.data) {
          window.dispatchEvent(
            new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
              detail: {
                sessionId: state.session_id,
                initialMessage: undefined,
              },
            })
          );
          navigate(`/pair?resumeSessionId=${encodeURIComponent(state.session_id)}`, {
            state: { disableAnimation: true },
          });
          return;
        }
      }

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
      window.dispatchEvent(
        new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
          detail: { sessionId: session.id, initialMessage: undefined },
        })
      );
      navigate(`/pair?resumeSessionId=${encodeURIComponent(session.id)}`, {
        state: { disableAnimation: true },
      });
      // Keep the roster's badge in sync for the next visit; harmless if the
      // SESSION_CREATED listener has already fired.
      void refresh();
    } catch (err) {
      setOpenError(errorMessage(err, 'Failed to open partner session'));
      setOpening(null);
    }
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
              <OscarLLPPartnerRow
                key={row.partner.slug}
                row={row}
                opening={opening === row.partner.slug}
                onOpen={openPartner}
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

interface OscarLLPPartnerRowProps {
  row: OscarLLPPartnerWithState;
  opening: boolean;
  onOpen: (partner: OscarLLPPartner) => void;
}

function OscarLLPPartnerRow({ row, opening, onOpen }: OscarLLPPartnerRowProps) {
  const status = row.session_id ? 'Resume' : 'Start chat';
  // Reuses the matter-row CSS family (Sprint 12+ pattern at MatterRow.tsx);
  // the partner card has the same visual shape as a matter card so the two
  // surfaces feel like siblings, not different products.
  return (
    <button
      type="button"
      onClick={() => onOpen(row.partner)}
      disabled={opening}
      className="oscar__matter-row w-full text-left flex items-center justify-between gap-4 py-4 px-2 transition-colors"
    >
      <div className="flex flex-col min-w-0">
        <span className="oscar__matter-row-name truncate">
          {row.partner.name} ({row.partner.specialism})
        </span>
        <div className="oscar__matter-row-meta">{row.partner.blurb}</div>
      </div>
      <div className="oscar__matter-row-time">{status}</div>
    </button>
  );
}
