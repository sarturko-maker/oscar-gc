// Sprint M1 (ADR-069): docked right-pane host (chrome + toggle).
// Sprint M2 (ADR-070): body becomes a vertical stack of section stubs
// driven by the resolved `sections` list (override ?? shape default).
// Sprint 20-M3 (ADR-083): ambient matter coords (areaId / slug / sessionId)
// flow through RightPaneProvider so section bodies don't each re-lookup.
// Sprint 20-M7 (ADR-088): per-area Edit link in the header deep-linked to
// Forge with ?modifyArea=<areaId>.
// Sprint 29 M5 (ADR-098): Edit is no longer a Forge deep-link — it
// toggles an in-pane editing surface (manual form for matter facts) and
// the form itself carries the Forge entry as a labelled affordance.

import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RightPaneProvider } from './RightPaneContext';
import {
  sectionRegistry,
  type PanelSectionId,
} from './sections/registry';

interface RightPaneShellProps {
  isExpanded: boolean;
  onToggle: () => void;
  sections: PanelSectionId[];
  areaId: string | null;
  slug: string | null;
  sessionId: string | null;
}

export default function RightPaneShell({
  isExpanded,
  onToggle,
  sections,
  areaId,
  slug,
  sessionId,
}: RightPaneShellProps) {
  const ChevIcon = isExpanded ? ChevronRight : ChevronLeft;
  const toggleLabel = isExpanded ? 'Collapse right pane' : 'Expand right pane';
  const [editingFacts, setEditingFacts] = useState(false);
  const beginEditingFacts = useCallback(() => setEditingFacts(true), []);
  const endEditingFacts = useCallback(() => setEditingFacts(false), []);
  const editingActive = isExpanded && Boolean(areaId) && Boolean(slug) && editingFacts;

  return (
    <aside
      className="oscar oscar__right-pane no-drag"
      data-state={isExpanded ? 'expanded' : 'collapsed'}
      data-editing-facts={editingFacts ? 'true' : 'false'}
    >
      <div className="oscar__right-pane-header">
        {isExpanded && (
          <span className="oscar__eyebrow oscar__eyebrow--bare oscar__right-pane-title">
            Loadout
          </span>
        )}
        {isExpanded && areaId && slug && (
          editingActive ? (
            <button
              type="button"
              className="oscar__right-pane-edit-link"
              data-testid="right-pane-cancel-edit"
              onClick={endEditingFacts}
              title="Discard changes and close the editor"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="oscar__right-pane-edit-link"
              data-testid="right-pane-edit-link"
              onClick={beginEditingFacts}
              title="Edit matter facts manually, or open Forge from inside"
            >
              Edit
            </button>
          )
        )}
        <button
          type="button"
          onClick={onToggle}
          className="oscar__right-pane-toggle"
          aria-label={toggleLabel}
          aria-expanded={isExpanded}
          title={toggleLabel}
        >
          <ChevIcon className="w-4 h-4" />
        </button>
      </div>
      {isExpanded && (
        <div className="oscar__right-pane-body">
          <RightPaneProvider
            areaId={areaId}
            slug={slug}
            sessionId={sessionId}
            editingFacts={editingFacts}
            beginEditingFacts={beginEditingFacts}
            endEditingFacts={endEditingFacts}
          >
            {sections.map((id) => {
              const Section = sectionRegistry[id];
              return <Section key={id} sectionId={id} />;
            })}
          </RightPaneProvider>
        </div>
      )}
    </aside>
  );
}
