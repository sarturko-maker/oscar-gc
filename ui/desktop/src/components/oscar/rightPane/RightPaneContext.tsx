// Sprint 20-M3 (ADR-083): ambient matter coords for right-pane sections.
// The pane's section components (MatterFactsSection, HistorySection) need
// areaId / slug / sessionId to drive their reads, but the section registry
// passes only { sectionId } to each entry. Context keeps the registry
// signature clean and lets sections subscribe to whichever coords they
// need. Provider lives in RightPaneShell; consumers call useRightPaneCoords.
//
// Sprint 29 M5 (ADR-098): editingFacts is owned by RightPaneShell so the
// header (Edit / Cancel) and the section (form vs display) stay in sync;
// the provider plumbs it through to sections.

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

export interface RightPaneState extends RightPaneCoords {
  editingFacts: boolean;
  beginEditingFacts: () => void;
  endEditingFacts: () => void;
}

const RightPaneContext = createContext<RightPaneState | null>(null);

interface RightPaneProviderProps extends RightPaneState {
  children: ReactNode;
}

export function RightPaneProvider({
  children,
  ...state
}: RightPaneProviderProps) {
  return (
    <RightPaneContext.Provider value={state}>
      {children}
    </RightPaneContext.Provider>
  );
}

export function useRightPaneCoords(): RightPaneCoords {
  const ctx = useContext(RightPaneContext);
  if (!ctx) return { areaId: null, slug: null, sessionId: null };
  return { areaId: ctx.areaId, slug: ctx.slug, sessionId: ctx.sessionId };
}

export function useRightPaneEditing(): {
  editingFacts: boolean;
  beginEditingFacts: () => void;
  endEditingFacts: () => void;
} {
  const ctx = useContext(RightPaneContext);
  if (!ctx) {
    return {
      editingFacts: false,
      beginEditingFacts: () => undefined,
      endEditingFacts: () => undefined,
    };
  }
  return {
    editingFacts: ctx.editingFacts,
    beginEditingFacts: ctx.beginEditingFacts,
    endEditingFacts: ctx.endEditingFacts,
  };
}
