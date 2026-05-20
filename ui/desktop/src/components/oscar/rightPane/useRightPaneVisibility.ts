// Sprint M1 (ADR-069): right-pane visibility.
// Sprint M2 (ADR-070): extended to expose areaId from the matters.lookupSession
// response, so the composition hook can resolve defaultPanelSections without a
// second IPC call.
//
// Defaults: pane is on for matter-bound /pair sessions, off elsewhere
// (Hub, MattersLanding, Forge, Settings, quick-chats). Explicit user
// toggle (isRightPaneExpanded !== null) wins across routes and restarts.
//
// Matter-bound detection uses matters.lookupSession(sessionId) — the
// same probe MatterBackButton.tsx:29 uses (ADR-038 binding lookup).
// Routing-only detection breaks because matter chats and quick-chats both
// live at /pair?resumeSessionId=…; only the binding distinguishes them.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export interface RightPaneVisibility {
  /** false → don't render the pane at all (Hub / area landing / etc.) */
  isMounted: boolean;
  /** true → render body; false → collapsed (chevron rail only) */
  isExpanded: boolean;
  /** active matter's area_id when matter-bound; null otherwise (quick-chat, unresolved) */
  areaId: string | null;
}

interface MatterLookup {
  area_id: string;
  area_name: string;
  slug: string;
  name: string;
}

const HIDDEN: RightPaneVisibility = {
  isMounted: false,
  isExpanded: false,
  areaId: null,
};

export function useRightPaneVisibility(
  isRightPaneExpanded: boolean | null,
): RightPaneVisibility {
  const { pathname, search } = useLocation();

  // Off everywhere except /pair. Hub, MattersLanding, Forge, Settings, etc.
  const onPairRoute = pathname === '/pair';

  const sessionId = onPairRoute
    ? new URLSearchParams(search).get('resumeSessionId')
    : null;

  // undefined = lookup pending; null = lookup resolved no-matter (quick-chat);
  // MatterLookup = matter-bound. Cached per sessionId to avoid re-querying.
  const [matterRow, setMatterRow] = useState<MatterLookup | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!sessionId) {
      setMatterRow(undefined);
      return;
    }
    let cancelled = false;
    setMatterRow(undefined);
    (async () => {
      try {
        const res = await window.electron.matters.lookupSession(sessionId);
        if (!cancelled) setMatterRow(res);
      } catch {
        if (!cancelled) setMatterRow(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!onPairRoute || sessionId === null) return HIDDEN;

  // Don't flash during the async lookup — render nothing until we know
  // whether the session is matter-bound. Same posture as MatterBackButton.
  if (matterRow === undefined) return HIDDEN;

  const isMatterBound = matterRow !== null;
  const routeDefault = isMatterBound;
  const isExpanded = isRightPaneExpanded ?? routeDefault;
  return {
    isMounted: true,
    isExpanded,
    areaId: matterRow?.area_id ?? null,
  };
}
