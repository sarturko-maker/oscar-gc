// Sprint 17 (ADR-060, ADR-061): per-area integrations view. Filtered by
// relevant_areas.includes(area.id). Card states are computed from
// installed_integrations.json for the area.
//
// Add flow: click → ConfirmAddModal (community vs trusted copy branch) →
// confirm → window.electron.integrations.install(areaId, entryId, true) →
// card flips to Installed state. Refetches the installed list after a
// successful install so the UI stays in sync.

import { useCallback, useEffect, useState } from 'react';
import type { PracticeArea } from '../practiceAreas';
import type { Integration, InstalledIntegration } from './types';
import { loadIntegrationsRegistry } from './loadRegistry';
import IntegrationCard from './IntegrationCard';
import ConfirmAddModal from './ConfirmAddModal';

export interface IntegrationsPerAreaProps {
  area: PracticeArea;
}

export default function IntegrationsPerArea({
  area,
}: IntegrationsPerAreaProps) {
  const [registry, setRegistry] = useState<Integration[] | null>(null);
  const [installed, setInstalled] = useState<InstalledIntegration[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Integration | null>(null);

  const refreshInstalled = useCallback(async (): Promise<void> => {
    try {
      const list = await window.electron.integrations.list(area.id);
      setInstalled(list);
    } catch (err) {
      setLoadError((err as Error).message ?? 'Could not read installed integrations.');
    }
  }, [area.id]);

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

  const installedIds = new Set(installed.map((e) => e.id));
  const entries =
    registry?.filter((e) => e.relevant_areas.includes(area.id)) ?? [];

  const handleConfirmAdd = async (entry: Integration): Promise<void> => {
    await window.electron.integrations.install(area.id, entry.id, true);
    setPending(null);
    await refreshInstalled();
  };

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 min-h-0 py-12">
        <div className="oscar__eyebrow">{area.name}</div>
        <h1 className="oscar__matters-title">Integrations</h1>
        <p className="oscar__matters-body">
          Available integrations for {area.name}. Add the ones your agent
          should be able to call. Each entry shows what it is, what it
          costs, and where data goes.
        </p>

        {loadError && (
          <p className="oscar__matters-error mt-4">{loadError}</p>
        )}
        {!registry && !loadError && (
          <p className="oscar__matters-empty mt-4">Loading integrations…</p>
        )}

        {registry && entries.length === 0 && !loadError && (
          <p className="oscar__matters-empty mt-4">
            No integrations relevant to {area.name} yet. Check back as the
            catalog grows.
          </p>
        )}

        {registry && entries.length > 0 && (
          <div className="oscar__integration-list mt-4 overflow-y-auto min-h-0">
            {entries.map((e) => (
              <IntegrationCard
                key={e.id}
                entry={e}
                installed={installedIds.has(e.id)}
                onClickAdd={() => setPending(e)}
              />
            ))}
          </div>
        )}
      </div>

      {pending && (
        <ConfirmAddModal
          entry={pending}
          area={area}
          onCancel={() => setPending(null)}
          onConfirm={() => handleConfirmAdd(pending)}
        />
      )}
    </div>
  );
}
