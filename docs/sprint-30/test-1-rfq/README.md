# Sprint 30 — Test 1: RFQ review + redline (Pemberton Engineering)

## Lead — what the wiring let through

The Sprint 29 M6 on-demand playbook block ([[ADR-099]]), Sprint 20 M5
skill enumeration block ([[ADR-086]]), Sprint 28 Tools section
([[ADR-092]]), and Sprint 18 default-on `summon` ([[ADR-063]]) were
all confirmed present in the recipe instructions the agent saw on the
Pemberton matter (the recipe carries 12 extensions, the instructions
explicitly enumerate the RFQ playbook by name and all 10
commercial-legal skills by slug). **MiniMax-M2.5 chose not to use any
of the discovery affordances on a substantive 5-turn RFQ-review
workflow.** It went straight to reading documents via
`oscar-fs__list_directory` + `computercontroller`'s `pdf_tool` /
`docx_tool` and produced a competent first-pass analysis of the
asymmetries we deliberately seeded into the MSA — but did not consult
the playbook, did not invoke a named skill, and did not delegate any
subtask. On the redline ask it correctly reached for
`redline__process_document_batch` with a properly-constructed
7-change batch, but the bundled-binary's adeu venv was missing
(deploy-shape gap for the zip build — the .deb's postinst creates the
venv at install time, the zip build does not); a follow-up isolated
matter after manually creating the venv confirmed the redline path
works end-to-end. The late-document drop observation (Sprint 14
matter-folder-watcher gap) worked cleanly: when asked vaguely about
"what they sent after the first batch", the agent re-listed the
directory and found the new file without naming.

## What this finding implies for Sprint 31

