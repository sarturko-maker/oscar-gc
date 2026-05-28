// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The Tabular Review grid (Sprint 35): rows = documents, columns = extraction
// queries, cells = answer + grounding verdict. Plain-React table reproducing
// LQ-Grid's DataGrid structure (sticky document column, sortable headers,
// cell-click → citation drill) without TanStack/dnd-kit (deferred pending a
// workspace dependency-policy decision — see SPRINT_LOG). Editorial-themed.

import { useMemo, useState } from 'react';
import { FileText, ChevronUp, ChevronDown } from 'lucide-react';
import type { Manifest, Row } from './types';
import { GridCell } from './GridCell';

export interface SelectedCell {
  documentId: string;
  columnId: string;
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null;

function cellSortValue(row: Row, columnId: string): string {
  return (row.cells[columnId]?.value ?? '').toLowerCase();
}

export function TabularGrid({
  manifest,
  selected,
  onCellClick,
}: {
  manifest: Manifest;
  selected: SelectedCell | null;
  onCellClick: (documentId: string, columnId: string) => void;
}) {
  const [sort, setSort] = useState<Sort>(null);

  const rows = useMemo(() => {
    if (!sort) return manifest.rows;
    const sorted = [...manifest.rows];
    sorted.sort((a, b) => {
      const va = sort.key === '_document' ? a.document_name.toLowerCase() : cellSortValue(a, sort.key);
      const vb = sort.key === '_document' ? b.document_name.toLowerCase() : cellSortValue(b, sort.key);
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [manifest.rows, sort]);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );

  const sortGlyph = (key: string) =>
    sort?.key === key ? (sort.dir === 'asc' ? <ChevronUp className="oscar__tabular-sort" /> : <ChevronDown className="oscar__tabular-sort" />) : null;

  return (
    <div className="oscar__tabular-grid-wrap">
      <table className="oscar__tabular-grid">
        <thead>
          <tr>
            <th className="oscar__tabular-th oscar__tabular-th--num">#</th>
            <th
              className="oscar__tabular-th oscar__tabular-th--doc"
              onClick={() => toggleSort('_document')}
            >
              <span className="oscar__tabular-th-label">Document {sortGlyph('_document')}</span>
            </th>
            {manifest.columns.map((col) => (
              <th
                key={col.id}
                className="oscar__tabular-th"
                onClick={() => col.sortable && toggleSort(col.id)}
                title={col.prompt}
              >
                <span className="oscar__tabular-th-label">
                  {col.label} {col.sortable && sortGlyph(col.id)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.document_id} className="oscar__tabular-tr">
              <td className="oscar__tabular-cell oscar__tabular-cell--num">{i + 1}</td>
              <td className="oscar__tabular-cell oscar__tabular-cell--doc" title={row.document_name}>
                <FileText className="oscar__tabular-doc-icon" aria-hidden />
                <span className="oscar__tabular-doc-name">{row.document_name}</span>
              </td>
              {manifest.columns.map((col) => {
                const cell = row.cells[col.id];
                if (!cell) return <td key={col.id} className="oscar__tabular-cell oscar__tabular-cell--pending"><span className="oscar__tabular-pulse" /></td>;
                return (
                  <GridCell
                    key={col.id}
                    cell={cell}
                    isSelected={selected?.documentId === row.document_id && selected?.columnId === col.id}
                    onClick={() => onCellClick(row.document_id, col.id)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
