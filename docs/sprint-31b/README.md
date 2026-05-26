# Sprint 31B — Re-dogfood with doctrine refinements applied

## Lead

Sprint 31A ([[ADR-107]]) surfaced three model-specific failure modes
across MiniMax-M2.5, openai/gpt-5.4-mini, and anthropic/claude-sonnet-4.6.
Sprint 31B applies three doctrine refinements ([[ADR-108]]) targeting
each, then re-runs the same 3-model × 2-test matrix with the same
fixtures, persona, prompts, and rebuilt binary.

**Two of three fixes took strongly. One did not.**

| Fix | Target | Sprint 31B verdict |
|---|---|---|
| **1. Slug exactness** for `load_skill` | GPT-5.4-mini's path-as-skill-name failure | ✅ took on GPT (canonical `nda-review` on T2; closer on T1). Unintended bonus: Claude T2 now fires `load_skill` correctly (didn't in 31A). |
| **2. Agent-loop semantics** for `delegate` | MiniMax + GPT-5.4-mini conflation | ✅ took on GPT-5.4-mini (0 → 6 `delegate(async=true)` calls on T2). ❌ did **not** take on MiniMax (still serial 10×). |
| **3. Act, don't describe** for redline batches | GPT + Claude planning-in-prose-then-stop on T1 Turn 5 | ❌ did **not** take on GPT or Claude. Both still announce batches in text, neither invokes `redline__process_document_batch`. |

**Headline**: doctrine refinement unlocked the two affordances that
were soft-but-doctrine-shaped (slug typing, multi-agent dispatch).
The one affordance that needs **action over description** at the
end of a 5-turn flow did not move. That's structural — both models
treat "I'll apply Batch 1 covering clauses 1.3, 2.2, ..." as the
delivery, not the precursor to the call.

**Cost win as side-effect**: GPT-5.4-mini Test 2 dropped from
$1.36 (Sprint 31A's 105-tool-call thrash) to $0.52 (Sprint 31B's
clean 28-tool-call flow with 6 delegate). 62% cost reduction.
Clarity reduces thrash.

## Detailed comparison matrix

| Acceptance row | MiniMax 31A | MiniMax 31B | GPT 31A | GPT 31B | Claude 31A | Claude 31B |
|---|---|---|---|---|---|---|
| Read matching playbook | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Skip irrelevant playbook | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `load_skill` on T2 | ✅ `nda-review` | ✅ `nda-review` | ❌ `commercial/rfq-review-playbook.md` | ✅ `nda-review` | ❌ never | ✅ `nda-review` |
| `delegate` on T2 batch | ❌ 10× serial | ❌ 10× serial | ❌ 0 + thrash | ✅ 6× delegate | ✅ 7× delegate | ✅ 4× delegate (partition) |
| Redline batch on T1 T5 | ✅ invoked (content-rejected) | ✅ invoked (content-rejected) | ❌ planned only | ❌ planned only | ❌ planned only | ❌ planned only |
| ADR-020 single-read on T2 | ✅ | ✅ | ✅ mostly | ✅ | ✅ via subagents | ✅ via subagents |
| `developer` regression check | ✅ no leak | ✅ no leak | ✅ no leak | ✅ no leak | ✅ no leak | ✅ no leak |

## Fix-by-fix uptake

### Fix 1 — slug exactness for `load_skill`

**Worked on GPT-5.4-mini T2**: arg went from
`commercial/rfq-review-playbook.md` (Sprint 31A) to `nda-review`
(Sprint 31B) — canonical inventory slug. The skill body loaded and
informed the analysis.

**Partial on GPT-5.4-mini T1**: arg went from
`commercial/rfq-review-playbook.md` to `review` — closer to slug
shape (no path, no extension), but still wrong (no `review` slug
exists in the inventory). The agent took the "did you mean: review?"
error from Sprint 31A's run literally instead of consulting the
canonical inventory list. Suggests Step B's negative guard
("don't guess") needs sharper phrasing, or the inventory needs
to be more visually prominent.

**Bonus on Claude T2**: Claude now invokes `load_skill(name="nda-review")`
— it skipped this affordance entirely in Sprint 31A. The doctrine
restructure (slug-exactness paragraph) appears to have surfaced the
tool's existence to Claude's selection layer. Single-cycle finding
worth N=20 validation in Sprint 32.

