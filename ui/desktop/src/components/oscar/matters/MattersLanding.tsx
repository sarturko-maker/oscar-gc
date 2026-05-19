// Sprint 12 (ADRs 036, 038, 041, 044): practice-area landing — list of
// matters + new-matter affordance. Replaces the placeholder body in
// PracticeAreaPlaceholder.tsx for every practice area uniformly.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../../../sessions';
import { AppEvents } from '../../../constants/events';
import { errorMessage } from '../../../utils/conversionUtils';
import { buildCommercialRecipe } from '../commercial/commercialRecipe';
import { buildPracticeAreaRecipe } from '../recipe/buildPracticeAreaRecipe';
import type { PracticeArea } from '../practiceAreas';
import { useMatters } from './useMatters';
import MatterRow from './MatterRow';
import NewMatterDialog from './NewMatterDialog';
import type { MatterEntry, NewMatterInput } from './types';

interface MattersLandingProps {
  area: PracticeArea;
}

export default function MattersLanding({ area }: MattersLandingProps) {
  const navigate = useNavigate();
  const { matters, loading, error, create } = useMatters(area.id);
  const [showNew, setShowNew] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const openMatter = async (matter: MatterEntry): Promise<void> => {
    setOpening(matter.slug);
    setOpenError(null);
    try {
      const active = await window.electron.matters.setActive(area.id, matter.slug);
      if (!active.ok || !active.folder) {
        throw new Error('Failed to activate matter');
      }
      const matterFolder = active.folder;
      const resourcesRoot = window.electron.oscarResourcesRoot;

      // Sprint 12 Phase 4 (ADR-041): every area uses the generic builder for
      // oscar-fs (scoped to the matter folder). Commercial composes its
      // bespoke system prompt + redline MCP on top via buildCommercialRecipe.
      const recipe =
        area.id === 'commercial'
          ? buildCommercialRecipe(matterFolder, resourcesRoot)
          : buildPracticeAreaRecipe({
              area,
              matterFolder,
              matterSlug: matter.slug,
              resourcesRoot,
            });

      const session = await createSession(matterFolder, { recipe });

      if (matter.session_id !== session.id) {
        await window.electron.matters.bindSession(area.id, matter.slug, session.id);
      }

      window.dispatchEvent(
        new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
          detail: { sessionId: session.id, initialMessage: undefined },
        }),
      );
      navigate(`/pair?resumeSessionId=${encodeURIComponent(session.id)}`, {
        state: { disableAnimation: true },
      });
    } catch (err) {
      setOpenError(errorMessage(err, 'Failed to open matter'));
      setOpening(null);
    }
  };

  const handleCreate = async (input: NewMatterInput): Promise<void> => {
    const entry = await create(input);
    setShowNew(false);
    await openMatter(entry);
  };

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 min-h-0 py-12">
        <div className="oscar__eyebrow">{area.name}</div>
        <h1 className="oscar__matters-title">Matters</h1>
        <p className="oscar__matters-body">{area.body}</p>

        <div className="oscar__matters-actions mt-6 mb-4">
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="oscar__button oscar__button--primary"
          >
            New matter
          </button>
        </div>

        {loading && <p className="oscar__matters-empty">Loading matters…</p>}
        {!loading && error && <p className="oscar__matters-error">{error}</p>}
        {!loading && !error && matters.length === 0 && (
          <p className="oscar__matters-empty">
            No matters yet in {area.name}. Start by creating one.
          </p>
        )}

        {!loading && matters.length > 0 && (
          <div className="oscar__matters-list flex flex-col mt-2 overflow-y-auto min-h-0">
            {matters.map((m) => (
              <MatterRow key={m.slug} matter={m} onOpen={(mt) => void openMatter(mt)} />
            ))}
          </div>
        )}

        {opening && <p className="oscar__matters-opening">Opening {opening}…</p>}
        {openError && <p className="oscar__matters-error">{openError}</p>}
      </div>

      {showNew && (
        <NewMatterDialog
          areaName={area.name}
          onCancel={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
