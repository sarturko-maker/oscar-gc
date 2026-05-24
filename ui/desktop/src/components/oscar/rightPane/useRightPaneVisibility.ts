// Sprint M1 (ADR-069): right-pane visibility.
// Sprint M2 (ADR-070): extended to expose areaId from the matters.lookupSession
// response, so the composition hook can resolve defaultPanelSections without a
// second IPC call.
// Sprint 20-M3 (ADR-083): extended again to expose slug + sessionId so
// section bodies (MatterFacts reads matter.md, History tails the session
// log) can fetch without a second lookup.
// Sprint 28 M1 (ADR-091): pane is ONLY mounted on matter-bound /pair
// routes. Non-matter /pair (Forge, quick-chats) returns HIDDEN — never a
// rail-only stranded state. Supersedes ADR-069's lawyer-toggleable-in-
// quick-chat default; the toggle persistence is dropped in NavigationContext.
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
  /** active matter's slug when matter-bound; null otherwise */
  slug: string | null;
  /** the /pair resumeSessionId when on /pair with a session; null otherwise */
  sessionId: string | null;
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
  slug: null,
  sessionId: null,
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

  // Sprint 28 M1 (ADR-091): non-matter /pair (Forge, quick-chats) returns
  // HIDDEN. Previously this branch mounted a rail-only collapsed pane —
  // visually indistinguishable from a stranded post-toggle state, so
  // lawyers reported "panel disappears" after clicking Edit.
  if (matterRow === null) return HIDDEN;

  const isExpanded = isRightPaneExpanded ?? true;
  return {
    isMounted: true,
    isExpanded,
    areaId: matterRow.area_id,
    slug: matterRow.slug,
    sessionId,
  };
}
