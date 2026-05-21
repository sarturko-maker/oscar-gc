// Sprint 20-M3 (ADR-083): History section body. Tails the session log via
// useHistoryTail (which polls /sessions/{session_id} every 2 s). Renders
// the last ~10 events in reverse-chronological order; an empty state when
// the session has no messages yet.

import { useRightPaneCoords } from '../RightPaneContext';
import { SECTION_META, type PanelSectionProps } from './registry';
import { useHistoryTail, type HistoryEvent } from './useHistoryTail';

export default function HistorySection({ sectionId }: PanelSectionProps) {
  const meta = SECTION_META[sectionId];
  const { sessionId } = useRightPaneCoords();
  const { events } = useHistoryTail(sessionId);

  return (
    <section className="oscar__panel-section" data-section-id={sectionId}>
      <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-title">
        {meta.title}
      </span>
      {events.length === 0 ? (
        <p className="oscar__panel-section-stub-body">No activity yet.</p>
      ) : (
        <ul className="oscar__panel-section-history">
          {events.map((ev, idx) => (
            <li
              key={`${ev.ts}-${idx}`}
              className="oscar__panel-section-history-row"
              data-role={ev.role}
            >
              <span className="oscar__panel-section-history-time">
                {formatTimestamp(ev.ts)}
              </span>
              <span className="oscar__panel-section-history-summary">
                {ev.summary}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Goose's Message.created is a Unix timestamp; whether it ships seconds or
// milliseconds shifts across versions, so detect by magnitude. Today
// (2025-2026) ms timestamps are 13 digits; second timestamps are 10.
const MS_THRESHOLD = 10_000_000_000;

function formatTimestamp(ts: HistoryEvent['ts']): string {
  const ms = ts < MS_THRESHOLD ? ts * 1000 : ts;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}