- **On-demand playbook discovery (Sprint 29 M6) is open on paper but
  unused in practice.** The block is in the prompt; the agent ignores
  it for inline-document review tasks. Sprint 31 candidate: stronger
  prompt scaffolding ("if a playbook with a matching topic exists,
  read it before forming your analysis") or move popular playbooks
  to always-on layer 1.
- **Bundled `commercial-legal` skills (Sprint 20 M5) are enumerated
  but never invoked.** Same shape of failure. Sprint 31 candidate:
  measure whether skill-by-name invocation works at all on
  MiniMax-M2.5; consider folding the bundled-skill content into the
  recipe instructions directly (Layer 1 style) for the top 3–5 skills.
- **Redline (Adeu) deploy gap on zip build.** Postinst creates the
  venv; zip build does not. Sprint 31 candidate: extend
  `prepare-oscar-bundle.js` to create the venv during zip
  build for parity with the .deb, OR document that dogfood on zip
  binaries requires a one-shot manual `python3 -m venv` step.
- **Matter-folder watcher (deferred from Sprint 30 brief).** The
  agent re-listed the directory when asked vaguely — the friction
  isn't catastrophic. Sprint 31 candidate: confirmed-low-priority on
  the watcher; the natural-prompt re-listing path works.
- **`developer` platform extension is enabled** in this session
  despite Sprint 18 ADR-063 default-off doctrine for in-house
  lawyers. The recipe lists `developer` with `write/edit/shell/tree/load`
  tools. The agent didn't invoke any developer tools — but the
  exposure is a doctrine violation worth investigating in Sprint 31.

## Run conditions

| Field | Value |
|---|---|
| Date | 2026-05-25 |
| Binary | `/srv/projects/goose/ui/desktop/out/Oscar-GC-linux-x64/oscar-gc` (Sprint 29 M8 zip build, sha unknown) |
| Provider | MiniMax-M2.5 (default temperature; per RUNBOOK) |
| Persona | Helena Marwick, General Counsel, Stanford Industrial Supply Co. |
| Matter | "Pemberton RFQ — 3yr supply" (Commercial area, slug `pemberton-rfq`) |
| Session ID | `20260525_12` (5 turns + late-drop) |
| Validation session | `20260525_13` ("Redline validation" matter, 2 turns) |
| MiniMax spend | $0.4550 (main) + $0.0503 (validation) = **$0.5053** |
| Harness | `scripts/dogfood/dogfood.sh` + `ui/desktop/scripts/dogfood-driver.mjs` (this sprint added `boot` and `eval` subcommands; scaffolding, not product code) |
| Xvfb display | `:99`, 1920×1080×24 |
| AGENT_TIMEOUT_MS | 900000 (15 min, vs. default 240000) |
| Playbook scope | Commercial area-only (per plan §1) — `~/.config/oscar/playbooks/commercial/rfq-review-playbook.md` |
| Playbook always-on | OFF (verified via `area_overrides.playbooks` absent) |
| Extensions in recipe | 12 (oscar-fs, computercontroller, analyze, apps, developer, skills, tom, Extension Manager, todo, summon, redline, tavily) |
| Extensions bound at runtime | 10 (redline + tavily failed to spawn — venv missing for redline, API key missing for Tavily) |

## Fixtures

The fictional RFQ pack and the generic playbook are committed under `fixtures/`:

- **`source/`** — markdown sources (human-readable, diffable).
- **`staged/`** — built DOCX + PDF (what was actually dropped into the matter folder).
- **`build.sh`** — pandoc + weasyprint conversion script.
- **`rfq-review-playbook.md`** — the generic playbook uploaded to `~/.config/oscar/playbooks/commercial/`.

| # | File | Format | Purpose |
|---|---|---|---|
| 1 | 01-rfq-invitation-letter | PDF | Buyer's cover letter, deadlines, scoring weights |
| 2 | 02-master-supply-agreement | DOCX | Load-bearing draft MSA with seeded asymmetries |
| 3 | 03-pricing-schedule | DOCX | Tiered pricing + rebate ladder + MFC clause |
| 4 | 04-service-level-agreement | PDF | OTIF targets, penalties, escalation matrix |
| 5 | 05-general-terms-conditions | PDF | Battle of forms — overrides MSA per clause 20.1 |
| 6 | 06-compliance-annex | PDF | Modern Slavery, anti-bribery, ESG, DPA-by-reference |
| 7 | 07-rfp-questionnaire | DOCX | Bidder questionnaire (largely unused by agent) |
| 8 | 08-supplementary-tcs | PDF | **Late-drop fixture** — dropped between Turn 3 and Turn 4 |

PDF fixtures were built via weasyprint and produce text that
pdftotext (used by `computercontroller__pdf_tool`) extracts as
hex-escaped junk in some sections. The agent still navigated the
asymmetries correctly using the DOCX MSA + matter.md + filenames as
its primary information source. Fixture extractability is a Sprint 31
nice-to-have, not a wiring finding.

## Findings table (per brief)

| # | Observation | Result | Evidence |
|---|---|---|---|
| 1 | Agent listed matter directory unprompted | ✅ Yes | `tool-timeline.md` row 0 (`oscar-fs__list_directory`) at 20:06:49, immediately after Turn 1 |
| 2 | Agent read the on-demand playbook via tool call | ❌ No | No `oscar-fs__read_file` against `~/.config/oscar/playbooks/...` across all 18 tool calls |
| 3 | Agent referenced the playbook in its reasoning/text | ❌ No | "playbook" string absent from all assistant text (verified via grep) |
| 4 | Agent invoked a named `commercial-legal` skill | ❌ No | No `load_skill` call; no skill-slug ("nda-review", "vendor-agreement-review", "escalation-flagger" etc.) in text |
| 5 | Agent spawned subagents via `delegate` | ❌ No | `delegate` tool was present in the extension list; never invoked |
| 6 | Agent found the late-drop file unprompted | ✅ Yes | Turn 4 (msg 20279→20283): immediate `oscar-fs__list_directory` + `pdf_tool` on `08-supplementary-tcs.pdf` |
| 7 | Agent reached for `redline__process_document_batch` | ✅ Yes (intent) | Tool-timeline row 11: agent constructed a 7-change batch with proper schema |
| 7a | Redline tool actually executed | ❌ No (deploy gap) | Tool returned error `-32002: Tool 'redline__process_document_batch' not found` because adeu venv missing in zip build |
| 7b | Redline path validated on follow-up isolated matter | ✅ Yes | After manual `python3 -m venv` + `pip install adeu==1.6.9` in bundle path, session `20260525_13` invoked `redline__process_document_batch` successfully, producing `outputs/02-master-supply-agreement_redlined.docx` (18.5 KB, 6 edits applied, 0 skipped) |

## Tool-call summary

18 tool calls across the main session; full timeline in `tool-timeline.md`.

| Turn | User message (abridged) | Agent tool calls |
|---|---|---|
| 1 | "Review them and give me your read" | list_directory → 4 PDF reads (1, 4, 5, 6) → 2 DOCX reads (2, 3) → `matter.md` head → text reply |
| 2 | "Exposure if their GTCs override the MSA on indemnities?" | (no tools; text-only reply) |
| 3 | "Top-3 redline targets" | (no tools; text-only reply) |
| (drop) | `cp 08-supplementary-tcs.pdf …` | — |
| 4 | "Anything to add given what they sent after the first batch?" | list_directory (re-list) → `pdf_tool` on `08-supplementary-tcs.pdf` → text reply |
| 5 | "Mark up the MSA with our redline" | todo_write → **`redline__process_document_batch` (FAIL — tool not found)** → 3× `computercontroller__docx_tool` (schema errors) → `oscar-fs__write_file` (memo MD) → `computercontroller__docx_tool` (memo DOCX) → todo_write |

## Wiring surfaces — what the agent actually saw

The recipe `instructions` block (11,941 chars) contains, in order:
1. The on-demand playbooks enumeration (Sprint 29 M6) — names the
   RFQ playbook explicitly with filename + scope + size + first-line.
2. The skills-available-in-this-area block (Sprint 20 M5) — 10
   commercial-legal skill slugs.
3. The Commercial bespoke system prompt — including the full
   `redline__*` tool surface description.

Confirmed by inspecting `sessions.recipe_json` for session
`20260525_12`. The wiring is open. The agent chose not to use it.

## What we deliberately didn't measure

- **Legal-substance accuracy.** Different sprint. The agent's
  analysis is competent and identifies the main asymmetries; we don't
  grade it.
- **MiniMax temperature / non-determinism.** Used Sprint 21+ defaults
  per plan.
- **The Tavily affordance.** Tavily was in the recipe but not bound
  (no API key piped through). The agent never reached for web search
  on this matter, which is fine — RFQ review doesn't need external
  regulatory currency.

## Files in this report

- `README.md` — this file
- `transcript.json` — raw message stream (61 messages)
- `tool-timeline.md` — chronological tool calls (18 entries)
- `screenshots/test1-rfq/` — turn-by-turn screenshots
- `outputs/` — agent's memo + the redline-validation matter's redlined DOCX
- `fixtures/` — RFQ pack source + staged + build script + playbook source
- `redline-validation/` — secondary session transcript + tool-timeline confirming the redline path works once the venv is in place
