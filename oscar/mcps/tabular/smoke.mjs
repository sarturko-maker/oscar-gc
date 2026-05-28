// SPDX-License-Identifier: AGPL-3.0-or-later
// Exercises the deterministic core of oscar-tabular against the compiled dist:
// round-trip persistence, the grounding gate (grounded → complete; ungrounded →
// flagged + low confidence; no-source → complete-but-unverified), and the
// never-silent failed path for malformed payloads (ADR-111, ADR-112).

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createManifest, ingest } from "./dist/merge.js";
import { TabularStore } from "./dist/store.js";
import { readSourceText } from "./dist/matterDir.js";
import { ColumnSchema } from "./dist/schema.js";

const matter = mkdtempSync(join(tmpdir(), "oscar-tabular-smoke-"));
process.env.OSCAR_MATTER_DIR = matter;

try {
  mkdirSync(join(matter, "contracts"), { recursive: true });
  const docText =
    "MUTUAL NON-DISCLOSURE AGREEMENT\n\nSection 8. Governing Law. This Agreement shall be " +
    "governed by the laws of England and Wales.\n";
  writeFileSync(join(matter, "contracts", "nda_acme.txt"), docText, "utf8");

  const store = new TabularStore(matter);
  const columns = [
    ColumnSchema.parse({
      id: "governing-law",
      label: "Governing law",
      prompt: "What law governs this agreement?",
      type: "string",
    }),
  ];
  const docs = [
    { document_id: "nda_acme", document_name: "NDA — Acme", rel_path: "contracts/nda_acme.txt" },
  ];

  let manifest = createManifest("smoke-review-1", "Smoke review", matter, columns, docs);
  await store.writeManifest(manifest, "in_progress");

  // Round-trip persistence.
  const reread = await store.readManifest("smoke-review-1");
  assert.ok(reread, "manifest re-reads from disk");
  assert.equal(reread.rows.length, 1);
  assert.equal(reread.summary.total, 1);
  assert.equal(reread.summary.pending, 1, "untouched cell counts as pending");

  const ctx = { getDocText: (rel) => readSourceText(rel, matter) };

  // 1) Grounded quote → complete.
  manifest = await ingest(
    reread,
    [
      {
        document_id: "nda_acme",
        cells: [
          {
            column_id: "governing-law",
            answer: "England and Wales",
            quote: "governed by the laws of England and Wales",
            locator: "Section 8",
            confidence: "high",
          },
        ],
      },
    ],
    { kind: "initial", columns: ["governing-law"] },
    ctx,
  );
  let cell = manifest.rows[0].cells["governing-law"];
  assert.equal(cell.status, "complete", "grounded quote → complete");
  assert.ok(cell.verification?.grounded, "grounding verdict is grounded");
  assert.equal(manifest.summary.complete, 1);

  // 2) Ungrounded quote → flagged + confidence forced low (ADR-112).
  manifest = await ingest(
    manifest,
    [
      {
        document_id: "nda_acme",
        cells: [
          {
            column_id: "governing-law",
            answer: "New York",
            quote: "governed by the laws of the State of New York",
            confidence: "high",
          },
        ],
      },
    ],
    { kind: "rerun", columns: ["governing-law"] },
    ctx,
  );
  cell = manifest.rows[0].cells["governing-law"];
  assert.equal(cell.status, "flagged", "ungrounded quote → flagged");
  assert.equal(cell.confidence, "low", "ungrounded → confidence forced low");
  assert.equal(manifest.summary.flagged, 1);

  // 3) Malformed payload → failed, never silently dropped.
  manifest = await ingest(
    manifest,
    [{ document_id: "nda_acme", cells: "this is not an array" }],
    { kind: "rerun", columns: ["governing-law"] },
    ctx,
  );
  cell = manifest.rows[0].cells["governing-law"];
  assert.equal(cell.status, "failed", "malformed payload → failed");
  assert.equal(manifest.summary.failed, 1);

  // 4) No-source (binary/unreadable, here: a document with no rel_path) → stays
  //    complete but visibly unverified rather than green-ticked.
  manifest = await ingest(
    manifest,
    [
      {
        document_id: "msa_zen",
        document_name: "MSA — Zenith",
        cells: [
          { column_id: "governing-law", answer: "Delaware", quote: "Delaware", confidence: "medium" },
        ],
      },
    ],
    { kind: "initial", columns: ["governing-law"] },
    ctx,
  );
  const zen = manifest.rows.find((r) => r.document_id === "msa_zen");
  assert.ok(zen, "upserted unknown document");
  assert.equal(zen.cells["governing-law"].status, "complete", "no-source stays complete");
  assert.equal(zen.cells["governing-law"].verification?.method, "no-source");
  assert.equal(zen.cells["governing-law"].verification?.grounded, false);

  // Finalize and confirm the launcher index.
  await store.writeManifest(manifest, "final");
  const index = await store.readIndex();
  assert.equal(index.reviews.length, 1);
  assert.equal(index.reviews[0].status, "final");
  assert.equal(index.reviews[0].document_count, 2);

  console.log("ok: oscar-tabular smoke passed (round-trip, grounding gate, never-silent failed path)");
} finally {
  rmSync(matter, { recursive: true, force: true });
}
