// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sprint 35 (ADR-113): the durable re-entry point for Tabular Review. Lists the
// matter's reviews from <matter>/outputs/tabular-review/index.json (the manifest
// is the single source of truth, so persistence is automatic) and "Open"
// launches the full-window split route. Polls every 2 s so wave-by-wave progress
// shows live while a review is being built.

import { useNavigate } from 'react-router-dom';
import { useRightPaneCoords } from '../RightPaneContext';
import { SECTION_META, type PanelSectionProps } from './registry';
import { usePanelReader } from './usePanelReader';
import { isReviewIndex, type ReviewIndex } from '../../tabular/types';

export default function TabularReviewSection({ sectionId }: PanelSectionProps) {
  const meta = SECTION_META[sectionId];
  const { areaId, slug } = useRightPaneCoords();
  const navigate = useNavigate();

  const { data } = usePanelReader<ReviewIndex | null>(
    async () => {
      if (!areaId || !slug) return null;
      const raw = await window.electron.tabular.listReviews(areaId, slug);
      return isReviewIndex(raw) ? raw : null;
    },
    [areaId, slug],
  );

  const reviews = data?.reviews ?? [];

  return (
    <section className="oscar__panel-section" data-section-id={sectionId}>
      <span className="oscar__eyebrow oscar__eyebrow--bare oscar__panel-section-title">
        {meta.title}
      </span>
      {reviews.length === 0 ? (
        <p className="oscar__panel-section-stub-body">
          No reviews yet. Ask the agent to “review these documents for …” to build one.
        </p>
      ) : (
        <div className="oscar__panel-section-body">
          {reviews.map((r) => {
            const done = r.summary.complete + r.summary.flagged + r.summary.not_found + r.summary.failed;
            return (
              <button
                key={r.review_id}
                type="button"
                className="oscar__tabular-launch-row"
                onClick={() =>
                  navigate(
                    `/tabular-review?areaId=${encodeURIComponent(areaId ?? '')}&slug=${encodeURIComponent(slug ?? '')}&reviewId=${encodeURIComponent(r.review_id)}`,
                  )
                }
                title="Open the full-window review"
              >
                <span className="oscar__tabular-launch-title">{r.title}</span>
                <span className="oscar__tabular-launch-meta">
                  {r.document_count} docs · {r.column_count} cols ·{' '}
                  {r.status === 'final' ? 'final' : `${done}/${r.summary.total} cells`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
