import { useParams } from 'react-router-dom';
import { PRACTICE_AREAS } from './practiceAreas';

export default function PracticeAreaPlaceholder() {
  const { areaId } = useParams<{ areaId: string }>();
  const area = PRACTICE_AREAS.find((a) => a.id === areaId);

  if (!area) {
    return (
      <div className="oscar-terminal flex flex-col items-center justify-center h-full min-h-0 px-8 text-center">
        <p className="oscar-terminal__placeholder-body">Unknown practice area: {areaId}</p>
      </div>
    );
  }

  return (
    <div className="oscar-terminal flex flex-col items-center justify-center h-full min-h-0 px-8 text-center">
      <span className="oscar-terminal__eyebrow">// {area.name.toUpperCase()}</span>
      <h1 className="oscar-terminal__placeholder-title">{area.name} — placeholder.</h1>
      <p className="oscar-terminal__placeholder-body max-w-2xl">{area.body}</p>
    </div>
  );
}
