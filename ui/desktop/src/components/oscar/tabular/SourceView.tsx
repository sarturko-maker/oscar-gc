// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Offset-exact source highlighter ported from LQ-Grid src/ui/src/components/
// Sidebar/SourceView.tsx (Sprint 35, ADR-113). The guaranteed-correct citation
// tier: it renders the exact extracted text the reader saw, with the supporting
// passage(s) highlighted by char offset (falling back to a substring find on the
// quote). Re-themed to the Editorial surface. Field names (source_start/_end/
// _quotes) match schema.ts so the port is near-verbatim.

import type { SourceRef } from './types';

interface Region {
  start: number;
  end: number;
}

function resolveRegions(
  docText: string,
  sourceQuote: string | null,
  sourceStart?: number,
  sourceEnd?: number,
  sourceQuotes?: SourceRef[],
): Region[] {
  const regions: Region[] = [];

  if (sourceQuotes && sourceQuotes.length > 0) {
    for (const sq of sourceQuotes) {
      if (sq.start != null && sq.end != null && sq.start >= 0 && sq.end > sq.start && sq.end <= docText.length) {
        regions.push({ start: sq.start, end: sq.end });
      } else if (sq.quote) {
        const idx = docText.indexOf(sq.quote);
        if (idx >= 0) regions.push({ start: idx, end: idx + sq.quote.length });
      }
    }
  }

  if (regions.length === 0) {
    if (sourceStart != null && sourceEnd != null && sourceStart >= 0 && sourceEnd > sourceStart && sourceEnd <= docText.length) {
      regions.push({ start: sourceStart, end: sourceEnd });
    } else if (sourceQuote) {
      const idx = docText.indexOf(sourceQuote);
      if (idx >= 0) regions.push({ start: idx, end: idx + sourceQuote.length });
    }
  }

  regions.sort((a, b) => a.start - b.start);
  return regions;
}

export function SourceView({
  docText,
  sourceQuote,
  sourceStart,
  sourceEnd,
  sourceQuotes,
}: {
  docText: string;
  sourceQuote: string | null;
  sourceStart?: number;
  sourceEnd?: number;
  sourceQuotes?: SourceRef[];
}) {
  const regions = resolveRegions(docText, sourceQuote, sourceStart, sourceEnd, sourceQuotes);

  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  for (const r of regions) {
    if (r.start > cursor) segments.push({ text: docText.slice(cursor, r.start), highlighted: false });
    segments.push({ text: docText.slice(r.start, r.end), highlighted: true });
    cursor = r.end;
  }
  if (cursor < docText.length) segments.push({ text: docText.slice(cursor), highlighted: false });

  const hasHighlight = regions.length > 0;

  return (
    <div className="oscar__tabular-source">
      {hasHighlight
        ? segments.map((seg, i) =>
            seg.highlighted ? (
              <mark key={i} className="oscar__tabular-source-mark">
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )
        : docText}
    </div>
  );
}
