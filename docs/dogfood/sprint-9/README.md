# Sprint 9 dogfood report — adeu redline round-trip

## Sprint scope

Wire `adeu==1.6.9` as a stdio MCP for the Commercial practice area; verify a lawyer-quality redline round-trip end-to-end. This is the fourth and final item of the project's four-item short-term goal (PROJECT.md §"The one goal"). After Sprint 9 the foundational scope is complete.

The Sprint 9 addendum raised the bar from "byte-level round-trip" to "lawyer-quality reasoning + OOXML-verified output." This report meets that bar.

## Methodology

**Phase 0 verification gate** — installed adeu==1.6.9 into `/srv/projects/oscar-runtime/python/adeu-venv/`, probed it via the official `mcp` Python SDK over stdio (script at `/tmp/mcp_probe.py`, captured output at `adeu-tools-list.json`). Inventory: 11 tools. Critical schema delta from the original plan: `process_document_batch` returns `{result: string}` and writes the modified `.docx` to `output_path` on disk — there is no binary `resource` content block. Phase 5 of the original plan (UI Download button on `resource` blocks) was dropped accordingly; egress became a disk-write convention (ADR-019).

**Registration** — `~/.config/goose/config.yaml` gets a `redline:` extension entry (stdio, `cmd: /srv/projects/oscar-runtime/python/adeu-venv/bin/adeu-server`, `available_tools: [read_docx, process_document_batch, diff_docx_files]`). Per ADR-017, extension `name: redline` IS the capability seam (config-level DI). Confirmed via CLI: a `goose run --text "List the redline__ tools"` reply enumerates exactly the three whitelisted tools as `redline__read_docx`, `redline__process_document_batch`, `redline__diff_docx_files`.

**Commercial chat surface** — recipe-scoped per Sprint 6 onboarding pattern. New module `ui/desktop/src/components/oscar/commercial/{systemPrompt.ts, commercialRecipe.ts, OscarCommercialView.tsx}`. The system prompt encodes ADR-020's five-step lawyer-reasoning doctrine. `PracticeAreaPlaceholder.tsx` branches on `areaId === 'commercial'` to render `OscarCommercialView`, which bootstraps a recipe-scoped session and navigates to `/pair?resumeSessionId=<id>`, letting Goose's existing `BaseChat` handle attachments + tool rendering + streaming.

**Verification** — both a CLI round-trip (this report) and an OOXML structural walk against the addendum's verification standard.

## The round-trip

**Fixture**: `fixtures/unilateral-nda.docx` — a hand-drafted 1-2 page commercial unilateral NDA (English law). Party A discloses; Party B receives. 24 mentions of Party A vs 18 of Party B + 1 "Receiving Party". Substantively unilateral; requires 7-8 coordinated edits to make mutual. Provenance recorded in `fixtures/PROVENANCE.md`.

**Instruction**: "I have an NDA at /srv/projects/goose/docs/dogfood/sprint-9/fixtures/unilateral-nda.docx. Please make it mutual — both parties should have the same confidentiality obligations. Write the output to: /root/Documents/Oscar Redlines/unilateral-nda_redlined_20260518-175442.docx."

**Run**:
- `goose run --no-session --system <SYSTEM_PROMPT> -t <instruction>`
- Provider: `GOOSE_PROVIDER=minimax GOOSE_MODEL=MiniMax-M2.5`
- Wall-clock duration: ~2 minutes (4 tool calls: 2× read_docx outline+full, 1× process_document_batch attempt-1 fails on missing `type`, 1× process_document_batch retry succeeds, 1× read_docx clean_view to verify).

**Agent transcript** (`cli-transcript.txt` next to this README): contains the full reasoning trace. Highlights:

1. **Step 1 — read intent**: "I'll make this NDA mutual — both parties with symmetric confidentiality obligations."
2. **Step 2 — read document**: outline mode then full mode.
3. **Step 3 — plan coordinated edits**: numbered 9-item plan visible in the transcript.
4. **Step 4 — apply batch**: 8 typed `modify` operations in one `process_document_batch`. First attempt missed the `type` field on each change; adeu's `BatchValidationError` surfaced; agent retried with `type: modify` set — successful.
5. **Step 5 — coherence verify**: read the output with `clean_view: true`; **surfaced a real concern** that Clause 8 (No Licence) is still asymmetric and asked the lawyer whether to extend the mutuality there.

## Verification outcomes

**OOXML-level (`verification.sh`):**

```
✓ md5 differs
✓ mutual-markers increased by 30 (input 2 → output 32)
✓ track-changes markup present (8 w:ins, 7 w:del)
✓ output is a valid DOCX (24 paragraphs)
```

