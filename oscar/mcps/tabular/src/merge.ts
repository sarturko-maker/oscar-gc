// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Deterministic, non-LLM merge for Tabular Review (ADR-111). The parent agent is
// the single writer; this layer takes validated sub-agent payloads and merges
// them by (document, column), derives cell/row status, and applies the grounding
// gate (ADR-112). Pure of fs: the source text needed by the gate is supplied by
// the caller via MergeContext.getDocText, so this module is unit-testable.

import { randomUUID } from "node:crypto";
import {
  CellSchema,
  ManifestSchema,
  ExtractorPayloadSchema,
  type Cell,
  type Column,
  type ExtractorCell,
  type IndexEntry,
  type Manifest,
  type Row,
  type Summary,
} from "./schema.js";
import { groundCell } from "./verify.js";

export interface MergeContext {
  getDocText: (relPath: string) => Promise<string | null>;
}

export interface DocumentInput {
  document_id: string;
  document_name?: string;
  rel_path?: string;
}

export interface RunMeta {
  kind: "initial" | "add_column" | "rerun";
  columns: string[];
  sessionIds?: Record<string, string>;
}

const nowIso = (): string => new Date().toISOString();

function emptySummary(): Summary {
  return { total: 0, complete: 0, not_found: 0, failed: 0, flagged: 0, pending: 0, verified: 0 };
}

export function createManifest(
  reviewId: string,
  title: string,
  sourceDir: string,
  columns: Column[],
  documents: DocumentInput[],
): Manifest {
  const created = nowIso();
  const rows: Row[] = documents.map((d) => ({
    document_id: d.document_id,
    document_name: d.document_name ?? d.document_id,
    rel_path: d.rel_path ?? "",
    status: "pending",
    cells: {},
  }));
  const manifest: Manifest = {
    schema_version: 1,
    review_id: reviewId,
    title,
    created_at: created,
    updated_at: created,
    source_dir: sourceDir,
    summary: emptySummary(),
    columns,
    rows,
    runs: [],
  };
  manifest.summary = computeSummary(manifest);
  return ManifestSchema.parse(manifest);
}

async function buildCell(
  ex: ExtractorCell,
  relPath: string,
  sessionId: string | null,
  ctx: MergeContext,
): Promise<Cell> {
  const answer = ex.answer;
  const quote = ex.quote ?? null;
  const locator = ex.locator ?? null;

  let status: Cell["status"] =
    answer === null || answer.trim() === "" ? "not_found" : "complete";
  let confidence = ex.confidence;
  let verification: Cell["verification"] = null;

  if (status === "complete") {
    const text = await ctx.getDocText(relPath);
    const g = groundCell(quote, locator, text);
    verification = g;
    // ADR-112: a cell may stay "complete" only if its quote grounds in the
    // source. Unreadable/binary source ("no-source") can't be auto-verified —
    // keep the cell but leave it visibly unverified rather than green-ticked.
    if (g.method !== "no-source" && !g.grounded) {
      status = "flagged";
      confidence = "low";
    }
  }

  return CellSchema.parse({
    column_id: ex.column_id,
    value: answer,
    display: answer ?? "",
    reasoning: ex.reasoning ?? null,
    source_quote: quote,
    source_location: locator,
    source_start: ex.char_start,
    source_end: ex.char_end,
    source_quotes: ex.quotes,
    confidence,
    status,
    verification,
    human: null,
    subagent_session_id: sessionId,
    notes: null,
  });
}

function failedCell(columnId: string, reason: string): Cell {
  return CellSchema.parse({
    column_id: columnId,
    value: null,
    display: "",
    reasoning: reason,
    source_quote: null,
    source_location: null,
    confidence: "low",
    status: "failed",
    verification: null,
    human: null,
    subagent_session_id: null,
    notes: reason,
  });
}

function upsertRow(manifest: Manifest, documentId: string, documentName?: string): Row {
  let row = manifest.rows.find((r) => r.document_id === documentId);
  if (!row) {
    row = {
      document_id: documentId,
      document_name: documentName ?? documentId,
      rel_path: "",
      status: "pending",
      cells: {},
    };
    manifest.rows.push(row);
  } else if (documentName && row.document_name === row.document_id) {
    row.document_name = documentName;
  }
  return row;
}

function deriveRowStatus(row: Row, columns: Column[]): Row["status"] {
  const ids = columns.map((c) => c.id);
  const present = ids.filter((id) => row.cells[id]);
  if (present.length === 0) return "pending";
  if (present.length < ids.length) return "partial";
  const allFailed = present.every((id) => row.cells[id].status === "failed");
  return allFailed ? "failed" : "complete";
}

