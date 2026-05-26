# ADR-105: Re-scope the redline read doctrine to redline-intent turns

Sprint 31 (2026-05-26). Status: Accepted. Closes Sprint 30 finding ([[ADR-101]] §C). Cites [[ADR-020]].

## Context

Sprint 30 Test 2 (`docs/sprint-30/test-2-ndas/`) found the agent read
each NDA twice (mode: 'outline' + mode: 'full') on Turn 1's triage
wave — 12 reads for 6 documents — even though the lawyer's ask was
explicitly triage, not redline. [[ADR-020]]'s five-step doctrine
includes step 2 ("Read the document. ... For documents longer than a
few pages, start with `mode: 'outline'` ..."), and the redline-tool
description in the system prompt opens with "**Always read before you
redline.**" The agent generalised the doctrine: outline+full became
the default read pattern for any DOCX, not the redline-planning
pattern step 2 prescribed.

[[ADR-020]] itself is not the bug — the doctrine is correct for
redline tasks. The bug is that the doctrine bled into non-redline
turns. The brief asks for a rewording in the Commercial system prompt,
not a structural change to [[ADR-020]].

## Decision

Two surgical edits in `commercial/systemPrompt.ts`:

1. **Redline-tool description** (`redline__read_docx` block) — append
   a non-redline qualifier: "For non-redline reads (triage, summary,
   Q&A about a document), a single `mode: 'full'` call is sufficient
   — outline mode is for redline planning across long, multi-section
   documents where you'll draft coordinated edits."
2. **Five-step redline doctrine intro** — prepend an explicit
   scope-of-application sentence:
   > "**This doctrine applies WHEN the lawyer's ask is a redline** —
   > change, amend, mark up, redline, modify, draft an alternative.
   > For non-redline asks (triage, review, summary, Q&A about a
   > document, drafting plain-text replies), skip the doctrine: read
   > once with `mode: 'full'` and proceed."

3. **Step 2 phrasing** — sharpen the outline-mode threshold from "more
   than a few pages" (loose) to "longer than a dozen pages where
   you'll plan coordinated edits across multiple sections", and label
   the outline+full sequence explicitly as "a redline-planning tool,
   not a general read pattern".

The doctrine is unchanged; the scope-of-application is now explicit.

## Alternatives rejected

- **Strip "Always read before you redline" entirely.** It's still
  load-bearing for redline tasks (the Sprint 9 dogfood — ADR-020
  Sprint 9 entry — established this). Keep it; add the non-redline
  qualifier.
- **Move the outline+full sequence into the playbook (skill body)
  rather than the system prompt.** Decouples doctrine from prompt
  cost; but the doctrine is short and the redline path is the
  primary Commercial task. System prompt is the right surface.
- **Detect intent server-side and inject different prompts.** Way
  beyond scope; the agent can read the lawyer's ask and apply scope
  itself, which is exactly what the rewording cues.

## Smoke check

Test 1 Turn 5 ("Mark up the MSA with our redline") should continue to
invoke step 2's outline+full sequence on the MSA — a redline task on
a multi-section document. Test 2 Turn 1 ("Triage these 6 NDAs
GREEN/YELLOW/RED") should now drop the outline pass — a triage task
where step 2 doesn't apply. This is the direct delta against
Sprint 30 Test 2's "12 reads for 6 documents" baseline.

## Caveats

- This is doctrine rewording, not architectural. [[ADR-020]] remains
  the doctrine of record; its full text is unchanged. The rewording
  is at the system-prompt surface only.
- The threshold "longer than a dozen pages" is a heuristic, not a
  hard rule. The agent has license to apply step 2's outline+full
  to a 9-page document if the coordinated-edit complexity warrants
  it. The point of the rewording is removing the **non-redline**
  application, not narrowing the redline application.

Cites: [[ADR-020]], [[ADR-101]].
