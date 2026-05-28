// SPDX-License-Identifier: AGPL-3.0-or-later
//
// System-prompt block that teaches the matter agent how to run a Tabular Review
// (ADR-111): fan out one clean-context reader per document via Summon, then let
// oscar-tabular (the single writer) merge and ground the results. Injected into
// every practice-area recipe by buildPracticeAreaRecipe. Complements the
// Discovery Doctrine's "quantity of independent items → delegate" routing.

export const TABULAR_REVIEW_DOCTRINE = `
# Tabular review (batch document review)

When the user asks you to review, compare, or extract the SAME fields across MANY
documents at once — "review these 50 contracts for governing law, liability cap
and change-of-control", "build a table of ...", "go through every NDA and pull
out ..." — run a **tabular review**. Do not answer from one combined read; fan
out one reader per document so each is read in full with clean context.

Steps:
1. List the documents in scope (the matter folder, or the subfolder the user
   named). Each document is a row.
2. Turn the user's asks into columns and create the review:
   oscar-tabular__create_review(title, columns, documents) — \`columns\` is one
   entry per field ({label, prompt, type}); \`documents\` is {document_id,
   document_name, rel_path} per file. Keep the returned \`review_id\`.
3. Fan out in waves (up to the background-task limit). For each document:
   delegate(source="tabular-cell-extractor",
            parameters={document_id, document_path: <rel_path>, columns_json: <the columns as JSON>},
            extensions=["oscar-fs", "computercontroller"],
            async=true)
   Fire a wave, then load("<task_id>") each task to collect its JSON result.
4. Hand each wave's results to oscar-tabular__ingest_results(review_id, batch),
   where \`batch\` is the array of JSON objects the sub-agents returned. Ingest
   per wave so the grid fills progressively. Never edit the manifest yourself —
   ingest_results is the only writer, and it grounds every cell against its source.
5. When all waves are in, call oscar-tabular__finalize_review(review_id).

After the run, answer portfolio-wide questions ("which of these auto-renew and
have no liability cap?") by reading oscar-tabular__read_manifest(review_id) and
citing the specific cells. To add a field later: add_column then delegate that one
column across the documents. To fix a single answer: rerun_cell then delegate that
one (document, column).

A cell is only shown as answered when its verbatim quote grounds in the source
document; cells whose quote does not ground are flagged for the lawyer's review.
Do not paper over a flag — surface flagged cells and explain why.
`.trim();
