// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Tabular Review MCP tools (ADR-111). LLM-visible params are A (LLM extracts) or
// C (finite enum) only; the matter dir is B-class (resolved from OSCAR_MATTER_DIR
// in matterDir.ts) and never appears here; review_id is server-minted.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ColumnSchema, ColumnType, OutputType, type Column } from "./schema.js";
import { addColumn, createManifest, ingest, resetCell, toIndexEntry } from "./merge.js";
import { readSourceText } from "./matterDir.js";
import type { TabularStore } from "./store.js";

function slugify(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "col";
}

function slugifyId(label: string, taken: Set<string>): string {
  const base = slugify(label);
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

const ColumnInput = z.object({
  label: z.string().min(1).describe("Short column header, e.g. 'Governing law'."),
  prompt: z.string().min(1).describe("The natural-language question asked of every document."),
  type: ColumnType.optional(),
  outputType: OutputType.optional(),
  options: z.array(z.string()).optional().describe("Allowed values for an enum column."),
});

function normalizeColumns(
  inputs: z.infer<typeof ColumnInput>[],
  existing: Column[],
): Column[] {
  const taken = new Set(existing.map((c) => c.id));
  return inputs.map((c) =>
    ColumnSchema.parse({
      id: slugifyId(c.label, taken),
      label: c.label,
      prompt: c.prompt,
      type: c.type ?? "string",
      outputType: c.outputType,
      options: c.options,
    }),
  );
}

const ok = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload) }],
});

export function buildServer(store: TabularStore): McpServer {
  const server = new McpServer({ name: "oscar-tabular", version: "0.1.0" });
  const ctx = { getDocText: (relPath: string) => readSourceText(relPath, store.matter) };

  server.registerTool(
    "create_review",
    {
      description:
        "Create a Tabular Review (rows = documents, columns = extraction queries) in the current matter. " +
        "Returns a server-minted review_id. Then fan out one Summon delegate per document against the " +
        "tabular-cell-extractor recipe and pass the results to ingest_results.",
      inputSchema: {
        title: z.string().min(1).describe("Human title, e.g. 'Project Atlas — 50 contracts'."),
        columns: z.array(ColumnInput).min(1).describe("The extraction queries (columns)."),
        documents: z
          .array(
            z.object({
              document_id: z.string().min(1).describe("Stable id, e.g. the filename stem."),
              document_name: z.string().optional(),
              rel_path: z.string().optional().describe("Path relative to the matter folder."),
            }),
          )
          .optional()
          .describe("The documents to review. May be omitted and supplied via ingest_results."),
      },
    },
    async ({ title, columns, documents }) => {
      const reviewId = `${slugify(title).slice(0, 40)}-${randomUUID().slice(0, 8)}`;
      const cols = normalizeColumns(columns, []);
      const manifest = createManifest(reviewId, title, store.matter, cols, documents ?? []);
      await store.writeManifest(manifest, "in_progress");
      return ok({ review_id: reviewId, columns: cols.map((c) => c.id), summary: manifest.summary });
    },
  );

  server.registerTool(
    "ingest_results",
    {
      description:
        "Merge a wave of per-document extractor results into the review. Each batch entry is the JSON one " +
        "Summon sub-agent returned. Malformed entries mark that document's cells 'failed' (never dropped). " +
        "Every 'complete' cell is re-grounded against the source; ungrounded cells become 'flagged'.",
      inputSchema: {
        review_id: z.string().min(1),
        batch: z
          .array(z.record(z.string(), z.unknown()))
          .describe("One object per document, shaped like the tabular-cell-extractor recipe output."),
        kind: z.enum(["initial", "add_column", "rerun"]).optional(),
        columns: z
          .array(z.string())
          .optional()
          .describe("Column ids this run targeted; defaults to all columns."),
        sessionIds: z
          .record(z.string(), z.string())
          .optional()
          .describe("Optional map of document_id → the Summon sub-agent session id."),
      },
    },
    async ({ review_id, batch, kind, columns, sessionIds }) => {
      const manifest = await store.readManifest(review_id);
      if (!manifest) return ok({ ok: false, error: `review '${review_id}' not found` });
      const targeted = columns ?? manifest.columns.map((c) => c.id);
      const merged = await ingest(
        manifest,
        batch as unknown[],
        { kind: kind ?? "initial", columns: targeted, sessionIds },
        ctx,
      );
      await store.writeManifest(merged, "in_progress");
      return ok({ ok: true, review_id, summary: merged.summary });
    },
  );

  server.registerTool(
    "read_manifest",
    {
      description:
        "Return the full review manifest (all rows, cells, citations, grounding verdicts, run history). " +
        "Use for the grid, for 'ask the whole table' questions, and to re-open a saved review.",
      inputSchema: { review_id: z.string().min(1) },
    },
    async ({ review_id }) => {
      const manifest = await store.readManifest(review_id);
      if (!manifest) return ok({ ok: false, error: `review '${review_id}' not found` });
      return ok(manifest);
    },
  );

  server.registerTool(
    "add_column",
    {
      description:
        "Add a new extraction column to an existing review without recomputing prior columns. Returns the " +
        "new column id; then delegate that one column across all documents and ingest_results with kind='add_column'.",
      inputSchema: { review_id: z.string().min(1), column: ColumnInput },
    },
    async ({ review_id, column }) => {
      const manifest = await store.readManifest(review_id);
      if (!manifest) return ok({ ok: false, error: `review '${review_id}' not found` });
      const [col] = normalizeColumns([column], manifest.columns);
      const updated = addColumn(manifest, col);
      await store.writeManifest(updated, "in_progress");
      return ok({ ok: true, column_id: col.id, summary: updated.summary });
    },
  );

  server.registerTool(
    "rerun_cell",
    {
      description:
        "Reset one cell to 'pending' so it re-runs; then delegate that single (document, column) and " +
        "ingest_results with kind='rerun'.",
      inputSchema: {
        review_id: z.string().min(1),
        document_id: z.string().min(1),
        column_id: z.string().min(1),
      },
    },
    async ({ review_id, document_id, column_id }) => {
      const manifest = await store.readManifest(review_id);
      if (!manifest) return ok({ ok: false, error: `review '${review_id}' not found` });
      const updated = resetCell(manifest, document_id, column_id);
      await store.writeManifest(updated, "in_progress");
      return ok({ ok: true, summary: updated.summary });
    },
  );

  server.registerTool(
    "finalize_review",
    {
      description: "Mark the review final in the matter's review index. The manifest stays editable.",
      inputSchema: { review_id: z.string().min(1) },
    },
    async ({ review_id }) => {
      const manifest = await store.readManifest(review_id);
      if (!manifest) return ok({ ok: false, error: `review '${review_id}' not found` });
      await store.writeManifest(manifest, "final");
      return ok({ ok: true, entry: toIndexEntry(manifest, "final") });
    },
  );

  return server;
}
