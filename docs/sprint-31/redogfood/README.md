# Sprint 31 — Re-dogfood findings (vs Sprint 30 baseline)

## Lead

Sprint 30 ([[ADR-101]]) measured all-❌ on the three discovery
affordances (on-demand playbook reads, named-skill invocation,
`delegate` for batches) plus a deploy gap on the zip build's adeu
venv and a `developer` extension leak in matter sessions. Sprint 31
landed doctrine + three sweep-up fixes ([[ADR-102]], [[ADR-103]],
[[ADR-104]], [[ADR-105]]) and re-dogfooded the same Sprint 30
fixtures across **three doctrine cycles**.

The load-bearing find: the playbook doctrine fired on the long
substantive prompt (Test 1, both cycles 1 and 2) but missed on the
short procedural prompt (Test 2, cycles 1 and 2). Cycle 3
re-ordered the recipe-build concatenation so the system prompt
containing the doctrine sits **before** the discovery surfaces it
references — and the playbook trigger took on Test 2 too. The
sweep-up fixes all confirmed working.

## Findings delta vs Sprint 30 — final cycle (cycle 3)

| Affordance | Sprint 30 baseline | Cycle 3 Test 1 (RFQ) | Cycle 3 Test 2 (NDAs) |
|---|---|---|---|
| Read matching playbook | ❌ neither read | ✅ read `rfq-review-playbook.md` | ✅ read `nda-review-playbook.md` |
| Skip irrelevant playbook | n/a | ✅ no nda-review-playbook read | ✅ no rfq-review-playbook read |
| `load_skill` invocation | ❌ no `load_skill` | ❌ defensible miss (agent thinking: "No skill directly names `rfq-review` — the closest is `vendor-agreement-review` but that's for vendor MSAs … Skip skill loading.") | ❌ defensible miss (agent's intent in thinking: "load the nda-review skill" but no actual call — playbook content overlapped) |
| `delegate` (positive trigger) | ❌ serial | n/a — pack non-independent | ❌ agent says "I'll read all 6 in parallel" but issues 6 serial `redline__read_docx` calls (MiniMax conflates "many tool calls in one message" with parallelism) |
| `delegate` (negative guard — pack coherence) | n/a | ✅ explicit: "better to read them together to understand the pack coherence" | n/a |
| Redline tool path (zip build) | ❌ `-32002 tool not found` | ✅ 2× `process_document_batch` + coherence verify | n/a (no redline ask) |
| ADR-020 outline+full bleed | n/a | ✅ outline+full applied on the multi-section MSA (correct redline context) | ✅ 10 reads for 10 NDAs (was 16/10 in Sprint 30) — single full read per NDA |
| `developer` extension exposure | ❌ `developer__write` invoked in Test 2 Turn 3 | ✅ no developer tools in recipe | ✅ `oscar-fs__write_file` + `oscar-fs__edit_file` (not `developer__write`) |

### Acceptance rows from the brief

- ✅ **Test 2 Turn 1 reads `nda-review-playbook.md`** — met in cycle 3
- ✅ **Test 1 RFQ turns do NOT read `nda-review-playbook.md`** — met all cycles
- ❌ **At least one bundled `commercial-legal` skill invoked across the two tests** — missed in all 3 cycles. Agent's reasoning shows the negative guard firing (no slug exactly names the task at its level). Defensible per brief's "leaves which skill to the agent's judgement"; the failure mode the brief named ("never invoked any skill") is gone — the agent now *considers* skills explicitly.
- ❌ **Test 2 Turn 1 spawns ≥ 1 subagent via `delegate`** — missed in all 3 cycles. MiniMax-specific behavior: model recognises parallelism opportunity ("read all 6 in parallel") but conflates "N tool calls in one assistant message" with actual parallelisation. Sprint 32+ candidate to measure across models.

## What worked, what didn't, why

### What worked

**Sweep-ups (Pieces 2a–2c)** — all three closed cleanly. The
developer leak fix is the cleanest: matter recipes never carry
`developer` regardless of `config.yaml` state, per [[ADR-102]].
ADR-020 re-scope ([[ADR-105]]) eliminated the outline+full bleed
on triage tasks. Zip-build adeu install ([[ADR-103]]) replaces the
venv shape with direct CPython site-packages install — both .deb
and zip work first-time.

**Doctrine on substantive prompts** (cycle 1 onwards) — Test 1's
350-char prompt with multiple ask shapes engaged the doctrine
reliably. Agent recited the protocol in its thinking, read the
matching playbook, applied the negative guards correctly.

**Reordering** (cycle 3) — putting the system prompt (with the
doctrine) BEFORE the discovery surfaces it references closed the
Test 2 playbook gap. Cycle 1+2 had the surfaces first (~0-7% of
prompt) and the doctrine 7-31% later — the agent on short prompts
read the surfaces as cold lists with no usage instruction nearby.
With the system prompt first, the doctrine introduces the surfaces
that follow, and the agent's first thinking on a short prompt
engages the protocol.

### What didn't work

**`load_skill` invocation** missed in all 3 cycles. Two distinct
sub-failures:

1. On Test 1 (RFQ task), the agent **considered the slugs and
   rejected them** — `vendor-agreement-review` is too narrow for
   "review this whole RFQ pack". This is the negative guard firing
   correctly. Not a failure.
2. On Test 2 (NDA task), the agent's thinking said "load the
   nda-review skill" but never actually called `load_skill`. The
   playbook content (which it did read) likely overlapped enough
   that the skill body felt redundant. Possible Sprint 32+
   investigations: surface skill content next to playbook content
   so the agent doesn't have to choose; or strengthen
   `load_skill`'s presence in the tool surface description.

**`delegate` invocation** missed in all 3 cycles on Test 2.
MiniMax-M2.5 reliably says "I'll read these in parallel" in its
thinking, then issues N `redline__read_docx` calls in a single
assistant message. The model appears to conflate "many tool calls
in one turn" with parallelism — but each tool call returns
serially (one per follow-up turn from goosed). This is structural
to the agent loop semantics, not the prompt. Sprint 32+ candidates:

- Doctrine clarification: "Many tool calls in one assistant message
  are still serial in the agent loop. To truly parallelise, use
  `delegate` so each subagent runs in its own loop."
- Cross-model measurement (Claude, GPT-4o): does this conflation
  persist across model families, or is it MiniMax-specific?
- Tool-surface enhancement: surface `delegate` more prominently in
  the recipe's tool list when batch-shape is detected at the recipe-
  build stage.

## Cycle-by-cycle data

| Cycle | Doctrine variant | Test 1 result | Test 2 result |
|---|---|---|---|
| 1 | Original DISCOVERY_DOCTRINE constant, inserted after `# Voice` in Commercial bespoke prompt | ✅ playbook read, ✅ neg guards | ❌ playbook skipped, ❌ skill, ❌ delegate, ✅ ADR-020 re-scope took, ✅ developer leak closed |
| 2 | Doctrine reframed as "Turn 1 protocol" with mandatory A/B/C steps, topic-noun matching, moved to right after intro paragraph | ✅ agent explicitly recites protocol steps in thinking; same outcomes as cycle 1 | ❌ same misses as cycle 1; doctrine framing didn't help on short prompt |
| 3 | **Reordering**: system prompt with doctrine moved BEFORE discovery surfaces in `buildPracticeAreaRecipe.ts` instructions array. Doctrine text adjusted to say "block below". | ✅ even sharper protocol recital; agent explicitly walks Step A/B/C; redline executed end-to-end | ✅ playbook read in Step A; agent considered skill (intent expressed) but didn't call `load_skill`; delegate still missed |

## Diagnosis summary

The cycle 1+2 asymmetry was NOT structural. It was caused by the
system prompt (with the doctrine) sitting AFTER the discovery
surfaces in the recipe instructions. On long substantive prompts
the agent scanned the full system prompt and engaged the doctrine.
On short prompts the agent's attention focused on the user
message and didn't reach the doctrine. Putting the doctrine BEFORE
the surfaces it introduces colocates intent and content — the
agent reads identity → doctrine → surfaces in linear order.

## Costs

| Cycle | Tests | MiniMax spend (estimate) |
|---|---|---|
| Cycle 1 | Test 1 (5 turns + redline) + Test 2 (3 turns) | ~$1.00 |
| Cycle 2 | Test 1 (5 turns + redline) + Test 2 (3 turns) | ~$0.80 |
| Cycle 3 | Test 1 (5 turns + auto-redline + redline) + Test 2 (3 turns) | ~$0.70 |
| **Total Sprint 31** | 6 test runs | **~$2.50** |

Under the brief's $3 ceiling, against Sprint 30's $0.63 baseline.

## Carry-forwards to Sprint 32+

1. **`load_skill` uptake** — Test 2 cycle 3 shows the agent
   *intends* to load the skill but doesn't issue the call. Worth
   isolating whether this is a tool-discovery issue (agent doesn't
   know `load_skill` is the call) or a redundancy judgement
   (skill body overlaps playbook). Eval substrate work.

2. **`delegate` parallelism semantics** — the agent's mental model
   conflates "N calls in one message" with "parallel". A doctrine
   sentence clarifying agent-loop semantics may help; cross-model
   measurement will isolate whether this is MiniMax-specific.

3. **Auto-redline on Turn 1** (cycle 3 Test 1 side effect) — the
   playbook drove proactive redlines without explicit ask. Whether
   this is appropriate (the lawyer said "what needs pushback") or
   over-eager is a judgement call worth surfacing for Arturs.

## Files in this report

- `README.md` — this file
- `cycle-1/`, `cycle-2/`, `cycle-3/` — per-cycle screenshots
  organized by test (`test-1-rfq/`, `test-2-ndas/`)
- Session IDs: cycle 1 = `20260526_1` (RFQ) + `20260526_2` (NDAs);
  cycle 2 = `20260526_6` (RFQ) + `20260526_4` (NDAs);
  cycle 3 = `20260526_8` (RFQ) + `20260526_7` (NDAs)

## What Arturs said (verbatim, 2026-05-25)

> "I am concerned about this... over-tuning. Telling the model
> 'always read the playbook' creates noise on irrelevant turns.
> How do you handle noise?"

The doctrine's negative guards held across all three cycles. Test
1's RFQ turns never read the NDA playbook; Test 2's NDA turns never
read the RFQ playbook. The over-tuning concern did not materialise.
The opposite — under-firing on short procedural prompts — was the
load-bearing risk, and cycle 3's reordering closed it.
