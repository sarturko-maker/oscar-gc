// Sprint M1 (ADR-069): docked right-pane host. Empty body in M1 — M2
// wires the section registry that mounts here. Width/visibility logic
// lives in AppLayout (mirrors how the sidebar's drag state lives there);
// this component owns chrome and toggle affordance only.

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RightPaneShellProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export default function RightPaneShell({
  isExpanded,
  onToggle,
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
          Right pane — coming in M2
        </div>
      )}
    </aside>
  );
}
