// Sprint M1 (ADR-069): docked right-pane host (chrome + toggle).
// Sprint M2 (ADR-070): body becomes a vertical stack of section stubs
// driven by the resolved `sections` list (override ?? shape default).
// Sprint 20-M3 (ADR-083): ambient matter coords (areaId / slug / sessionId)
// flow through RightPaneProvider so section bodies don't each re-lookup.
// Sprint 20-M7 (ADR-088): per-area Edit link in the header deep-links to
// Forge with ?modifyArea=<areaId>; mirrors M6's ?reviewSkill= precedent.
// AppLayout owns the width drag state and visibility resolution; this
// component owns chrome + composition rendering only.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
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

  return (
    <aside
      className="oscar oscar__right-pane no-drag"
      data-state={isExpanded ? 'expanded' : 'collapsed'}
    >
      <div className="oscar__right-pane-header">
        {isExpanded && (
          <span className="oscar__eyebrow oscar__eyebrow--bare oscar__right-pane-title">
            Loadout
          </span>
        )}
        {isExpanded && areaId && (
          <Link
            to={`/forge?modifyArea=${encodeURIComponent(areaId)}`}
            className="oscar__right-pane-edit-link"
            data-testid="right-pane-edit-link"
            title="Modify this practice area in Forge"
          >
            Edit
          </Link>
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
          <RightPaneProvider areaId={areaId} slug={slug} sessionId={sessionId}>
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
