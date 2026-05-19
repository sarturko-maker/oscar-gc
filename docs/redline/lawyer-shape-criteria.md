# Lawyer-shape criteria — adeu redline output

Sprint 13 deliverable. Formalises what "lawyer-shape" means for adeu's tracked-changes output in the Commercial practice area. Source material: Sprint 9 dogfood (`docs/dogfood/sprint-9/verification-comprehension.md`) made the criteria implicit; Sprint 13 lifts them into a standalone document the user signs off against during dogfood.

These criteria are the bar a senior commercial solicitor would set on a redline they receive from another lawyer. The bar isn't "perfect" — it's "I can accept this with minor cleanup, the substantive judgement is sound, the format respects my reading workflow."

## 1. OOXML granularity

Tracked changes (`<w:ins>` and `<w:del>` elements in `word/document.xml`) wrap the words that actually changed — not whole sentences, not whole clauses.

**Pass conditions** (per Sprint 13 verification harness `scripts/dogfood/verify-redline-shape.py`):

- Median wrap width ≤ 3 words per `<w:ins>` / `<w:del>` element.
- 80th percentile ≤ 5 words.
- No element wraps 11+ words **unless** the change is a genuine wholesale rewrite (no shared text between original and new — e.g. a clause replaced rather than edited).

**Why this matters**: a senior solicitor reads a tracked-changes document by scanning the redlines. Wide w:ins/w:del wrapping unchanged words around the actual change forces re-reading; tight, word-level edits read like a careful hand-redline.

**Mechanism**: ADR-045 (adeu vendor-patch) routes `process_document_batch` edits through `generate_edits_from_text` for word-level diffing before OOXML emission. ADR-046 (prompt discipline) teaches the agent the anchor-preservation idiom so its inputs cooperate with that narrowing.

## 2. Preserve discipline

Phrases that carry legal weight survive verbatim across edits unless the instruction explicitly asks to change them. The agent names the preserved phrases in each edit (`new_text` retains them character-for-character) and emits a `comment` when preservation isn't possible.

**Phrases routinely preserved**:

- **Mandatory-law catch-outs**: "or as required by applicable law", "or as ordered by a court of competent jurisdiction", "to the extent permitted by law".
- **Qualifiers**: "on a need-to-know basis", "commercially reasonable", "reasonable endeavours", "to the extent reasonably practicable".
- **Cross-references**: "subject to Section 7.3", "as defined in clause 1.1", "in accordance with the provisions of clause N".
- **Defined terms**: `Disclosing Party`, `Receiving Party`, `Confidential Information`, `Purpose`, etc., retained verbatim (including capitalisation) once introduced.

**Pass conditions**:

- Programmatic spot-check: for 2–3 instructions that explicitly named preserve phrases, those phrases appear verbatim in the output.
- No silent drops: where preservation wasn't possible, a `comment` on the edit explains which phrase couldn't be kept and why.

## 3. Cross-clause consistency

When the instruction implies a change across multiple clauses ("make this mutual", "remove all caps on supplier liability"), the agent surfaces every clause that interacts with the intent and edits them coordinately — not just the obviously named one.

**Sprint 9 lesson**: the agent correctly flagged Clause 8 (No Licence / No Warranty) as still asymmetric after making the rest of an NDA mutual, but did not auto-extend the edit. Surfacing the gap is acceptable; silently leaving it asymmetric is not.

**Pass conditions**:

- If the agent didn't extend, it surfaces the gap explicitly in the chat reply.
- If the agent did extend, the edits are coherent across clauses (no conflict between Clause 3 and Clause 8 framings).

## 4. No emphasis-Markdown on substantive text

`new_text` does not contain `**bold**` or `_italic_` on contract language. Markdown emphasis reads as editorial annotation, not legal text. A counterparty receiving the document would not expect emphasis runs on substantive clauses.

**Allowed**: structural Markdown (`# Heading`, `\n\n` for paragraph breaks).
**Disallowed**: `**`/`_` wrapping substantive clause text.

Sprint 9 surfaced this as a P1 finding. Sprint 13 ADR-046's "Things you never do" section retains the existing rule.

## 5. Author propagation

Tracked changes are authored by the operator's identity — not "adeu" or a default. The `author_name` parameter on `process_document_batch` is set per the recipe (currently `"Oscar"`; future per-user customisation in scope for Sprint 14+).

**Pass conditions**: every `<w:ins>` / `<w:del>` carries `w:author="Oscar"` (or the operator's chosen identifier).

## 6. Coherence verification

The agent calls `redline__read_docx` on the output with `clean_view: true` after the redline lands (ADR-020 step 5). If the document still reads as a coherent contract — and the instruction's intent is reflected — the agent tells the lawyer the path and a one-line summary. If something broke, the agent surfaces the concern, not declares success.

**Pass conditions**:

- Step 5 always executed (verifiable in the conversation transcript).
- Concerns surfaced where present.

## Sign-off bar

A senior commercial solicitor opening the output `.docx` in Word or LibreOffice would say one of:

- **Pass**: "I'll accept this with the comments addressed. Lawyer time spent: a few minutes of review, no rework."
- **Reject (Sprint 14+ work)**: "I'd need to redo this from scratch. The substantive call is wrong, or the format is unusable."

Anything between ("acceptable but I'd reshape it") is a pass for Sprint 13's bar; refinements feed Sprint 14+.

## Verification methodology

End-to-end verification before user dogfood (Sprint 13 Phase 5, load-bearing gate):

1. Run the Commercial agent against `docs/dogfood/sprint-9/fixtures/unilateral-nda.docx` with a solicitor-shaped instruction.
2. Inspect output OOXML for granularity (criterion 1).
3. Spot-check preserve phrases (criterion 2).
4. Read the agent's reply for cross-clause / coherence surfaces (criteria 3, 6).
5. Verify author propagation in OOXML (criterion 5).
6. Confirm no Markdown emphasis in substantive text (criterion 4).

User dogfood on Crostini (Sprint 13 Phase 7) ratifies the criteria against a real NDA the user supplies.

## Living document

Carry-forwards from each sprint's redline dogfood refine the criteria. Material changes go through an ADR (the criteria are part of the Commercial-area contract with the user).
