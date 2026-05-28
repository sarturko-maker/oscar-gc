// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Grid schema for Tabular Review (ADR-111). Field names for the citation
// (source_quote / source_start / source_end / source_quotes) are kept faithful
// to LQ-Grid's types/index.ts so its SourceView + highlightText port verbatim;
// Oscar folds the separate verification file INTO the cell and adds the
// grounding `verification` block (ADR-112), reasoning, and run audit records.

import { z } from "zod";

export const Confidence = z.enum(["high", "medium", "low"]);
export const CellStatus = z.enum([
  "pending",
  "complete",
  "not_found",
  "failed",
  "flagged",
]);
export const RowStatus = z.enum(["pending", "complete", "partial", "failed"]);
export const ColumnType = z.enum([
  "string",
  "date",
  "boolean",
  "number",
  "enum",
  "list",
]);
export const OutputType = z.enum(["verbatim", "summary", "classification", "date"]);

export const SourceRefSchema = z.object({
  quote: z.string(),
  start: z.number().int().optional(),
  end: z.number().int().optional(),
  location: z.string().optional(),
});

// Grounding-gate verdict written by the aggregator (never by the LLM).
export const GroundingSchema = z.object({
  grounded: z.boolean(),
  score: z.number(),
  method: z.enum(["charOverlap", "sectionExists", "no-quote", "unverified", "no-source"]),
});

// Human review folded into the cell (LQ-Grid kept this in browser localStorage).
export const HumanReviewSchema = z.object({
  state: z.enum(["verified", "flagged", "overridden"]),
  note: z.string().nullable().default(null),
  override: z.string().nullable().default(null),
});

export const CellSchema = z.object({
  column_id: z.string().min(1),
  value: z.string().nullable(),
  display: z.string().default(""),
  reasoning: z.string().nullable().default(null),
  source_quote: z.string().nullable().default(null),
  source_location: z.string().nullable().default(null),
  source_start: z.number().int().optional(),
  source_end: z.number().int().optional(),
  source_quotes: z.array(SourceRefSchema).optional(),
  confidence: Confidence,
  status: CellStatus,
  verification: GroundingSchema.nullable().default(null),
  human: HumanReviewSchema.nullable().default(null),
  subagent_session_id: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

export const ColumnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  prompt: z.string().min(1),
  type: ColumnType.default("string"),
  outputType: OutputType.optional(),
  options: z.array(z.string()).optional(),
  sortable: z.boolean().default(true),
  filterable: z.boolean().default(true),
  group: z.string().nullable().default(null),
});

export const RowSchema = z.object({
  document_id: z.string().min(1),
  document_name: z.string(),
  rel_path: z.string(),
  status: RowStatus,
  cells: z.record(z.string(), CellSchema),
});

export const RunRecordSchema = z.object({
  run_id: z.string(),
  kind: z.enum(["initial", "add_column", "rerun"]),
  at: z.string(),
  columns: z.array(z.string()),
  documents: z.array(z.string()),
  notes: z.string().nullable().default(null),
});

export const SummarySchema = z.object({
  total: z.number().int(),
  complete: z.number().int(),
  not_found: z.number().int(),
  failed: z.number().int(),
  flagged: z.number().int(),
  pending: z.number().int(),
  verified: z.number().int(),
});

export const ManifestSchema = z.object({
  schema_version: z.literal(1),
  review_id: z.string().min(1),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  source_dir: z.string(),
  summary: SummarySchema,
  columns: z.array(ColumnSchema),
  rows: z.array(RowSchema),
  runs: z.array(RunRecordSchema),
});

// ── Index (the launcher's list of reviews for this matter) ──────────────────

export const IndexEntrySchema = z.object({
  review_id: z.string().min(1),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  document_count: z.number().int(),
  column_count: z.number().int(),
  status: z.enum(["in_progress", "final"]),
  summary: SummarySchema,
});

export const IndexSchema = z.object({
  schema_version: z.literal(1),
  reviews: z.array(IndexEntrySchema),
});

// ── Extractor payload (what a Summon sub-agent returns per document) ─────────
// This IS the shape forced by tabular-cell-extractor.yaml's response.json_schema
// and the shape ingest_results validates. The sub-agent reports the answer and
// its citation; it does NOT set the final cell status — the merge derives it and
// the grounding gate (ADR-112) is authoritative.

export const ExtractorCellSchema = z.object({
  column_id: z.string().min(1),
  answer: z.string().nullable(),
  reasoning: z.string().optional(),
  quote: z.string().nullable().optional(),
  locator: z.string().nullable().optional(),
  char_start: z.number().int().optional(),
  char_end: z.number().int().optional(),
  quotes: z.array(SourceRefSchema).optional(),
  confidence: Confidence.default("medium"),
});

export const ExtractorPayloadSchema = z.object({
  document_id: z.string().min(1),
  document_name: z.string().optional(),
  cells: z.array(ExtractorCellSchema),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type Grounding = z.infer<typeof GroundingSchema>;
export type Cell = z.infer<typeof CellSchema>;
export type Column = z.infer<typeof ColumnSchema>;
export type Row = z.infer<typeof RowSchema>;
export type RunRecord = z.infer<typeof RunRecordSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type IndexEntry = z.infer<typeof IndexEntrySchema>;
export type ReviewIndex = z.infer<typeof IndexSchema>;
export type ExtractorCell = z.infer<typeof ExtractorCellSchema>;
export type ExtractorPayload = z.infer<typeof ExtractorPayloadSchema>;
