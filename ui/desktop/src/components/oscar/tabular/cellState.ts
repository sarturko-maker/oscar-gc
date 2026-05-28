// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Cell status + grounding verdict → the visual vocabulary the grid renders
// (Sprint 35). Adopts lq-ai's 4-state citation model (verified / tolerant /
// needs-review / unverified) mapped onto Oscar's zero-LLM grounding output.
// ADR-112 invariant: a cell whose quote did not ground must read "needs review",
// never a confident answer. A human verdict (ADR-115) overrides the machine state.

import type { Cell } from './types';

export type CellTone =
  | 'verified'
  | 'tolerant'
  | 'needs-review'
  | 'unverified'
  | 'not-found'
  | 'failed'
  | 'pending'
  | 'human-verified'
  | 'human-flagged'
  | 'overridden';

export interface CellVisual {
  tone: CellTone;
  /** The value to show (human override wins). */
  display: string;
  label: string;
  tooltip: string;
  /** Editorial-tinted accent for the status pip / left border. */
  color: string;
  /** lucide-react icon name, or null for none. */
  icon: 'check' | 'alert' | 'minus' | 'x' | 'pencil' | null;
}

// Editorial-tinted tones that read on cream paper (no --cat-* tokens in-app).
const GREEN = '#3f7d4f';
const OCHRE = '#b45309';
const GREY = '#a8a29e';
const RED = '#991b1b';
const COPPER = '#9a3412';

export function cellVisual(cell: Cell): CellVisual {
  // Human verdict overrides the machine state.
  if (cell.human) {
    if (cell.human.state === 'verified') {
      return {
        tone: 'human-verified',
        display: cell.display,
        label: 'Verified by reviewer',
        tooltip: cell.human.note ?? 'Marked verified by the reviewer.',
        color: GREEN,
        icon: 'check',
      };
    }
    if (cell.human.state === 'overridden') {
      return {
        tone: 'overridden',
        display: cell.human.override ?? cell.display,
        label: 'Overridden by reviewer',
        tooltip: cell.human.note ?? 'Value corrected by the reviewer.',
        color: COPPER,
        icon: 'pencil',
      };
    }
    return {
      tone: 'human-flagged',
      display: cell.display,
      label: 'Flagged by reviewer',
      tooltip: cell.human.note ?? 'Flagged for follow-up by the reviewer.',
      color: OCHRE,
      icon: 'alert',
    };
  }

  switch (cell.status) {
    case 'pending':
      return { tone: 'pending', display: '', label: 'In progress', tooltip: 'Being extracted…', color: COPPER, icon: null };
    case 'failed':
      return { tone: 'failed', display: '', label: 'Extraction failed', tooltip: cell.notes ?? 'The reader could not produce a result for this cell.', color: RED, icon: 'x' };
    case 'not_found':
      return { tone: 'not-found', display: '', label: 'Not in document', tooltip: 'The document does not address this query.', color: GREY, icon: 'minus' };
    case 'flagged':
      return {
        tone: 'needs-review',
        display: cell.display,
        label: 'Needs review',
        tooltip: 'The cited quote could not be located verbatim in the source — verify before relying on it.',
        color: OCHRE,
        icon: 'alert',
      };
    case 'complete': {
      const m = cell.verification?.method;
      if (m === 'charOverlap' && cell.verification?.grounded) {
        return { tone: 'verified', display: cell.display, label: 'Verified verbatim', tooltip: 'The cited quote was found verbatim in the source.', color: GREEN, icon: 'check' };
      }
      if (m === 'sectionExists' && cell.verification?.grounded) {
        return { tone: 'tolerant', display: cell.display, label: 'Verified — section located', tooltip: 'The cited section was located in the source.', color: GREEN, icon: 'check' };
      }
      if (m === 'no-source') {
        return { tone: 'unverified', display: cell.display, label: 'Unverified', tooltip: 'The source is not machine-readable (e.g. a scanned PDF), so the citation could not be auto-verified.', color: GREY, icon: null };
      }
      // no-quote or any other ungrounded-but-complete shape.
      return { tone: 'unverified', display: cell.display, label: 'Unverified', tooltip: 'No verifiable citation was provided for this answer.', color: GREY, icon: null };
    }
    default:
      return { tone: 'unverified', display: cell.display, label: 'Unverified', tooltip: '', color: GREY, icon: null };
  }
}

export function summaryChips(s: {
  complete: number;
  flagged: number;
  failed: number;
  not_found: number;
  pending: number;
  verified: number;
}): Array<{ label: string; n: number; color: string }> {
  return [
    { label: 'verified', n: s.verified, color: GREEN },
    { label: 'complete', n: s.complete, color: GREEN },
    { label: 'needs review', n: s.flagged, color: OCHRE },
    { label: 'not found', n: s.not_found, color: GREY },
    { label: 'failed', n: s.failed, color: RED },
    { label: 'pending', n: s.pending, color: COPPER },
  ].filter((c) => c.n > 0);
}
