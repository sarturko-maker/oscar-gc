// Sprint 12 (ADRs 036, 043): single matter row in MattersLanding's list.

import type { MatterEntry } from './types';

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

export default function MatterRow({ matter, onOpen }: MatterRowProps) {
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
          {matter.client}
          {matter.counterparty ? ` ↔ ${matter.counterparty}` : ''}
          {' · '}
          {matter.matter_type}
        </div>
      </div>
      <div className="oscar__matter-row-time">{formatTimestamp(matter.last_accessed_at)}</div>
    </button>
  );
}
