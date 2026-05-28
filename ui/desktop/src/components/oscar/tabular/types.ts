// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Renderer-side mirror of oscar/mcps/tabular/src/schema.ts (Sprint 35, ADR-111).
// The MCP is a sibling package outside ui/desktop's build graph, so the manifest
// shape is duplicated here rather than imported across the package boundary. If
// the MCP schema changes, update this in lockstep — the IPC layer validates the
// top-level shape so drift fails visibly rather than mis-rendering silently.

export type Confidence = 'high' | 'medium' | 'low';
export type CellStatus = 'pending' | 'complete' | 'not_found' | 'failed' | 'flagged';
export type RowStatus = 'pending' | 'complete' | 'partial' | 'failed';
export type ColumnType = 'string' | 'date' | 'boolean' | 'number' | 'enum' | 'list';
export type GroundingMethod =
  | 'charOverlap'
  | 'sectionExists'
  | 'no-quote'
  | 'unverified'
  | 'no-source';
export type HumanState = 'verified' | 'flagged' | 'overridden';

export interface SourceRef {
  quote: string;
  start?: number;
  end?: number;
  location?: string;
}

export interface Grounding {
  grounded: boolean;
  score: number;
  method: GroundingMethod;
}

export interface HumanReview {
  state: HumanState;
  note: string | null;
  override: string | null;
}

export interface Cell {
  column_id: string;
  value: string | null;
  display: string;
  reasoning: string | null;
  source_quote: string | null;
  source_location: string | null;
  source_start?: number;
  source_end?: number;
  source_quotes?: SourceRef[];
  confidence: Confidence;
  status: CellStatus;
  verification: Grounding | null;
  human: HumanReview | null;
  subagent_session_id: string | null;
  notes: string | null;
}

export interface Column {
  id: string;
  label: string;
  prompt: string;
  type: ColumnType;
  outputType?: 'verbatim' | 'summary' | 'classification' | 'date';
  options?: string[];
  sortable: boolean;
  filterable: boolean;
  group: string | null;
}

export interface Row {
  document_id: string;
  document_name: string;
  rel_path: string;
  status: RowStatus;
  cells: Record<string, Cell>;
}

export interface Summary {
  total: number;
  complete: number;
  not_found: number;
  failed: number;
  flagged: number;
  pending: number;
  verified: number;
}

export interface RunRecord {
  run_id: string;
  kind: 'initial' | 'add_column' | 'rerun';
  at: string;
  columns: string[];
  documents: string[];
  notes: string | null;
}

export interface Manifest {
  schema_version: 1;
  review_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  source_dir: string;
  summary: Summary;
  columns: Column[];
  rows: Row[];
  runs: RunRecord[];
}

export interface IndexEntry {
  review_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  document_count: number;
  column_count: number;
  status: 'in_progress' | 'final';
  summary: Summary;
}

export interface ReviewIndex {
  schema_version: 1;
  reviews: IndexEntry[];
}

// Minimal structural guard for the IPC boundary: a parsed manifest must carry
// the load-bearing arrays. Fails loud on schema drift rather than rendering junk.
export function isManifest(v: unknown): v is Manifest {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    m.schema_version === 1 &&
    typeof m.review_id === 'string' &&
    Array.isArray(m.columns) &&
    Array.isArray(m.rows)
  );
}

export function isReviewIndex(v: unknown): v is ReviewIndex {
  if (!v || typeof v !== 'object') return false;
  const i = v as Record<string, unknown>;
  return i.schema_version === 1 && Array.isArray(i.reviews);
}
