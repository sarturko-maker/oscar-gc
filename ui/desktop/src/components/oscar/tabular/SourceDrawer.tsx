// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Citation drill (Sprint 35, ADR-113): click a cell → see the answer, the
// grounding verdict, and the supporting clause highlighted in the source. Text
// sources (.md/.txt) get the offset-exact SourceView (guaranteed correct). Binary
// sources (pdf/docx) return no text from the gate, so the drawer shows the quote
// string + an honest "Unverified" note (the original-document render tier is a
// Sprint 36 carry-forward, gated on the viewer deps).

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Manifest } from './types';
import { SourceView } from './SourceView';
import { cellVisual } from './cellState';
import type { SelectedCell } from './TabularGrid';

export function SourceDrawer({
  areaId,
  slug,
  manifest,
  selected,
  onClose,
}: {
  areaId: string;
  slug: string;
  manifest: Manifest;
  selected: SelectedCell;
  onClose: () => void;
}) {
  const row = manifest.rows.find((r) => r.document_id === selected.documentId);
  const column = manifest.columns.find((c) => c.id === selected.columnId);
  const cell = row?.cells[selected.columnId] ?? null;

  const [docText, setDocText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDocText(null);
    if (!row?.rel_path) {
      setLoading(false);
      return;
    }
    void window.electron.tabular.readSourceText(areaId, slug, row.rel_path).then((text) => {
      if (!cancelled) {
        setDocText(text);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [areaId, slug, row?.rel_path]);

  if (!row || !column || !cell) return null;
  const v = cellVisual(cell);

  return (
    <aside className="oscar__tabular-drawer">
      <header className="oscar__tabular-drawer-head">
        <div>
          <div className="oscar__tabular-drawer-eyebrow">{row.document_name}</div>
          <div className="oscar__tabular-drawer-title">{column.label}</div>
        </div>
        <button className="oscar__tabular-drawer-close" onClick={onClose} title="Close">
          <X />
        </button>
      </header>

      <div className="oscar__tabular-drawer-meta">
        <span className="oscar__tabular-badge" style={{ color: v.color, borderColor: v.color }}>
          {v.label}
        </span>
        {cell.value != null && <span className="oscar__tabular-answer">{v.display}</span>}
      </div>

      {cell.reasoning && <p className="oscar__tabular-reasoning">{cell.reasoning}</p>}

      <div className="oscar__tabular-drawer-body">
        {loading ? (
          <p className="oscar__tabular-drawer-note">Loading source…</p>
        ) : docText != null ? (
          <SourceView
            docText={docText}
            sourceQuote={cell.source_quote}
            sourceStart={cell.source_start}
            sourceEnd={cell.source_end}
            sourceQuotes={cell.source_quotes}
          />
        ) : (
          <div className="oscar__tabular-drawer-fallback">
            {cell.source_quote ? (
              <blockquote className="oscar__tabular-quote">“{cell.source_quote}”</blockquote>
            ) : (
              <p className="oscar__tabular-drawer-note">No citation was provided for this answer.</p>
            )}
            <p className="oscar__tabular-drawer-note">
              The source could not be opened as text for an exact highlight (it may be a PDF or DOCX).
              The quote above is what the reader reported; it has not been machine-verified.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
