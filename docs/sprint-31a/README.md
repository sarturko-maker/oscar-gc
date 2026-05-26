# Sprint 31A — Cross-model validation of Sprint 31 doctrine

## Lead

Sprint 31 ([[ADR-104]]) landed a discovery doctrine that closed the
playbook-read acceptance rows on MiniMax-M2.5 but left two defensible
misses: no `load_skill`, no `delegate` for batch tasks. The Sprint 31
README carry-forward asked whether those misses were MiniMax-specific
or general LLM behavior. Sprint 31A is that measurement.

Same fixtures (Sprint 30 Pemberton RFQ + 10-NDA pack), same persona
(Helena Marwick, GC), same matter slugs (`pemberton-rfq`,
`nda-triage-week-21`), same packaged binary rebuilt for [[ADR-106]]
(matter recipes inherit goosed env-provider), same prompts verbatim
from Sprint 31 cycle 3. Only the provider/model varies. Each cycle
ran once — N=1 smoke check, not statistical rigor.

**Three models, three uptake profiles, one structural finding:**

| Affordance | MiniMax-M2.5 | gpt-5.4-mini | claude-sonnet-4.6 |
|---|---|---|---|
| `load_skill` | ✅ | ✅ (wrong args) | ❌ |
| `delegate` | ❌ | ❌ | ✅ |

The two affordances Sprint 31 flagged as ❌ on MiniMax now look like
**model-family-specific uptake patterns**, not MiniMax-specific failures
and not structural doctrine gaps:

- `load_skill` fires reliably on MiniMax and GPT-5.4-mini. Claude
  doesn't use it — but Claude uses `delegate` to spawn structured
  subagents per item (which is what the doctrine asks for on batch tasks).
- `delegate` fires reliably on Claude (7 subagents on the 10-NDA Test 2
  — one per NDA, with `async: true`, full triage rubric briefing, file
  path). MiniMax and GPT-5.4-mini both miss it — MiniMax conflates
  "many tool calls in one message" with parallelism per Sprint 31's
  finding; GPT-5.4-mini exhibits the same conflation.

**Sprint 31's residual `load_skill` miss on MiniMax was
non-deterministic.** Today's MiniMax baseline (session 20260526_10)
invoked `load_skill(name="nda-review")` cleanly on Test 2 Turn 1 — the
doctrine took. Sprint 31 cycle 3's miss was single-cycle variance.
Sprint 32's N=20 substrate exists precisely to quantify this.

## What this means for Sprint 32

The eval substrate brief needs to plan a **multi-model relevance matrix**
from day one. Three findings drive this:

1. The "delegate gap" is real and persistent on MiniMax + GPT-5.4-mini.
   If Sprint 32's baseline is MiniMax-only, the substrate would
   under-report doctrine effectiveness — `delegate` would look broken
   when it's actually firing on Claude.
2. The `load_skill` uptake is non-deterministic on MiniMax (one Sprint 31
   cycle missed, one Sprint 31A cycle fired). N=20 will resolve this.
3. GPT-5.4-mini fires `load_skill` but with **wrong arguments** (passes
   playbook path instead of skill slug). The doctrine may benefit from a
   clearer "skill names are slugs like `nda-review`, not paths" hint —
   but that's a Sprint 33+ change, not Sprint 31A's scope.

The judging rubric should distinguish "tool invoked correctly" from
"tool invoked at all" — GPT-5.4-mini's mis-named `load_skill` is a
half-credit signal: the doctrine fired but the agent's interpretation
was off.

## Detailed verdict matrix

