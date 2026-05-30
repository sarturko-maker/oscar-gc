// SPDX-License-Identifier: AGPL-3.0-or-later
// MCP server smoke test for oscar-tabular. Drives the real tools over a real
// stdio client harness (CLAUDE.md: "MCP server tests use a real MCP client
// harness, not a mock transport") and verifies the round-trip, the grounding
// gate (grounded → complete; ungrounded → flagged + low confidence; no-source →
// complete-but-unverified), the never-silent failed path for malformed payloads,
// and on-disk persistence (ADR-111, ADR-112). The MCP makes no LLM calls, so
// there is no pipeline-test concern here.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "dist", "index.js");

const matter = mkdtempSync(join(tmpdir(), "oscar-tabular-smoke-"));
mkdirSync(join(matter, "contracts"), { recursive: true });
writeFileSync(
  join(matter, "contracts", "nda_acme.txt"),
  "MUTUAL NON-DISCLOSURE AGREEMENT\n\nSection 8. Governing Law. This Agreement shall be " +
    "governed by the laws of England and Wales.\n",
  "utf8",
);
// A document in a subfolder, to prove the basename fallback (Sprint 35 dogfood
// finding): the agent often passes a BARE filename as rel_path even when the file
// lives in a subfolder, and grounding must still resolve it.
writeFileSync(
  join(matter, "contracts", "msa_sub.txt"),
  "MASTER SERVICES AGREEMENT\n\nSection 12. Liability. Aggregate liability shall not exceed " +
    "the fees paid in the preceding twelve months.\n",
  "utf8",
);

const transport = new StdioClientTransport({
  command: "node",
  args: [entry],
  env: { ...process.env, OSCAR_MATTER_DIR: matter },
});
const client = new Client({ name: "tabular-smoke", version: "0.0.1" });
await client.connect(transport);

const parse = (res) => JSON.parse(res.content[0].text);

