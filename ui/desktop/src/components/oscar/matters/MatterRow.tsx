// Sprint 12 (ADRs 036, 043), Sprint 14 (ADR-047): single matter row.
// Adaptive meta line shows subject + kind + optional counterparty. The
// `↔` glyph from the v1 row is dropped — only the disputes families read
// as bilateral, and they get the explicit "vs " prefix instead.

import type { MatterEntry } from './types';
import { partyRoleLabel } from './matterLabels';
import { kindLabel } from './practiceAreaShapes';

interface MatterRowProps {
  matter: MatterEntry;
  onOpen: (matter: MatterEntry) => void;
}

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return 'today';
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toISOString().slice(0, 10);
};

const DISPUTE_AREAS = new Set([
  'commercial-disputes',
  'employment-disputes',
  'ip-disputes',
  'regulatory-disputes',
]);

const formatCounterparty = (
  matter: MatterEntry,
): string | null => {
  if (!matter.counterparty) return null;
  const { role, name } = matter.counterparty;
  if (DISPUTE_AREAS.has(matter.area_id) && role !== 'internal_owner') {
    return `vs ${name}`;
  }
  return `${partyRoleLabel(role)}: ${name}`;
};

export default function MatterRow({ matter, onOpen }: MatterRowProps) {
  const counterpartyLine = formatCounterparty(matter);
  return (
    <button
      type="button"
      onClick={() => onOpen(matter)}
      className="oscar__matter-row w-full text-left flex items-center justify-between gap-4 py-4 px-2 transition-colors"
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-3">
          <span className="oscar__matter-row-name truncate">{matter.name}</span>
          {matter.privileged && (
            <span className="oscar__matter-privileged-badge">PRIVILEGED</span>
          )}
        </div>
        <div className="oscar__matter-row-meta">
          <span>{matter.subject.label}</span>
          {counterpartyLine && (
            <>
              <span className="oscar__matter-row-meta-sep"> · </span>
              <span>{counterpartyLine}</span>
            </>
          )}
          <span className="oscar__matter-row-meta-sep"> · </span>
          <span>{kindLabel(matter.area_id, matter.kind)}</span>
        </div>
      </div>
      <div className="oscar__matter-row-time">{formatTimestamp(matter.last_accessed_at)}</div>
    </button>
  );
}