export function computeSummary(manifest: Manifest): Summary {
  const s = emptySummary();
  const total = manifest.rows.length * manifest.columns.length;
  s.total = total;
  let present = 0;
  for (const row of manifest.rows) {
    for (const col of manifest.columns) {
      const cell = row.cells[col.id];
      if (!cell) continue;
      present += 1;
      switch (cell.status) {
        case "complete":
          s.complete += 1;
          break;
        case "not_found":
          s.not_found += 1;
          break;
        case "failed":
          s.failed += 1;
          break;
        case "flagged":
          s.flagged += 1;
          break;
        case "pending":
          s.pending += 1;
          break;
      }
      if (cell.human?.state === "verified") s.verified += 1;
    }
  }
  // Cells not yet written (no sub-agent has reported them) read as pending.
  s.pending += total - present;
  return s;
}

// Validates each raw payload individually. Valid ones merge by (document,column);
// malformed ones mark that document's cells `failed` with the reason — never
// dropped silently (CLAUDE.md "no silent failures", ADR-112).
export async function ingest(
  manifest: Manifest,
  rawBatch: unknown[],
  run: RunMeta,
  ctx: MergeContext,
): Promise<Manifest> {
  const touched: string[] = [];
  for (const raw of rawBatch) {
    const parsed = ExtractorPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      const docId =
        raw && typeof raw === "object" && "document_id" in raw && typeof raw.document_id === "string"
          ? raw.document_id
          : `unknown-${randomUUID().slice(0, 8)}`;
      const docName =
        raw && typeof raw === "object" && "document_name" in raw && typeof raw.document_name === "string"
          ? raw.document_name
          : undefined;
      const row = upsertRow(manifest, docId, docName);
      for (const cid of run.columns) {
        row.cells[cid] = failedCell(cid, `extractor payload failed validation: ${parsed.error.message}`);
      }
      row.status = deriveRowStatus(row, manifest.columns);
      touched.push(docId);
      continue;
    }
    const payload = parsed.data;
    const row = upsertRow(manifest, payload.document_id, payload.document_name);
    const sessionId = run.sessionIds?.[payload.document_id] ?? null;
    for (const ex of payload.cells) {
      row.cells[ex.column_id] = await buildCell(ex, row.rel_path, sessionId, ctx);
    }
    row.status = deriveRowStatus(row, manifest.columns);
    touched.push(payload.document_id);
  }
  manifest.updated_at = nowIso();
  manifest.runs.push({
    run_id: randomUUID(),
    kind: run.kind,
    at: manifest.updated_at,
    columns: run.columns,
    documents: touched,
    notes: null,
  });
  manifest.summary = computeSummary(manifest);
  return ManifestSchema.parse(manifest);
}

export function addColumn(manifest: Manifest, column: Column): Manifest {
  if (manifest.columns.some((c) => c.id === column.id)) {
    throw new Error(`column '${column.id}' already exists`);
  }
  manifest.columns.push(column);
  manifest.updated_at = nowIso();
  manifest.summary = computeSummary(manifest);
  return ManifestSchema.parse(manifest);
}

// Reset a cell to pending so the UI shows it re-running; the subsequent ingest
// overwrites it with the fresh answer.
export function resetCell(manifest: Manifest, documentId: string, columnId: string): Manifest {
  const row = manifest.rows.find((r) => r.document_id === documentId);
  if (!row) throw new Error(`document '${documentId}' not in review`);
  delete row.cells[columnId];
  row.status = deriveRowStatus(row, manifest.columns);
  manifest.updated_at = nowIso();
  manifest.summary = computeSummary(manifest);
  return ManifestSchema.parse(manifest);
}

// Fold a human verify/flag/override verdict into the cell (ADR-112 keeps human
// review inside the manifest; ADR-115 routes the write through this MCP so the
// agent/server stays the single writer — the UI never writes the manifest).
export function setHumanReview(
  manifest: Manifest,
  documentId: string,
  columnId: string,
  review: { state: "verified" | "flagged" | "overridden"; note?: string | null; override?: string | null },
): Manifest {
  const row = manifest.rows.find((r) => r.document_id === documentId);
  if (!row) throw new Error(`document '${documentId}' not in review`);
  const cell = row.cells[columnId];
  if (!cell) throw new Error(`cell '${columnId}' not present on document '${documentId}'`);
  cell.human = {
    state: review.state,
    note: review.note ?? null,
    override: review.override ?? null,
  };
  manifest.updated_at = nowIso();
  manifest.summary = computeSummary(manifest);
  return ManifestSchema.parse(manifest);
}

export function toIndexEntry(manifest: Manifest, status: "in_progress" | "final"): IndexEntry {
  return {
    review_id: manifest.review_id,
    title: manifest.title,
    created_at: manifest.created_at,
    updated_at: manifest.updated_at,
    document_count: manifest.rows.length,
    column_count: manifest.columns.length,
    status,
    summary: manifest.summary,
  };
}