try {
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(
    tools,
    [
      "add_column",
      "add_documents",
      "create_review",
      "finalize_review",
      "ingest_results",
      "list_reviews",
      "read_manifest",
      "rerun_cell",
      "set_human_review",
    ],
    "tool set",
  );

  const created = parse(
    await client.callTool({
      name: "create_review",
      arguments: {
        title: "Smoke review",
        columns: [{ label: "Governing law", prompt: "What law governs this agreement?", type: "string" }],
        documents: [{ document_id: "nda_acme", document_name: "NDA — Acme", rel_path: "contracts/nda_acme.txt" }],
      },
    }),
  );
  const reviewId = created.review_id;
  const colId = created.columns[0];
  assert.ok(reviewId, "review_id minted server-side");

  // Grounded quote → complete.
  let r = parse(
    await client.callTool({
      name: "ingest_results",
      arguments: {
        review_id: reviewId,
        kind: "initial",
        columns: [colId],
        batch: [
          {
            document_id: "nda_acme",
            cells: [
              {
                column_id: colId,
                answer: "England and Wales",
                quote: "governed by the laws of England and Wales",
                locator: "Section 8",
                confidence: "high",
              },
            ],
          },
        ],
      },
    }),
  );
  assert.equal(r.summary.complete, 1, "grounded quote → complete");

  let m = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: reviewId } }));
  assert.ok(m.rows[0].cells[colId].verification.grounded, "grounding verdict is grounded");

  // Ungrounded quote → flagged + confidence forced low (ADR-112).
  r = parse(
    await client.callTool({
      name: "ingest_results",
      arguments: {
        review_id: reviewId,
        kind: "rerun",
        columns: [colId],
        batch: [
          {
            document_id: "nda_acme",
            cells: [
              {
                column_id: colId,
                answer: "New York",
                quote: "governed by the laws of the State of New York",
                confidence: "high",
              },
            ],
          },
        ],
      },
    }),
  );
  assert.equal(r.summary.flagged, 1, "ungrounded quote → flagged");
  m = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: reviewId } }));
  assert.equal(m.rows[0].cells[colId].confidence, "low", "ungrounded → confidence forced low");

  // Malformed payload → failed, never silently dropped.
  r = parse(
    await client.callTool({
      name: "ingest_results",
      arguments: {
        review_id: reviewId,
        kind: "rerun",
        columns: [colId],
        batch: [{ document_id: "nda_acme", cells: "this is not an array" }],
      },
    }),
  );
  assert.equal(r.summary.failed, 1, "malformed payload → failed");

  // No-source (unknown document, no rel_path) → complete but unverified.
  await client.callTool({
    name: "ingest_results",
    arguments: {
      review_id: reviewId,
      kind: "initial",
      columns: [colId],
      batch: [
        {
          document_id: "msa_zen",
          document_name: "MSA — Zenith",
          cells: [{ column_id: colId, answer: "Delaware", quote: "Delaware", confidence: "medium" }],
        },
      ],
    },
  });
  m = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: reviewId } }));
  const zen = m.rows.find((row) => row.document_id === "msa_zen");
  assert.equal(zen.cells[colId].status, "complete", "no-source stays complete");
  assert.equal(zen.cells[colId].verification.method, "no-source");

  // Answer with no quote → cannot ground (ADR-114) → flagged via method 'no-quote'.
  await client.callTool({
    name: "ingest_results",
    arguments: {
      review_id: reviewId,
      kind: "rerun",
      columns: [colId],
      batch: [{ document_id: "nda_acme", cells: [{ column_id: colId, answer: "England and Wales", quote: null, confidence: "high" }] }],
    },
  });
  m = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: reviewId } }));
  assert.equal(m.rows[0].cells[colId].status, "flagged", "answer without quote → flagged");
  assert.equal(m.rows[0].cells[colId].verification.method, "no-quote", "no-quote method recorded");

  // Re-ground it so the human-review verdict lands on a grounded cell.
  await client.callTool({
    name: "ingest_results",
    arguments: {
      review_id: reviewId,
      kind: "rerun",
      columns: [colId],
      batch: [{ document_id: "nda_acme", cells: [{ column_id: colId, answer: "England and Wales", quote: "governed by the laws of England and Wales", confidence: "high" }] }],
    },
  });

  // Human review folds into the cell + recomputes summary.verified (ADR-115).
  let h = parse(
    await client.callTool({
      name: "set_human_review",
      arguments: { review_id: reviewId, document_id: "nda_acme", column_id: colId, state: "verified", note: "checked against Section 8" },
    }),
  );
  assert.equal(h.ok, true, "set_human_review ok");
  assert.equal(h.summary.verified, 1, "verified counted in summary");
  m = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: reviewId } }));
  assert.equal(m.rows[0].cells[colId].human.state, "verified", "human verdict folded into cell");

  // Override carries the corrected value; a missing cell errors (never silent).
  h = parse(
    await client.callTool({
      name: "set_human_review",
      arguments: { review_id: reviewId, document_id: "nda_acme", column_id: colId, state: "overridden", override: "England & Wales" },
    }),
  );
  m = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: reviewId } }));
  assert.equal(m.rows[0].cells[colId].human.override, "England & Wales", "override value stored");
  const miss = parse(
    await client.callTool({
      name: "set_human_review",
      arguments: { review_id: reviewId, document_id: "nope", column_id: colId, state: "flagged" },
    }),
  );
  assert.equal(miss.ok, false, "human review on a missing document errors, not silently");

  // Dedupe/guard (Sprint 35 fix): a drifted column id (GOVERNING_LAW) re-keys to
  // the declared column; an unrecognised id (bogus-col) is skipped — no phantom
  // cell — and the run note records the skip (never silent).
  await client.callTool({
    name: "ingest_results",
    arguments: {
      review_id: reviewId,
      kind: "rerun",
      columns: [colId],
      batch: [
        {
          document_id: "nda_acme",
          cells: [
            { column_id: "bogus-col", answer: "phantom", quote: "x", confidence: "low" },
            { column_id: colId.toUpperCase().replace(/-/g, "_"), answer: "England and Wales", quote: "governed by the laws of England and Wales", confidence: "high" },
          ],
        },
      ],
    },
  });
  m = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: reviewId } }));
  assert.ok(!("bogus-col" in m.rows[0].cells), "unrecognised column id is not merged as a phantom cell");
  assert.equal(Object.keys(m.rows[0].cells).length, 1, "drifted id re-keyed to the declared column; no phantom cells");
  assert.match(m.runs[m.runs.length - 1].notes || "", /skipped 1 cell/, "skipped cell recorded in run notes");

  // Basename fallback (Sprint 35 dogfood fix): a row carrying a BARE-filename
  // rel_path whose file actually lives in contracts/ must still ground — the agent
  // routinely passes bare filenames even when documents sit in a subfolder.
  const r2 = parse(
    await client.callTool({
      name: "create_review",
      arguments: {
        title: "Bare-path review",
        columns: [{ label: "Liability", prompt: "What is the liability cap?", type: "string" }],
        documents: [{ document_id: "msa_sub", document_name: "MSA — bare path", rel_path: "msa_sub.txt" }],
      },
    }),
  );
  await client.callTool({
    name: "ingest_results",
    arguments: {
      review_id: r2.review_id,
      kind: "initial",
      columns: [r2.columns[0]],
      batch: [{ document_id: "msa_sub", cells: [{ column_id: r2.columns[0], answer: "12 months’ fees", quote: "shall not exceed the fees paid in the preceding twelve months", confidence: "high" }] }],
    },
  });
  const m2 = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: r2.review_id } }));
  const bareCell = m2.rows[0].cells[r2.columns[0]];
  assert.equal(bareCell.verification.method, "charOverlap", "bare-filename rel_path grounds via basename fallback");
  assert.equal(bareCell.verification.grounded, true, "basename-fallback cell is grounded");
  assert.equal(bareCell.status, "complete", "basename-fallback cell stays complete");

  // list_reviews surfaces existing reviews so the agent can resume by id (Sprint 35
  // dogfood: the agent lost the review_id on interruption and duplicated the review).
  const idx = parse(await client.callTool({ name: "list_reviews", arguments: {} }));
  assert.ok(Array.isArray(idx.reviews) && idx.reviews.some((r) => r.review_id === reviewId), "list_reviews surfaces the review for resume");

  // add_documents appends new rows and ignores ids already present.
  const addDoc = parse(
    await client.callTool({
      name: "add_documents",
      arguments: {
        review_id: reviewId,
        documents: [
          { document_id: "nda_acme", document_name: "dup — ignored" },
          { document_id: "new_doc", document_name: "New Doc" },
        ],
      },
    }),
  );
  assert.equal(addDoc.ok, true, "add_documents ok");
  assert.equal(addDoc.added, 1, "add_documents added only the genuinely new row");
  m = parse(await client.callTool({ name: "read_manifest", arguments: { review_id: reviewId } }));
  assert.ok(m.rows.some((row) => row.document_id === "new_doc"), "new document row present");

  // Finalize, then confirm on-disk persistence + the launcher index.
  const fin = parse(await client.callTool({ name: "finalize_review", arguments: { review_id: reviewId } }));
  assert.equal(fin.entry.status, "final");

  const manifestPath = join(matter, "outputs", "tabular-review", reviewId, "manifest.json");
  assert.ok(existsSync(manifestPath), "manifest persisted to the matter folder");
  const index = JSON.parse(
    readFileSync(join(matter, "outputs", "tabular-review", "index.json"), "utf8"),
  );
  const finalized = index.reviews.find((r) => r.review_id === reviewId);
  assert.ok(finalized, "finalized review present in index");
  assert.equal(finalized.status, "final");

  console.log(
    "ok: oscar-tabular MCP smoke passed (real client harness — tools, grounding gate, never-silent failed path, persistence)",
  );
} finally {
  await client.close();
  rmSync(matter, { recursive: true, force: true });
}
