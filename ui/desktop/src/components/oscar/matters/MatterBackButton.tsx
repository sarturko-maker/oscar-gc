// Sprint 14 (ADR-047): "All matters" back-affordance in the chat header
// when a session is bound to a matter. Closes the dogfood P2-C gap — the
// only path back used to be clicking the practice-area sidebar twice.
// Wraps BackButton (ui/BackButton.tsx) — does not invent.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../ui/BackButton';

interface MatterBackButtonProps {
  sessionId: string;
}

interface MatterBinding {
  area_id: string;
  area_name: string;
  slug: string;
  name: string;
}

export default function MatterBackButton({ sessionId }: MatterBackButtonProps) {
  const navigate = useNavigate();
  const [binding, setBinding] = useState<MatterBinding | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.electron.matters.lookupSession(sessionId);
        if (!cancelled) setBinding(res);
      } catch {
        if (!cancelled) setBinding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!binding) return null;

  const handleBack = (): void => {
    // Clear Top of Mind so a new matter isn't auto-anchored to the previous
    // one. The agent's context window will still hold the prior turns until
    // the user opens a new matter; that's fine — the matter-facts injection
    // is what we're scoping down.
    void window.electron.matters.detachActive();
    navigate(`/practice/${binding.area_id}`, {
      state: { disableAnimation: true },
    });
  };

  return (
    <BackButton
      onClick={handleBack}
      text="All matters"
      shape="pill"
      variant="secondary"
      className="no-drag"
    />
  );
}
