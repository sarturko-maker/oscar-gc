// Sprint 17 (ADR-060), Sprint 17b dogfood fix: top-level Integrations view.
// Unfiltered registry — every entry visible for transparency, regardless
// of the user's selected practice areas. Each card has a target-area
// <select> dropdown next to the Add button, and the dropdown is scoped
// to the **user's selected practice areas** (profile.json `practice_areas[]`
// via usePracticeAreas) intersected with the entry's `relevant_areas`.
// Sprint 17 first pass showed all 13 catalog areas which doesn't match
// the lawyer's actual loadout.
//
// Per-area-tab variant (IntegrationsPerArea) handles the per-area
// filtered list; this top-level view shares IntegrationCard +
// ConfirmAddModal.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePracticeAreas } from '../hooks/usePracticeAreas';
import { PRACTICE_AREAS, type PracticeArea } from '../practiceAreas';
import type { Integration, InstalledIntegration } from './types';
import { loadIntegrationsRegistry } from './loadRegistry';
import IntegrationCard from './IntegrationCard';
import ConfirmAddModal from './ConfirmAddModal';

export default function IntegrationsView() {
  const userAreas = usePracticeAreas();
  const [registry, setRegistry] = useState<Integration[] | null>(null);
  const [installedByArea, setInstalledByArea] = useState<
    Record<string, InstalledIntegration[]>
  >({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targetByEntry, setTargetByEntry] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{
    entry: Integration;
    areaId: string;
  } | null>(null);

  // Sprint 17b: pull the installed list only for the user's actual
  // practice areas — the top-level view's Installed badge is computed
  // against the current target area, so we only need those entries.
  const refreshInstalled = useCallback(async (): Promise<void> => {
    const out: Record<string, InstalledIntegration[]> = {};
    for (const area of userAreas) {
      try {
        out[area.id] = await window.electron.integrations.list(area.id);
      } catch {
        out[area.id] = [];
      }
    }
    setInstalledByArea(out);
  }, [userAreas]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await loadIntegrationsRegistry();
        if (cancelled) return;
        setRegistry(r);
      } catch (err) {
        if (!cancelled) {
          setLoadError((err as Error).message ?? 'Could not load registry.');
        }
      }
    })();
    void refreshInstalled();
    return () => {
      cancelled = true;
    };
  }, [refreshInstalled]);

  // The list of areas the dropdown may target for a given entry: the
  // intersection of the user's selected practice areas with the entry's
  // relevant_areas. Cross-area entries (Slack, Google Drive) get the full
  // user-area list; commercial-only entries (e.g. trusted CourtListener
  // surfacing in disputes areas) get whichever user-areas overlap. If the
  // intersection is empty, the entry isn't usefully addable from the top
  // level — Add stays disabled.
  const targetOptionsForEntry = useCallback(
    (entry: Integration): PracticeArea[] => {
      const intersect = userAreas.filter((a) =>
        entry.relevant_areas.includes(a.id),
      );
      // Fallback: if relevant_areas is empty (overlay-only bundled entries
      // hit a different code path; this shouldn't trigger for non-bundled
      // entries), allow any user area so the dropdown still renders.
      return intersect.length > 0 ? intersect : [...userAreas];
    },
    [userAreas],
  );

  // Initialise / sync targetByEntry once both registry and userAreas are
  // known. Default each entry to the first valid user area.
  useEffect(() => {
    if (!registry) return;
    setTargetByEntry((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const e of registry) {
        if (e.security_tier === 'bundled') continue;
        const opts = targetOptionsForEntry(e);
        if (opts.length === 0) continue;
        const existing = next[e.id];
        if (!existing || !opts.find((a) => a.id === existing)) {
          next[e.id] = opts[0].id;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [registry, targetOptionsForEntry]);

  const handleConfirmAdd = async (
    entry: Integration,
    areaId: string,
  ): Promise<void> => {
    await window.electron.integrations.install(areaId, entry.id, true);
    setPending(null);
    await refreshInstalled();
  };

  const isInstalledForCurrentTarget = useMemo(
    () =>
      (entry: Integration): boolean => {
        const areaId = targetByEntry[entry.id];
        if (!areaId) return false;
        const list = installedByArea[areaId] ?? [];
        return list.some((i) => i.id === entry.id);
      },
    [installedByArea, targetByEntry],
  );

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 min-h-0 py-12">
        <div className="oscar__eyebrow">Catalog</div>
        <h1 className="oscar__matters-title">Integrations</h1>
        <p className="oscar__matters-body">
          The full set of MCPs you can wire into a practice-area agent.
          Each card lists what it connects to, what it costs, and what
          license it ships under. Pick a target area for each one before
          adding.
        </p>

        {loadError && (
          <p className="oscar__matters-error mt-4">{loadError}</p>
        )}
        {!registry && !loadError && (
          <p className="oscar__matters-empty mt-4">Loading integrations…</p>
        )}

        {registry && registry.length > 0 && (
          <div className="oscar__integration-list mt-4 overflow-y-auto min-h-0">
            {registry.map((e) => {
              const targetId = targetByEntry[e.id];
              const opts = targetOptionsForEntry(e);
              // Bundled entries: no target picker (always-on across all
              // user areas). Non-bundled with empty intersection: still
              // show the entry (transparency) but the dropdown lists
              // nothing — Add is essentially inert; that's honest.
              const picker =
                e.security_tier === 'bundled' || opts.length === 0
                  ? undefined
                  : (
                    <select
                      className="oscar__integration-target-select"
                      value={targetId ?? opts[0].id}
                      onChange={(ev) =>
                        setTargetByEntry((m) => ({
                          ...m,
                          [e.id]: ev.target.value,
                        }))
                      }
                      aria-label={`Target area for ${e.title}`}
                    >
                      {opts.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  );
              return (
                <IntegrationCard
                  key={e.id}
                  entry={e}
                  installed={isInstalledForCurrentTarget(e)}
                  areaPicker={picker}
                  onClickAdd={() => {
                    const areaId = targetByEntry[e.id] ?? opts[0]?.id;
                    if (!areaId) return;
                    setPending({ entry: e, areaId });
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {pending && (
        <ConfirmAddModal
          entry={pending.entry}
          area={
            userAreas.find((a) => a.id === pending.areaId) ??
            PRACTICE_AREAS.find((a) => a.id === pending.areaId) ?? {
              id: pending.areaId,
              name: pending.areaId,
              body: '',
              source: 'default',
            }
          }
          onCancel={() => setPending(null)}
          onConfirm={() => handleConfirmAdd(pending.entry, pending.areaId)}
        />
      )}
    </div>
  );
}