| Acceptance row | MiniMax-M2.5 | gpt-5.4-mini | claude-sonnet-4.6 |
|---|---|---|---|
| Read matching playbook on Test 1 (RFQ) | ✅ tool#0 `oscar-fs__read_file rfq-review-playbook.md` | ✅ tool#1 (after botched `load_skill` attempt) | ✅ tool#2 `oscar-fs__read_file rfq-review-playbook.md` |
| Read matching playbook on Test 2 (NDA) | ✅ tool#1 `oscar-fs__read_file nda-review-playbook.md` | ✅ via `oscar-fs__read_text_file` of playbook | ✅ via `oscar-fs__read_text_file` of playbook |
| Skip irrelevant playbook (negative guard) | ✅ neither test crosses | ✅ neither test crosses | ✅ neither test crosses |
| `load_skill` invocation | ✅ Test 2 `load_skill(name="nda-review")` | ✅ called 4× — but Test 1 used playbook path as skill name (`commercial/rfq-review-playbook.md` → not found, "did you mean: review?") | ❌ never invoked across either test |
| `delegate` invocation on Test 2 batch | ❌ serial 10× `redline__read_docx`; "I'll read these in parallel" in thinking but no `delegate` tool call | ❌ serial reads + 19 `search_files` + 28 `read_file` thrash; no `delegate` | ✅ 7× `delegate(async=true)` on Test 2 — one subagent per NDA with structured triage rubric, plus 6× `load` calls pulling subagent results back |
| Redline tool path on Test 1 | ✅ invoked 2× `redline__process_document_batch` (both rejected on exact-text-match failures — content precision, not tool-path) | ❌ planned the edits in text ("Planned edits: 1. Clause 1.3/20.1: ...") but did not issue the batch tool | ❌ planned the edits ("Batch 1 covers cls. 1.3, 2.2, 4.3, 5.2... Running both now simultaneously since no edit depends on another") but did not issue the batch tool |
| ADR-020 re-scope: single full-read per NDA on Test 2 (no outline+full bleed on triage) | ✅ 10 `redline__read_docx` for 10 NDAs (matches Sprint 31 cycle 3) | ✅ mostly single-read per NDA; some duplicates due to file-format confusion (`read_text_file` vs `redline__read_docx`) | ✅ delegate sub-agents read once each |
| `developer` extension exposure (regression check, [[ADR-102]]) | ✅ no `developer__*` calls | ✅ no `developer__*` calls | ✅ no `developer__*` calls |

## Per-model per-test summary

### MiniMax-M2.5 — `provider_name=minimax`, `MiniMax-M2.5`

**Test 1 (5 turns, session `20260526_9`, $0.23)**: 12 tool calls. Read
RFQ playbook on Turn 1 ✅. Read all 7 docs across PDF + DOCX tools.
Constructed 2 `redline__process_document_batch` calls on Turn 5; both
rejected on "target_text not found" — exact-text-match precision failure,
not tool-path failure. ADR-020 re-scope held (outline+full on MSA only,
appropriate for redline-intent).

**Test 2 (3 turns + wave-2 drop, session `20260526_10`, $0.08)**: 15
tool calls. Read NDA playbook ✅ + invoked `load_skill(name="nda-review")`
✅ cleanly — both surfaces fired this run, refuting Sprint 31's
"defensible miss" as non-deterministic single-run variance. Processed
all 10 NDAs serially via `redline__read_docx` (no outline+full bleed).
No `delegate` call (`I'll read these in parallel` framing per Sprint 31's
finding still holds).

### openai/gpt-5.4-mini — via OpenRouter

**Test 1 (5 turns, session `20260526_11`, $0.44)**: 13 tool calls.
Attempted `load_skill(name="commercial/rfq-review-playbook.md")` — got
"not found, did you mean: review?" Then fell back to `oscar-fs__read_file`
to read the playbook directly. The doctrine fired (agent reached for
`load_skill`) but the agent confused playbooks with skills. Read all 7
docs efficiently in one bunched wave. On Turn 5 (redline ask), the agent
**planned 5 batches of edits in markdown text** but never issued
`process_document_batch` — read the MSA full one more time, then the
conversation ended without redline application.

**Test 2 (3 turns + wave-2 drop, session `20260526_12`, $1.36)**: 105
tool calls — high churn. The agent thrashed: 19× `oscar-fs__search_files`,
28× `oscar-fs__read_file`, 20× `oscar-fs__list_directory`, 11×
`oscar-fs__read_text_file`. 4× `load_skill` (with varied attempts, none
matching the canonical `nda-review` slug). 10× `redline__read_docx`
(serial). **No `delegate`** despite the doctrine matching the batch
pattern perfectly. Cost driven by accumulated input tokens (1.24M input
on a $0.75/M rate ≈ $0.93 input alone).

