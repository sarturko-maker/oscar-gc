// Sprint 17 (ADR-060): top-level Integrations view. Unfiltered registry.
// Each card has a target-area <select> dropdown next to the Add button so
// the lawyer picks which practice-area agent gets the new integration.
//
// Per-area-tab variant (IntegrationsPerArea) handles the filtered view;
// this top-level view shares the same IntegrationCard / ConfirmAddModal
// components.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PRACTICE_AREAS } from '../practiceAreas';
import type { Integration, InstalledIntegration } from './types';
import { loadIntegrationsRegistry } from './loadRegistry';
import IntegrationCard from './IntegrationCard';
import ConfirmAddModal from './ConfirmAddModal';

export default function IntegrationsView() {
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

  const refreshInstalled = useCallback(async (): Promise<void> => {
    const out: Record<string, InstalledIntegration[]> = {};
    for (const area of PRACTICE_AREAS) {
      try {
        out[area.id] = await window.electron.integrations.list(area.id);
      } catch {
        out[area.id] = [];
      }
    }
    setInstalledByArea(out);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await loadIntegrationsRegistry();
        if (cancelled) return;
        setRegistry(r);
        // Default each entry's target area to its first relevant area,
        // or "commercial" as a fallback. Bundled entries have no target
        // picker; this map is ignored for them.
        const defaults: Record<string, string> = {};
        for (const e of r) {
          if (e.security_tier === 'bundled') continue;
          defaults[e.id] = e.relevant_areas[0] ?? PRACTICE_AREAS[0].id;
        }
        setTargetByEntry(defaults);
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

  const areaForEntry = (entry: Integration): { id: string; name: string } => {
    const areaId = targetByEntry[entry.id] ?? PRACTICE_AREAS[0].id;
    const area =
      PRACTICE_AREAS.find((a) => a.id === areaId) ?? PRACTICE_AREAS[0];
    return { id: area.id, name: area.name };
  };

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
              // Bundled entries: no target picker (always-on across all areas).
              const picker =
                e.security_tier === 'bundled' ? undefined : (
                  <select
                    className="oscar__integration-target-select"
                    value={targetId ?? PRACTICE_AREAS[0].id}
                    onChange={(ev) =>
                      setTargetByEntry((m) => ({
                        ...m,
                        [e.id]: ev.target.value,
                      }))
                    }
                    aria-label={`Target area for ${e.title}`}
                  >
                    {(e.relevant_areas.length > 0
                      ? e.relevant_areas
                      : PRACTICE_AREAS.map((a) => a.id)
                    ).map((aid) => {
                      const area = PRACTICE_AREAS.find((a) => a.id === aid);
                      if (!area) return null;
                      return (
                        <option key={aid} value={aid}>
                          {area.name}
                        </option>
                      );
                    })}
                  </select>
                );
              return (
                <IntegrationCard
                  key={e.id}
                  entry={e}
                  installed={isInstalledForCurrentTarget(e)}
                  areaPicker={picker}
                  onClickAdd={() => {
                    const { id } = areaForEntry(e);
                    setPending({ entry: e, areaId: id });
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
          area={{
            id: pending.areaId,
            name:
              PRACTICE_AREAS.find((a) => a.id === pending.areaId)?.name ??
              pending.areaId,
            body: '',
            source: 'default',
          }}
          onCancel={() => setPending(null)}
          onConfirm={() => handleConfirmAdd(pending.entry, pending.areaId)}
        />
      )}
    </div>
  );
}
