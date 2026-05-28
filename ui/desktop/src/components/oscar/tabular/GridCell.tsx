// SPDX-License-Identifier: AGPL-3.0-or-later
//
// One grid cell, rendered from the manifest cell's status + grounding verdict via
// cellVisual() (Sprint 35). Patterns ported from LQ-Grid GridCell.tsx, but the
// machine state comes from Oscar's grounding gate (ADR-112) folded into the cell,
// and a human verdict (ADR-115) overrides it. Editorial-themed via .oscar__tabular-*.

import { CheckCircle, AlertCircle, Minus, X, Pencil } from 'lucide-react';
import type { Cell } from './types';
import { cellVisual } from './cellState';

const ICONS = { check: CheckCircle, alert: AlertCircle, minus: Minus, x: X, pencil: Pencil };

export function GridCell({
  cell,
  isSelected,
  onClick,
}: {
  cell: Cell;
  isSelected: boolean;
  onClick: () => void;
}) {
  if (cell.status === 'pending') {
    return (
      <td className="oscar__tabular-cell oscar__tabular-cell--pending">
        <span className="oscar__tabular-pulse" />
      </td>
    );
  }

  const v = cellVisual(cell);
  const Icon = v.icon ? ICONS[v.icon] : null;
  const empty = v.display === '';

  return (
    <td
      className={`oscar__tabular-cell${isSelected ? ' is-selected' : ''}`}
      style={{ borderLeftColor: v.color }}
      onClick={onClick}
      title={v.tooltip}
      data-tone={v.tone}
    >
      <div className="oscar__tabular-cell-inner">
        <span className={`oscar__tabular-cell-value${empty ? ' is-muted' : ''}`}>
          {empty ? v.label : v.display}
        </span>
        {Icon && <Icon className="oscar__tabular-cell-icon" style={{ color: v.color }} aria-hidden />}
      </div>
    </td>
  );
}