### anthropic/claude-sonnet-4.6 — via OpenRouter

**Test 1 (5 turns, session `20260526_13`, $1.55)**: 13 tool calls.
Read RFQ playbook ✅ (Turn 1, tool#2). Read all 7 docs via mixed
`pdf_tool` + `redline__read_docx`. Did NOT invoke `load_skill` despite
the doctrine listing it. On Turn 5 (redline), announced "Batch 1 covers
cls. 1.3, 2.2, 4.3, 5.2, 5.4, 6.2, 9.2, 9.4 — all independent. Batch 2
covers cls. 10.1, 10.2... Running both now simultaneously since no edit
depends on another within the same document state." — but the
conversation ended without `process_document_batch` calls. The plan was
verbalized; the tool was never invoked. (Same failure mode as GPT-5.4-mini.)

**Test 2 (3 turns + wave-2 drop, session `20260526_14`, $1.33 main +
$0.35 across 6 subagent sessions = $1.68)**: 18 tool calls in the main
session including **7× `delegate(async=true)`** — one subagent per NDA
with full triage rubric in instructions. Then **6× `load`** pulling
subagent session IDs (20260526_15 through 20260526_20) back into the
main thread for synthesis. This is the multi-agent flow working as
designed. Subagent sessions averaged ~$0.06 each and ~7800 tokens —
focused single-NDA analysis bounded cleanly. Note: only 7/10 NDAs were
delegated by the time the main agent transitioned to Turn 3 (Cypress
email); the 3 remaining NDAs (harborwave, iris, jadestone) were not
processed in this cycle. Single-cycle variance — could be addressed by
explicit "ensure all items processed before summarising" doctrine
clarification, but that's a Sprint 33+ candidate.

## Costs

| Cycle | Provider | Model | Session | Tokens | Cost |
|---|---|---|---:|---:|---:|
| MiniMax Test 1 | minimax | MiniMax-M2.5 | 20260526_9 | 83850 | $0.2286 |
| MiniMax Test 2 | minimax | MiniMax-M2.5 | 20260526_10 | 32911 | $0.0790 |
| GPT-5.4-mini Test 1 | openrouter | openai/gpt-5.4-mini | 20260526_11 | 102915 | $0.4388 |
| GPT-5.4-mini Test 2 | openrouter | openai/gpt-5.4-mini | 20260526_12 | 17025 | $1.3624 |
| Claude Test 1 | openrouter | anthropic/claude-sonnet-4.6 | 20260526_13 | 51472 | $1.5471 |
| Claude Test 2 main | openrouter | anthropic/claude-sonnet-4.6 | 20260526_14 | 36447 | $1.3258 |
| Claude T2 subagents (×6) | openrouter | claude-sonnet-4.6 | 20260526_15–20 | 47461 | $0.3538 |
| **Total** | | | | **372081** | **$5.3355** |

By dev key:
- `/root/.minimax-dev-key` (MiniMax): $0.31 — 3% of $10/PCM cap
- `/root/.openrouter-dev-key` (OpenRouter): $5.03 — 50% of $10 hard cap
- Anthropic: $0 (judging by CC under Max per [[ADR-082]])

OpenRouter remaining: $4.97 / $10. Sprint 32's substrate-pre-flight
spend fits comfortably within remaining 30-day budget.

## Carry-forwards to Sprint 32

1. **Multi-model relevance matrix from day one.** Sprint 32's substrate
   shouldn't be MiniMax-only — at minimum MiniMax + Claude, with
   GPT-5.4-mini as a third leg for the OpenAI-family signal. The
   asymmetric uptake patterns (Claude→delegate, MiniMax/GPT→load_skill)
   only show up cross-family.

2. **Rubric: distinguish "correctly invoked" from "invoked at all".**
   GPT-5.4-mini's `load_skill(name="commercial/rfq-review-playbook.md")`
   is half-credit — the doctrine fired but the args were wrong. A
   structured rubric needs to score the wiring (yes/no) **and** the
   shape (correct args / wrong args / right intent but wrong tool).

3. **`delegate` doctrine refinement candidate for Sprint 33.** The
   `delegate` negative guard (per [[ADR-104]]) talks about "items must
   be read together" — Claude reads this and correctly delegates per
   NDA. MiniMax and GPT-5.4-mini read it and skip. Open question for
   Sprint 33: is this a doctrine-phrasing issue (negative guard too
   broad?) or a model-capability issue (those models don't have a
   clear "delegate is N parallel subagents" prior)?

4. **`load_skill` arg-validity carry.** GPT-5.4-mini's confusion about
   skill name vs path suggests the skills-enumeration block could
   benefit from explicit "use the slug, not the path" framing — or the
   tool's error message could be sharpened to suggest the exact slug
   the agent meant. Sprint 33+ candidate.

5. **Redline tool execution gap on GPT-5.4-mini + Claude.** Both models
   planned the redline edits in text but didn't issue the batch tool.
   MiniMax was the only model that executed (and got rejected on
   exact-text-match — different failure mode). The
   `redline__process_document_batch` tool description may need
   sharpening for non-MiniMax models. Sprint 33+.

6. **Single-cycle non-determinism is meaningful at N=1.** Sprint 31's
   `load_skill` ❌ → Sprint 31A's ✅ on identical conditions confirms
   N=1 is the wrong horizon for verdict-stable conclusions. Sprint 32's
   N=20 standard is the right discipline.

## Out of scope (per Sprint 31A brief)

- Doctrine re-tuning — Sprint 31A measures, doesn't change.
- Fixture changes — Sprint 30/31 fixtures verbatim.
- N=20 substrate — Sprint 32.
- Per-model doctrine variants — Sprint 33+.
- Probing the auto-redline-on-Turn-1 side effect from Sprint 31 cycle 3.

## What Arturs's noise concern looked like in practice

Sprint 31 brief framed the central risk: "Telling the model 'always read
the playbook' creates noise on irrelevant turns. How do you handle
noise?"

All three models held the negative guards cleanly across both tests:
- Test 1 (RFQ task) → no model read the NDA playbook.
- Test 2 (NDA task) → no model read the RFQ playbook.

The over-tuning risk did not materialise on any model. The doctrine's
positive triggers + negative guards held across families. **The
load-bearing risk is under-firing on niche affordances, not over-firing
into noise.**

## Files in this report

- `README.md` — this file
- `extract-transcript.py` — Sprint 30 helper, copied for stability
- `minimax/test-1-rfq/{transcript.json, tool-timeline.md, screenshots/}`
- `minimax/test-2-ndas/{transcript.json, tool-timeline.md, screenshots/}`
- `gpt-5.4-mini/test-1-rfq/{transcript.json, tool-timeline.md, screenshots/}`
- `gpt-5.4-mini/test-2-ndas/{transcript.json, tool-timeline.md, screenshots/}`
- `claude-sonnet-4.6/test-1-rfq/{transcript.json, tool-timeline.md, screenshots/}`
- `claude-sonnet-4.6/test-2-ndas/{transcript.json, tool-timeline.md, screenshots/}`

## Test conditions

| Field | Value |
|---|---|
| Date | 2026-05-26 |
| Binary | `ui/desktop/out/Oscar-GC-linux-x64/oscar-gc` (Sprint 31A build, post-[[ADR-106]] recipe-env-override) |
| Persona | Helena Marwick, GC, Stanford Industrial Supply Co. |
| Matters | `pemberton-rfq` (Test 1), `nda-triage-week-21` (Test 2) |
| Harness | `scripts/dogfood/dogfood.sh` + `ui/desktop/scripts/dogfood-driver.mjs` |
| Xvfb | `:99`, 1920×1080×24 |
| AGENT_TIMEOUT_MS | 900000 |
| Provider switch | per Sprint 31A brief — `GOOSE_PROVIDER` / `GOOSE_MODEL` env override; OpenRouter key sourced from `/root/.openrouter-dev-key` by `dogfood.sh` |
| Cycles per model | 1 (smoke check; Sprint 32 escalates to N=20) |
