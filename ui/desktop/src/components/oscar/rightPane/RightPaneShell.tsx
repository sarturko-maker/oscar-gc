// Sprint M1 (ADR-069): docked right-pane host (chrome + toggle).
// Sprint M2 (ADR-070): body becomes a vertical stack of section stubs
// driven by the resolved `sections` list (override ?? shape default).
// AppLayout owns the width drag state and visibility resolution; this
// component owns chrome + composition rendering only.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  sectionRegistry,
  type PanelSectionId,
} from './sections/registry';

interface RightPaneShellProps {
  isExpanded: boolean;
  onToggle: () => void;
  sections: PanelSectionId[];
}

export default function RightPaneShell({
  isExpanded,
  onToggle,
  sections,
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
          {sections.map((id) => {
            const Section = sectionRegistry[id];
            return <Section key={id} sectionId={id} />;
          })}
        </div>
      )}
    </aside>
  );
}