### Fix 2 — agent-loop semantics for `delegate`

**Massive win on GPT-5.4-mini T2**: 0 delegate calls (Sprint 31A,
with 19× `oscar-fs__search_files` + 28× `read_file` + 11× `read_text_file`
thrash) → **6 `delegate(async=true)` calls** on Sprint 31B, each
with a structured triage rubric per NDA. Cost dropped from $1.36
to $0.52. Tool calls dropped from 105 to 28.

**No movement on MiniMax T2**: 10× serial `redline__read_docx`
calls in Sprint 31B, identical to Sprint 31A. The agent reads the
playbook + invokes `load_skill` cleanly, then defaults to serial
direct reads despite the new doctrine paragraph naming the agent-
loop semantics explicitly. This is **model-capability** territory
— MiniMax's tool-selection prior strongly prefers direct read tools
over `delegate` even when told that one is parallel and the other
is not. Doctrine reframing has limits; Sprint 33 candidate is
either tool-side description sharpening or accepting MiniMax's
serial-on-batch behaviour as a known limitation.

**Claude T2 still fires delegate**: 4 calls in Sprint 31B vs 7 in
Sprint 31A. Different partition strategy (10 NDAs into 4 batches of
~2-3 vs Sprint 31A's 1-per-NDA). The doctrine says "one per item
**or** per 3-5-item partition" — both are valid; partition is more
efficient. Cost on the main session dropped from $1.33 to $0.57
(57% reduction).

### Fix 3 — "act, don't describe" for redline batches

**No movement on GPT-5.4-mini T1**: agent still writes
"Planned edits: 1. Clause 1.3 / 20.1: flip precedence ... Running
both batches simultaneously since no edit depends on another" and
stops. The next assistant message has no `redline__process_document_batch`
call. Same failure mode as Sprint 31A.

**No movement on Claude T1**: same pattern. Claude announces
"Batch 1 covers cls. 1.3, 2.2, 4.3, 5.2 ... — all independent.
Batch 2 covers ... Running both now simultaneously" — then no
tool call.

**MiniMax executes (as in 31A)**: 1× batch invocation, rejected on
"target_text not found" for one of the 8 edits in the batch
(content-precision failure, same as Sprint 31A's 2-batch attempt).
Tool path works; exact-text matching is brittle. The "act don't
describe" doctrine is irrelevant for MiniMax because MiniMax already
acts.

**Why fix 3 missed (load-bearing diagnosis)**: the doctrine
paragraph was added but lives in the middle of a 90-line system
prompt. By Turn 5, after the agent has read 7-8 documents and run
through 4 substantive analytical turns, the prompt's relative
weight in the agent's attention is low. Sharper phrasing — or
placement in the bespoke Commercial redline doctrine specifically
(which already gets cited explicitly on redline turns) — is the
likely Sprint 33 next step. Doctrine alone isn't reaching this
specific failure mode.

## Cost summary

| Cycle | Provider | Session | Tokens | Cost |
|---|---|---:|---:|---:|
| MiniMax T1 | minimax | 20260526_22 | 110930 | $0.3157 |
| MiniMax T2 | minimax | 20260526_23 | 32291 | $0.1131 |
| GPT T1 | openrouter | 20260526_24 | 107014 | $0.5399 |
| GPT T2 | openrouter | 20260526_25 | 34013 | $0.5206 |
| Claude T1 | openrouter | 20260526_26 | 81219 | $1.9666 |
| Claude T2 main | openrouter | 20260526_27 | 33856 | $0.5723 |
| Claude T2 subagents (×4) | openrouter | 20260526_28-31 | 29105 | $0.1667 |
| **Sprint 31B total** | | | 428428 | **$4.1949** |

By dev key:
- `/root/.minimax-dev-key`: $0.4288 (cumulative this month: ~$0.74 — 7% of $10/PCM)
- `/root/.openrouter-dev-key`: $3.7661 (cumulative Sprint 31A + 31B: $8.79 — 88% of $10 hard cap, ~$1.21 remaining)
- Anthropic: $0

**Cost vs Sprint 31A delta**:
- MiniMax: +$0.12 (slightly longer prompts due to doctrine additions)
- GPT-5.4-mini: -$0.74 (the win — doctrine cut the thrash)
- Claude: -$0.84 (the other win — doctrine helped Claude find load_skill, kept delegate, reduced exploration overhead)
- **Net Sprint 31B was $1.14 cheaper than Sprint 31A despite identical fixtures and turns**.

## What this teaches about doctrine engineering

Three of three fixes were structurally similar (positive doctrine
sentences naming the right shape). Two of three took strongly. The
one that didn't (fix 3, "act don't describe") shares a property the
other two don't: **its target failure mode happens at the end of a
long multi-turn flow**, not on Turn 1. Slug-exactness fires on the
first `load_skill` decision; agent-loop semantics fires on the
batch-detection decision. Both are early. "Act don't describe"
fires when the agent has already produced a long planning paragraph
and is about to either issue the call or stop — late, attention-
exhausted territory.

The implication for Sprint 33+: late-flow doctrine needs to live
**at the trigger surface** (the redline tool's description or the
bespoke Commercial redline doctrine that already fires on Turn 5),
not in the general discovery doctrine. Sprint 31B's fix 3 was in
the wrong place; sharper placement is the Sprint 33 candidate.

## Carry-forwards (refined from Sprint 31A)

1. **Sprint 32 substrate validates Sprint 31B's wins at N=20** —
   does `load_skill(name="nda-review")` fire on GPT-5.4-mini in
   18/20 runs, or was 1/1 lucky? Same question for delegate, same
   question for Claude's new load_skill behaviour.

2. **Sprint 33 candidates (refined)**:
   - **Redline doctrine placement**: move the "act don't describe"
     language into the bespoke Commercial redline doctrine (which
     fires on Turn 5 explicitly) or into the
     `redline__process_document_batch` tool description.
   - **MiniMax delegate**: model-capability bound on doctrine — try
     tool-side adjustment (e.g., a `summon` extension tool-list
     reorganisation) or accept as a known limitation. Sprint 32
     N=20 should quantify how often MiniMax does invoke delegate.
   - **GPT skill-arg "did you mean" follow-the-hint trap**: when
     `load_skill` returns "did you mean: review?", the agent
     literally tries `review`. Sprint 33: tweak the error to suggest
     the closest *real* slug (`Did you mean nda-review?`) or
     suppress the suggestion when there's no close match.

3. **Cost ceiling discipline**: OpenRouter spent $8.79 / $10 in 2
   sprints. Sprint 32's N=20 substrate at ~$5-7 per variant must
   wait for OpenRouter key refresh or use a cheaper Claude variant
   (Haiku 4.5).

## Out of scope (held from Sprint 31A)

- Tool-side error message changes (`load_skill` "did you mean")
- Tool-side description changes (`redline__process_document_batch`,
  `delegate`)
- Per-model doctrine variants
- N=20 statistical validation (Sprint 32)

## What did *not* change

- Negative guards still hold across all 3 models on both tests —
  no irrelevant playbook reads. Sprint 31B's three positive
  shapes did not provoke noise on irrelevant turns. Over-tuning
  risk continues to not materialise.
- ADR-020 single-read-per-NDA still holds on Test 2 across all
  three models.
- `developer` extension exposure stays closed.

## Test conditions

| Field | Value |
|---|---|
| Date | 2026-05-26 |
| Binary | `ui/desktop/out/Oscar-GC-linux-x64/oscar-gc` (Sprint 31B build, commit `d88ef8df6`) |
| Persona | Helena Marwick, GC, Stanford Industrial Supply Co. |
| Matters | `pemberton-rfq` (Test 1), `nda-triage-week-21` (Test 2) |
| Harness | `scripts/dogfood/dogfood.sh` + `ui/desktop/scripts/dogfood-driver.mjs` |
| Xvfb | `:99`, 1920×1080×24 |
| AGENT_TIMEOUT_MS | 900000 |
| Provider switch | env-override per [[ADR-106]] |
| Cycles per model | 1 (smoke check; Sprint 32 N=20 is the rigorous escalation) |

## Files

- `README.md` — this file
- `extract-transcript.py` — copied from Sprint 30 for stability
- `{minimax, gpt-5.4-mini, claude-sonnet-4.6}/test-{1-rfq, 2-ndas}/{transcript.json, tool-timeline.md, screenshots/}`
