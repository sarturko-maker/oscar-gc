// Sprint 12 (ADR-036): mounts MattersLanding for every practice area.
// Sprint 17: gains a thin tab host so the area surface holds Matters
// (default) + Integrations (per-area filtered catalog, ADR-060).

import { useSearchParams } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { usePracticeAreas } from './hooks/usePracticeAreas';
import MattersLanding from './matters/MattersLanding';
import IntegrationsPerArea from './integrations/IntegrationsPerArea';

type TabId = 'matters' | 'integrations';

const isTabId = (value: string | null): value is TabId =>
  value === 'matters' || value === 'integrations';

export default function PracticeAreaPlaceholder() {
  const { areaId } = useParams<{ areaId: string }>();
  const areas = usePracticeAreas();
  const area = areas.find((a) => a.id === areaId);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: TabId = isTabId(tabParam) ? tabParam : 'matters';

  if (!area) {
    return (
      <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
        <div className="flex flex-col max-w-3xl flex-1 justify-center">
          <p className="oscar__placeholder-body">Unknown practice area: {areaId}</p>
        </div>
      </div>
    );
  }

  const setTab = (next: TabId): void => {
    const params = new URLSearchParams(searchParams);
    if (next === 'matters') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="oscar__area-tabs">
        <button
          type="button"
          onClick={() => setTab('matters')}
          className={
            tab === 'matters'
              ? 'oscar__area-tab oscar__area-tab--active'
              : 'oscar__area-tab'
          }
        >
          Matters
        </button>
        <button
          type="button"
          onClick={() => setTab('integrations')}
          className={
            tab === 'integrations'
              ? 'oscar__area-tab oscar__area-tab--active'
              : 'oscar__area-tab'
          }
        >
          Integrations
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'matters' ? (
          <MattersLanding area={area} />
        ) : (
          <IntegrationsPerArea area={area} />
        )}
      </div>
    </div>
  );
}
