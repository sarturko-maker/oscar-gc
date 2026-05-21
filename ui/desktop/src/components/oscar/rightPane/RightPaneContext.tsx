// Sprint 20-M3 (ADR-083): ambient matter coords for right-pane sections.
// The pane's section components (MatterFactsSection, HistorySection) need
// areaId / slug / sessionId to drive their reads, but the section registry
// passes only { sectionId } to each entry. Context keeps the registry
// signature clean and lets sections subscribe to whichever coords they
// need. Provider lives in RightPaneShell; consumers call useRightPaneCoords.

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

export interface RightPaneCoords {
  areaId: string | null;
  slug: string | null;
  sessionId: string | null;
}

const RightPaneContext = createContext<RightPaneCoords | null>(null);

interface RightPaneProviderProps extends RightPaneCoords {
  children: ReactNode;
}

export function RightPaneProvider({
  areaId,
  slug,
  sessionId,
  children,
}: RightPaneProviderProps) {
  return (
    <RightPaneContext.Provider value={{ areaId, slug, sessionId }}>
      {children}
    </RightPaneContext.Provider>
  );
}

export function useRightPaneCoords(): RightPaneCoords {
  const ctx = useContext(RightPaneContext);
  if (!ctx) {
    return { areaId: null, slug: null, sessionId: null };
  }
  return ctx;
}
