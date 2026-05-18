import { useParams } from 'react-router-dom';
import { PRACTICE_AREAS } from './practiceAreas';

export default function PracticeAreaPlaceholder() {
  const { areaId } = useParams<{ areaId: string }>();
  const area = PRACTICE_AREAS.find((a) => a.id === areaId);

  if (!area) {
    return (
      <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
        <div className="flex flex-col max-w-3xl flex-1 justify-center">
          <p className="oscar__placeholder-body">Unknown practice area: {areaId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 justify-center">
        <div className="oscar__eyebrow">{area.name}</div>
        <h1 className="oscar__placeholder-title">
          {area.name}{' '}
          <span className="oscar__placeholder-title-em">— placeholder.</span>
        </h1>
        <p className="oscar__placeholder-body">{area.body}</p>
      </div>
    </div>
  );
}
