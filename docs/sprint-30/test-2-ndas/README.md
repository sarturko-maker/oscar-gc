# Sprint 30 — Test 2: 10 NDAs simultaneously

## Lead — what the wiring let through

The load-bearing question on Test 2 was Arturs's "the hope is MiniMax
will spin multiple agents to review the documents simultaneously."
**The answer is no.** With the `summon`/`delegate` platform extension
present and default-enabled, MiniMax-M2.5 read all 10 NDAs serially
(6 then 4) and produced a competent per-NDA triage table without ever
invoking `delegate`. It used `redline__read_docx` rather than
`computercontroller__docx_tool` (positive — the redline tool surface
is well-described in the recipe and the agent picked it up), but
followed the Sprint 9 ADR-020 "always read before you redline"
doctrine even on a triage task (outline read + full read per NDA on
wave 1 — 12 reads for 6 documents). The on-demand NDA-review
playbook uploaded in this matter was not consulted; neither was the
bundled `nda-review` skill invoked by name. The late-drop wave-2 was
handled cleanly (re-listed the directory, identified the new 4 only,
did not re-read the first 6). The follow-up counterparty email on a
RED NDA was drawn from prior analysis without re-reading the file.

## What this finding implies for Sprint 31

- **Multi-agent / `summon` uptake is the headline finding.** MiniMax
  does not spontaneously delegate batch document review to
  subagents, even when (a) the extension is present and visible,
  (b) the prompt says "give me a per-NDA read on each", and (c)
  the workload is obviously parallelisable. Sprint 31 candidate:
  test whether explicit prompting ("delegate this to N subagents")
  works — if yes, the gap is "no proactive uptake on
  parallelisable tasks". If no, the gap is structural.
- **Sprint 9 redline doctrine ("always read before you redline")
  leaks into triage workflows.** The system prompt's
  redline-tool description tells the agent to call
  `redline__read_docx` with both outline and full modes before any
  redline. The agent applied this even when no redline was asked
  for, doubling token usage on wave 1. Sprint 31 candidate:
  re-scope the "always read" guidance to redline-intent turns
  only.
- **On-demand NDA playbook again unread.** Mirrors Test 1's
  finding. Two-data-point confirmation that the Sprint 29 M6 block
  alone is not a strong enough signal to drive consultation.
- **Bundled `nda-review` skill not invoked.** Mirrors Test 1.
- **Late-drop handling is clean** — the agent re-lists when given
  a vague follow-up ("a few more came in"), reads only the new
  files, and weaves them into the existing analysis without
  redundant work on the wave-1 NDAs.
- **Memory across turns within a session is strong.** Turn 3's
  Cypress email was drafted from Turn 1's analysis without
  re-reading the file. This is the per-session context working as
  intended; no Sprint 31 work required here.

## Run conditions

| Field | Value |
|---|---|
| Date | 2026-05-25 |
| Binary | `/srv/projects/goose/ui/desktop/out/Oscar-GC-linux-x64/oscar-gc` (Sprint 29 M8 zip build) |
| Provider | MiniMax-M2.5 (default settings) |
| Persona | Helena Marwick, General Counsel, Stanford Industrial Supply Co. |
| Matter | "NDA triage week 21" (Commercial area, slug `nda-triage-week-21`) |
| Session ID | `20260525_14` (3 turns, 60 messages, 21 tool calls) |
| MiniMax spend | $0.1215 (well under per-test estimate) |
| Wave 1 | 6 NDAs in matter folder at session-open |
| Wave 2 | 4 NDAs dropped between Turn 1 and Turn 2 |
| Optional NDA playbook | Uploaded — `~/.config/oscar/playbooks/commercial/nda-review-playbook.md`, off-always-on |
| Adeu venv | Present at bundle path (created during Test 1 phase to remediate the deploy-shape gap; redline extension bound this time) |

## Fixtures

10 NDA DOCX files, each ~37 KB OOXML. Counterparties vary across
industries (manufacturing, logistics, SaaS, ERP, research,
cloud, consulting). Substantive variation across:

- Mutual vs bilateral
- Term length (2-5 years)
- Survival period (3 years to perpetual)
- CI definition breadth
- Carve-out presence (standard, narrow, missing residuals)
- Governing law (England, Germany, California, Texas)
- Beyond-confidentiality clauses (non-solicit, non-compete, liquidated damages)

| Wave | # | File | Designed verdict | Agent verdict |
|---|---|---|---|---|
| 1 | 1 | nda-acme-tooling.docx | GREEN | GREEN ✅ |
| 1 | 2 | nda-betacorp-logistics.docx | YELLOW | YELLOW ✅ |
| 1 | 3 | nda-cypress-saas.docx | RED | RED ✅ |
| 1 | 4 | nda-delphi-components.docx | GREEN | YELLOW (caught oral-confirmation friction) |
| 1 | 5 | nda-emberlake-cobidder.docx | YELLOW | RED (caught broad CI + non-solicit) |
| 1 | 6 | nda-folium-research.docx | GREEN | GREEN ✅ |
| 2 | 7 | nda-greenline-erp.docx | RED | RED ✅ |
| 2 | 8 | nda-harborwave-cloud.docx | GREEN | GREEN ✅ |
| 2 | 9 | nda-iris-consulting.docx | YELLOW | YELLOW ✅ |
| 2 | 10 | nda-jadestone-mfg.docx | GREEN | GREEN ✅ |

