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
import { deriveEnabledPlatformExtensions } from '../recipe/enabledPlatformExtensions';
import { buildExtensionFromIntegration } from '../integrations/buildExtensionFromIntegration';
import { ensureRecipeSecrets } from '../onboarding/ensureRecipeSecrets';
import RecipeSecretsModal from '../onboarding/RecipeSecretsModal';
import { useConfig } from '../../ConfigContext';
import type { Recipe } from '../../../api';
import type { PracticeArea } from '../practiceAreas';
import type {
  OscarCompanyContext,
  OscarUserProfile,
} from '../hooks/useOscarProfile';
import { useMatters } from './useMatters';
import MatterRow from './MatterRow';
import NewMatterDialog from './NewMatterDialog';
import { getPracticeAreaShape } from './practiceAreaShapes';
import type { MatterEntry, NewMatterInput } from './types';

// Sprint 17 (P6): pending-spawn state when ensureRecipeSecrets reports a
// missing key. The lawyer needs to satisfy the gate (Save / Skip in
// RecipeSecretsModal) before createSession fires. For the Sprint 17 seed
// every integration has env_keys: [] so this state stays null in normal
// flow; structurally in place for Sprint 18+ entries.
interface PendingSpawn {
  matter: MatterEntry;
  workingDir: string;
  recipe: Recipe;
}

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
  const config = useConfig();
  const { matters, loading, error, create } = useMatters(area.id);
  const [showNew, setShowNew] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [pendingSpawn, setPendingSpawn] = useState<PendingSpawn | null>(null);

  const groups = useMemo(() => groupByStakeholder(matters), [matters]);
  const shape = getPracticeAreaShape(area.id);
  // Sprint 19 (ADR-066 D4): per-area entry noun (Matter / Programme). Fall
  // back to Matter when an area has no shape registered (Forge can register
  // its own; pre-shape-era areas wouldn't render this surface anyway).
  const noun = shape?.entryNoun ?? { singular: 'Matter', plural: 'Matters' };
  const nounSingularLc = noun.singular.toLowerCase();
  const nounPluralLc = noun.plural.toLowerCase();

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
      // Sprint 15 (ADR-053): company_context block prepended to recipe
      // instructions for first-turn briefing.
      // Sprint 16 (ADR-057): Tavily key handled via env_keys on the extension
      // declaration; recipe-builders no longer take a tavily parameter.
      const profile = (await window.electron.readOscarProfile()) as
        | OscarUserProfile
        | null;
      const companyContext: OscarCompanyContext | null =
        profile?.company_context ?? null;

      // Sprint 17 (ADR-061): merge lawyer-added integrations into the
      // recipe's extension array. Unknown ids and bundled-tier entries
      // resolve to null in buildExtensionFromIntegration and are dropped.
      const installed = await window.electron.integrations.list(area.id);
      const trustedInstalled = installed.filter((i) => i.trust_acknowledged);
      const installedConfigsRaw = await Promise.all(
        trustedInstalled.map((i) => buildExtensionFromIntegration(i.id)),
      );
      const installedConfigs: NonNullable<Recipe['extensions']> =
        installedConfigsRaw.filter(
          (e): e is NonNullable<Recipe['extensions']>[number] => e !== null,
        );

      // Sprint 18 (ADR-063, ADR-065): thread the user's enabled platform
      // extensions (Memory, Top of Mind, Apps, Todo, Summon, Chat Recall,
      // Extension Manager, Auto Visualiser by default) into the recipe so
      // the agent has them at turn 1. Toggles in Extensions Settings take
      // effect on the next matter open.
      const enabledPlatformExtensions = deriveEnabledPlatformExtensions(
        config.extensionsList,
      );

      // Commercial composes its bespoke system prompt + redline MCP on top
      // via buildCommercialRecipe; the other 12 areas use the generic shape.
      const recipe =
        area.id === 'commercial'
          ? buildCommercialRecipe(
              workingDir,
              stateFolder,
              resourcesRoot,
              companyContext,
              installedConfigs,
              enabledPlatformExtensions,
            )
          : buildPracticeAreaRecipe({
              area,
              workingDir,
              stateFolder,
              matterSlug: matter.slug,
              resourcesRoot,
              companyContext,
              extraExtensions: installedConfigs,
              enabledPlatformExtensions,
            });

      // Sprint 17 (P6): if any installed integration declares an env_key
      // that's unset in env/keyring AND not skipped, gate the spawn behind
      // RecipeSecretsModal. For Sprint 17's seed set this resolves to
      // false on every matter open (Tavily is set at onboarding; all six
      // seed entries declare env_keys: []), so this short-circuits without
      // rendering. Sprint 18+ catalog entries that grow real keys flow
      // through the same gate.
      const gateNeeded = await ensureRecipeSecrets(recipe, config);
      if (gateNeeded) {
        setPendingSpawn({ matter, workingDir, recipe });
        return;
      }

      await spawnSession(matter, workingDir, recipe);
    } catch (err) {
      setOpenError(errorMessage(err, 'Failed to open matter'));
      setOpening(null);
    }
  };

  const spawnSession = async (
    matter: MatterEntry,
    workingDir: string,
    recipe: Recipe,
  ): Promise<void> => {
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
  };

  const onSecretsResolved = async (): Promise<void> => {
    const pending = pendingSpawn;
    setPendingSpawn(null);
    if (!pending) return;
    try {
      await spawnSession(pending.matter, pending.workingDir, pending.recipe);
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

  // Sprint 17 (P6): when a recipe needs a key the user hasn't provided yet,
  // take over the matters surface with RecipeSecretsModal. After Save /
  // Skip All the modal calls onComplete → onSecretsResolved resumes the
  // spawn.
  if (pendingSpawn) {
    return (
      <RecipeSecretsModal
        recipe={pendingSpawn.recipe}
        onComplete={() => void onSecretsResolved()}
      />
    );
  }

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 min-h-0 py-12">
        <div className="oscar__eyebrow">{area.name}</div>
        <h1 className="oscar__matters-title">{noun.plural}</h1>
        <p className="oscar__matters-body">{area.body}</p>

        <div className="oscar__matters-actions mt-6 mb-4">
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="oscar__button oscar__button--primary"
          >
            New {nounSingularLc}
          </button>
        </div>

        {loading && (
          <p className="oscar__matters-empty">Loading {nounPluralLc}…</p>
        )}
        {!loading && error && <p className="oscar__matters-error">{error}</p>}
        {!loading && !error && matters.length === 0 && (
          <p className="oscar__matters-empty">
            No {nounPluralLc} yet in {area.name}. Start by creating one.
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