**Change-by-change walk (`verification-ooxml.md`)**: each of the 8 typed-modify operations catalogued against the intent it served. All 8 are correctly mirrored. Clauses the agent did not modify (Term, No Licence, Governing Law, Miscellaneous) are correctly identified — Term/Governing Law/Miscellaneous already symmetric; No Licence flagged.

**Lawyer-quality comparison (`verification-comprehension.md`)**: side-by-side of agent output vs CC's lawyer-shaped reference draft. Findings:

- **P1** — system prompt allows Markdown emphasis in `new_text`; agent used `**bold**` on substantive contract language. Counterparties do not expect bold-emphasis on contract text. Sprint 10 candidate: tighten the system prompt to restrict Markdown to structural formatting.
- **P2** — capitalization inconsistency on defined term "Disclosing Party" / "disclosing Party". Sprint 10 candidate.
- **P2** — Clause 8 (No Licence) not auto-handled. Agent transparently flagged it. Sprint 10 candidate: extend system-prompt scope-of-mutuality reminder.
- **P3** — Purpose recital subject-matter still names "Party A's industrial process control software." Judgment call; defensible.

## Findings against the addendum's verification standard

The addendum required:
- ✅ **Substantive fixture, not trivial** — 1-2 page real-shape NDA, 7-8 coordinated edits required.
- ✅ **OOXML-level verification (not just byte hash)** — `verification-ooxml.md` walks every change against its intent.
- ✅ **Lawyer-quality comparison artifact** — `verification-comprehension.md` with side-by-side and gaps reported as findings.
- ✅ **System-prompt-shape ADR** — ADR-020 captures the five-step doctrine.
- ✅ **adeu 1.6.9 source-verified about multi-edit** — `adeu-schema.md` documents the live MCP probe; `process_document_batch` natively handles coordinated multi-edit via the `changes` array. `diff-match-patch` is a transitive dep of adeu used internally by adeu's `RedlineEngine`, not bolted on by us. No external orchestration layer added.

## Sprint 9 closes the four-item short-term goal

Per `PROJECT.md` §"The one goal", the four items were:

1. Fork Goose (closed Sprint 1).
2. Replace UI layer with in-house-legal UI (closed by Sprint 3-8 — branding, sidebar, onboarding chat, Hub banner).
3. Replace memory layer with scoped MCP server (closed Sprint 5).
4. Wire adeu as MCP server for Commercial — **closed by this sprint.**

The roadmap opens up after Sprint 9. PROJECT.md Sprint Index updated; SPRINT_LOG entry committed at sprint close.

## Carry-forwards for Sprint 10+

- **P1/P2 from comprehension comparison**: system prompt iteration for Markdown discipline, defined-term capitalization, scope-of-mutuality reminder. Single sub-sprint of prompt-and-redogfood work.
- **Memory MCP wiring into the desktop binary** (Sprint 5 carry-forward, still pending). `oscar-memory-mcp` is registered but the Commercial agent doesn't call it from the desktop yet.
- **Practice-area-scoped tool exposure** (Commercial gets redline, others don't). Sprint 9 enables `redline` globally; the recipe is the seam. Per-area gating is a future memory/practice-area sprint.
- **UI download / "Open output folder" affordance** — Sprint 9 dropped Phase 5 because adeu writes to disk directly. If dogfood ever reveals friction, a future UI polish sprint can add a "Save copy" / "Reveal in Files" affordance for tool-output paths.
- **Editorial-styled Commercial chat surface** — Sprint 9 reuses Goose's `BaseChat`. A future UI sprint can apply the Oscar Editorial styling.
- **P1-B carry-forward from Sprint 8** (system-prompt phrasing on onboarding P3) — still pending.
- **Push `oscar-onboarding-mcp` to GitHub** (Sprint 6 carry-forward) — admin hygiene.

## Artifacts

| File | Purpose |
|---|---|
| `adeu-schema.md` | Schema verification report (Phase 0 gating). |
| `adeu-tools-list.json` | Raw wire-level evidence — `tools/list` response. |
| `fixtures/unilateral-nda.docx` | The substantive test fixture. |
| `fixtures/PROVENANCE.md` | Provenance of the fixture. |
| `output-cli-verify.docx` | adeu's redlined output (copied from `/root/Documents/Oscar Redlines/`). |
| `cli-transcript.txt` | Full goose CLI session transcript. |
| `verification.sh` | Re-runnable byte-level + structural checks. |
| `verification-ooxml.md` | Change-by-change OOXML walk + tabular metrics. |
| `verification-comprehension.md` | Lawyer-quality comparison with findings P1/P2/P3. |
| `screenshots/` | Desktop UI confirmation captures (see below). |