(7 of 10 verdicts match fixture intent; 2 came out one notch
stricter than intended; 1 unclassified by fixture designer ended up
matching). Substance accuracy is outside the brief but the spread
shows the rubric was applied consistently.

## Findings table (per brief — Test 2 specific rows)

| # | Observation | Result | Evidence |
|---|---|---|---|
| 1 | Agent processed all 10 NDAs | ✅ Yes | 6 reads in wave 1 + 4 reads in wave 2 |
| 2 | Agent went parallel (`delegate` calls) or serial | ❌ Serial (S, 0 delegate calls) | `tool-timeline.md` — only oscar-fs / redline / todo / write tools used |
| 3 | `summon`/`delegate` extension was bound in the session | ✅ Yes | `recipe_json.extensions` includes `summon` (platform), default-enabled per ADR-063 |
| 4 | Agent invoked `nda-review` skill (named/paraphrased) | ❌ No | No `load_skill` call; agent's reasoning text does not name "nda-review" skill |
| 5 | Optional on-demand playbook read | ❌ No | No `oscar-fs__read_file` against `~/.config/oscar/playbooks/commercial/nda-review-playbook.md` |
| 6 | Wave 2 handled without re-doing wave 1 work | ✅ Yes | Turn 2: only `redline__read_docx` calls on the 4 new files (greenline, harborwave, iris, jadestone); no reads of the wave-1 6 |
| 7 | Follow-up email drew from prior work (not re-read) | ✅ Yes | Turn 3: no `redline__read_docx` on Cypress; email written via `write` (developer tool) using prior analysis |
| 8 | Agent re-listed directory on wave-2 prompt | ✅ Yes | Turn 2: `oscar-fs__list_directory` was first call before reading any file |
| 9 | Each NDA read with appropriate tool | ✅ Yes (redline) | Used `redline__read_docx` (12 calls wave 1 in outline+full modes; 4 calls wave 2 in full-only) rather than `computercontroller__docx_tool` |

## Tool-call summary

21 tool calls across 3 turns. Full timeline in `tool-timeline.md`.

| Turn | User message | Agent tool calls | Notes |
|---|---|---|---|
| 1 | Triage 6 NDAs GREEN/YELLOW/RED | list_directory → matter.md read → 6× redline__read_docx (outline) → 6× redline__read_docx (full) → todo_write → text | 14 tool calls. Serial, no delegate. Outline+full per NDA = 2× reads. |
| 2 | "A few more came in — same triage" | list_directory → 4× redline__read_docx (full only) → text | 5 tool calls. Re-listed correctly; identified the new 4; did not re-read first 6; dropped the outline-pass on wave 2. |
| 3 | "Draft counterparty email on Cypress" | write (to `outputs/email-cypress-nda-counter.docx`) → text | 1 tool call. Drew from prior analysis. Wrote markdown content with `.docx` extension (cosmetic gap — developer's `write` doesn't recognise the extension semantic). |

## What the agent saw in the recipe

The on-demand playbooks block (Sprint 29 M6) enumerated both
playbooks:
- `commercial/rfq-review-playbook.md` (this area, 10 KB) — RFQ Review Playbook — In-House Commercial Counsel
- `commercial/nda-review-playbook.md` (this area, 8 KB) — NDA Review Playbook — In-House Commercial Counsel

The skill enumeration block listed all 10 `commercial-legal` skills
including `nda-review`.

The Commercial bespoke system prompt described the three `redline__*`
tools with the "Always read before you redline" instruction
verbatim.

12 extensions in the recipe; the redline extension successfully
bound this time (the bundled adeu venv was created during Test 1's
remediation step).

Neither the NDA playbook nor the `nda-review` skill was consulted
despite both being explicitly enumerated and despite the prompt
matching their topic exactly.

## Files in this report

- `README.md` — this file
- `transcript.json` — raw message stream (60 messages)
- `tool-timeline.md` — chronological tool calls (21 entries)
- `screenshots/test2-ndas/` — turn-by-turn screenshots
- `outputs/email-cypress-nda-counter.docx` — agent's Turn 3 deliverable (markdown content with .docx extension; substance is correct)
- `fixtures/staged/` — 10 NDA DOCX fixtures
- `fixtures/build_ndas.py` — fixture generator (python-docx)
- `fixtures/nda-review-playbook.md` — the on-demand NDA playbook uploaded for this test
