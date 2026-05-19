// Sprint 12 (ADR-036): mounts MattersLanding for every practice area.
// The Commercial special-case (direct OscarCommercialView) is retired —
// Commercial now opens via MattersLanding like the other 12 areas, with the
// matter folder threading into the session's working_dir.

import { useParams } from 'react-router-dom';
import { usePracticeAreas } from './hooks/usePracticeAreas';
import MattersLanding from './matters/MattersLanding';

export default function PracticeAreaPlaceholder() {
  const { areaId } = useParams<{ areaId: string }>();
  const areas = usePracticeAreas();
  const area = areas.find((a) => a.id === areaId);

  if (!area) {
    return (
      <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
        <div className="flex flex-col max-w-3xl flex-1 justify-center">
          <p className="oscar__placeholder-body">Unknown practice area: {areaId}</p>
        </div>
      </div>
    );
  }

  return <MattersLanding area={area} />;
}
