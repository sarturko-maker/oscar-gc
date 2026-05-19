// Sprint 12 (ADR-039): Forge chat surface. Same pattern as OscarCommercialView
// pre-Sprint-12 — createSession on mount with the Forge recipe, dispatch
// ADD_ACTIVE_SESSION, navigate to /pair. Trust dialog bypassed via "Oscar GC"
// title prefix (ADR-029).

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../../../sessions';
import { errorMessage } from '../../../utils/conversionUtils';
import { AppEvents } from '../../../constants/events';
import { buildForgeRecipe } from './forgeRecipe';

export default function ForgeView() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        // Forge is not bound to a matter. Detach any active matter so the
        // tom file is empty for this session (ADR-044 single-active-state).
        await window.electron.matters.detachActive();

        const homeDir = window.electron.oscarHomeDir;
        if (!homeDir) {
          throw new Error('Home directory unavailable');
        }
        const recipe = buildForgeRecipe(homeDir, window.electron.oscarResourcesRoot);
        const session = await createSession(homeDir, { recipe });
        if (cancelled) return;
        window.dispatchEvent(
          new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
            detail: { sessionId: session.id, initialMessage: undefined },
          }),
        );
        navigate(`/pair?resumeSessionId=${encodeURIComponent(session.id)}`, {
          state: { disableAnimation: true },
        });
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, 'Failed to start Forge session'));
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
          <div className="oscar__eyebrow">Forge</div>
          <p className="oscar__matters-error">Could not start session: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="oscar flex flex-col h-full min-h-0 px-16 relative overflow-hidden">
      <div className="flex flex-col max-w-3xl flex-1 justify-center">
        <div className="oscar__eyebrow">Forge</div>
        <p className="oscar__matters-body">Opening Forge…</p>
      </div>
    </div>
  );
}
