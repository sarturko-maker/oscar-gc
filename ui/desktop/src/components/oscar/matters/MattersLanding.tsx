// Sprint 12 (ADRs 036, 038, 041, 044), Sprint 14 (ADR-047): practice-area
// landing — list of matters + new-matter affordance. Now passes `area` (not
// just name) to the dialog so per-area shape can drive the form, and groups
// matter rows by stakeholder header (controlled-vocab tag).

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../../../sessions';
import { AppEvents } from '../../../constants/events';
import { errorMessage } from '../../../utils/conversionUtils';
import { buildCommercialRecipe } from '../commercial/commercialRecipe';
import { buildPracticeAreaRecipe } from '../recipe/buildPracticeAreaRecipe';
import { resolveTavilyKey } from '../onboarding/resolveTavilyKey';
import type { PracticeArea } from '../practiceAreas';
import { useMatters } from './useMatters';
import MatterRow from './MatterRow';
import NewMatterDialog from './NewMatterDialog';
import { getPracticeAreaShape } from './practiceAreaShapes';
import type { MatterEntry, NewMatterInput } from './types';

interface MattersLandingProps {
  area: PracticeArea;
}

interface StakeholderGroup {
  label: string; // display label; null-stakeholder bucket → "Other"
  isOther: boolean;
  matters: MatterEntry[];
}

const groupByStakeholder = (matters: MatterEntry[]): StakeholderGroup[] => {
  const buckets = new Map<string, { label: string; isOther: boolean; matters: MatterEntry[] }>();
  for (const m of matters) {
    const key = m.stakeholder ? m.stakeholder.toLowerCase() : '__other__';
    const label = m.stakeholder ?? 'Other';
    const isOther = !m.stakeholder;
    if (!buckets.has(key)) buckets.set(key, { label, isOther, matters: [] });
    buckets.get(key)!.matters.push(m);
  }
  const groups = Array.from(buckets.values());
  // Order: most-recently-accessed within each bucket, then groups by their
  // most-recently-accessed matter, with the "Other" bucket last.
  for (const g of groups) {
    g.matters.sort((a, b) => b.last_accessed_at.localeCompare(a.last_accessed_at));
  }
  groups.sort((a, b) => {
    if (a.isOther !== b.isOther) return a.isOther ? 1 : -1;
    const aTop = a.matters[0]?.last_accessed_at ?? '';
    const bTop = b.matters[0]?.last_accessed_at ?? '';
    return bTop.localeCompare(aTop);
  });
  return groups;
};

export default function MattersLanding({ area }: MattersLandingProps) {
  const navigate = useNavigate();
  const { matters, loading, error, create } = useMatters(area.id);
  const [showNew, setShowNew] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const groups = useMemo(() => groupByStakeholder(matters), [matters]);
  const shape = getPracticeAreaShape(area.id);

  // Sprint 14: stakeholder autocomplete source — prior values in this area,
  // case-insensitive deduped.
  const stakeholderSuggestions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of matters) {
      if (m.stakeholder) seen.set(m.stakeholder.toLowerCase(), m.stakeholder);
    }
    return Array.from(seen.values()).sort();
  }, [matters]);

  const openMatter = async (matter: MatterEntry): Promise<void> => {
    setOpening(matter.slug);
    setOpenError(null);
    try {
      const active = await window.electron.matters.setActive(area.id, matter.slug);
      if (!active.ok || !active.working_dir || !active.state_folder) {
        throw new Error('Failed to activate matter');
      }
      const { working_dir: workingDir, state_folder: stateFolder } = active;
      const resourcesRoot = window.electron.oscarResourcesRoot;
      // Sprint 15 (ADR-052): hosted Tavily SSE attached when configured.
      const tavily = await resolveTavilyKey();

      // Commercial composes its bespoke system prompt + redline MCP on top
      // via buildCommercialRecipe; the other 12 areas use the generic shape.
      const recipe =
        area.id === 'commercial'
          ? buildCommercialRecipe(workingDir, stateFolder, resourcesRoot, tavily)
          : buildPracticeAreaRecipe({
              area,
              workingDir,
              stateFolder,
              matterSlug: matter.slug,
              resourcesRoot,
              tavily,
            });

      const session = await createSession(workingDir, { recipe });

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
            {groups.map((g) => (
              <div key={g.label} className="oscar__matters-group">
                <div
                  className={
                    g.isOther
                      ? 'oscar__matters-group-header oscar__matters-group-header--other'
                      : 'oscar__matters-group-header'
                  }
                >
                  {g.label}
                  <span className="oscar__matters-group-count">
                    {g.matters.length}
                  </span>
                </div>
                {g.matters.map((m) => (
                  <MatterRow
                    key={m.slug}
                    matter={m}
                    onOpen={(mt) => void openMatter(mt)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {opening && <p className="oscar__matters-opening">Opening {opening}…</p>}
        {openError && <p className="oscar__matters-error">{openError}</p>}
      </div>

      {showNew && shape && (
        <NewMatterDialog
          area={area}
          shape={shape}
          stakeholderSuggestions={stakeholderSuggestions}
          onCancel={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
      {showNew && !shape && (
        <div className="oscar__modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="oscar__modal" onClick={(e) => e.stopPropagation()}>
            <p className="oscar__field-error">
              No matter-intake shape registered for area "{area.id}".
            </p>
            <div className="oscar__modal-actions">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="oscar__button oscar__button--ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
