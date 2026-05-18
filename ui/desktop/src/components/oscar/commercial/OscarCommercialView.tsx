import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../../../sessions';
import { getInitialWorkingDir } from '../../../utils/workingDir';
import { errorMessage } from '../../../utils/conversionUtils';
import { AppEvents } from '../../../constants/events';
import { buildCommercialRecipe } from './commercialRecipe';

export default function OscarCommercialView() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const session = await createSession(getInitialWorkingDir(), {
          recipe: buildCommercialRecipe(window.electron.oscarResourcesRoot),
        });
        if (cancelled) return;
        window.dispatchEvent(
          new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
            detail: { sessionId: session.id, initialMessage: undefined },
          })
        );
        navigate(`/pair?resumeSessionId=${encodeURIComponent(session.id)}`, {
          state: { disableAnimation: true },
        });
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, 'Failed to start Commercial session'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
        <div className="flex flex-col max-w-3xl flex-1 justify-center">
          <div className="oscar__eyebrow">Commercial</div>
          <p className="oscar__placeholder-body">Could not start session: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 justify-center">
        <div className="oscar__eyebrow">Commercial</div>
        <p className="oscar__placeholder-body">Opening Commercial workspace…</p>
      </div>
    </div>
  );
}
