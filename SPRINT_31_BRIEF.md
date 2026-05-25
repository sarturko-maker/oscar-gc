# Sprint 31 — Brief

Sprint 30 measured whether MiniMax-M2.5 uses the wired-up discovery
surfaces — on-demand playbook block ([[ADR-099]]), skill enumeration
block ([[ADR-086]]), default-on `summon`/`delegate` ([[ADR-063]]) —
on real Commercial workflows. The measurement was: it doesn't. The
playbook is enumerated by name in the recipe instructions and
ignored. The skill list is in the prompt and never invoked.
`delegate` is in the tool list and never called. Full findings in
[[ADR-101]]; per-test reports at `docs/sprint-30/`.

Sprint 31 is the first act on those findings. **Doctrine work plus a
short list of small fixes plus manual re-dogfood validation.** The
N=20 eval substrate is Sprint 32 (separate brief). Sprint 31 closes
when a manual re-dogfood shows the doctrine took. Don't accumulate
Sprint 32 scope into this sprint.

## What Arturs said (verbatim, 2026-05-25)

> I am concerned about this... over-tuning. Telling the model
> "always read the playbook" creates noise on irrelevant turns.
> How do you handle noise?

> Sprint 31 is this brief and 32 is model-based eval where you are
> the evaluator.

The over-tuning concern is the load-bearing risk. A doctrine that
gets the playbook read on every turn is **worse** than the Sprint 30
baseline, not better. Be sharper about triggers than the Sprint 29 M6
enumeration was. Quote the over-tuning concern back to the user in
the sprint-close summary so the trade-off is on the record.

## The meta-goal (load-bearing)

Move the Sprint 30 findings table from all-❌ on the discovery rows
to at-least-half-✅ on the **relevant** turns — without lifting reads
on **irrelevant** turns. Signal-to-noise is the measurement, not raw
read rate.

Concretely, the success shape per affordance (manual smoke check, not
N=20 yet — that's Sprint 32):

- **On-demand playbook**: Test 2's Turn 1 reads
  `nda-review-playbook.md` (the topic-matching playbook). Test 1's
  RFQ turns do NOT read `nda-review-playbook.md` (the irrelevant
  playbook). Reading `rfq-review-playbook.md` on Test 1 is fine
  either way — it's a topic match — but the negative control is the
  load-bearing measurement.
- **Named skill**: at least one bundled `commercial-legal` skill is
  invoked across the two tests (`load_skill` call, or named
  paraphrase that proves the agent read the enumeration). The
  brief leaves which skill to the agent's judgement — pinning a
  specific skill biases the test.
- **`delegate`**: Test 2's Turn 1 spawns at least one subagent (one
  per NDA is the natural shape; batch-partitioning is partial credit;
  zero is failure). Sprint 31's hypothesis is that doctrine alone can
  unlock this; Sprint 30 showed the wiring isn't the blocker.

If after three doctrine cycles any acceptance row isn't met, that's
the finding — surface it in the close-out and let Sprint 33 pick up.
Don't chase a fourth cycle without conferring with Arturs.

## Cold-start reading order

1. `PROJECT.md` — project goal + Sprint Index (Sprint 30 is most recent on-disk)
2. `CLAUDE.md` — operating rules; especially "Verify before acting", "Communication: plain English", "Code style: default to writing no comments"
3. `SPRINT_LOG.md` — Sprint 30 entry first (findings + cost shape); Sprint 29 second (M6 wiring under test); Sprint 28 third (Tools section); Sprint 18 (default-on doctrine — the rule `developer` violates)
4. `docs/adr/101-sprint30-dogfood-findings.md` — the candidates driving this sprint, in priority order
5. `docs/sprint-30/test-1-rfq/README.md` and `docs/sprint-30/test-2-ndas/README.md` — the baseline against which doctrine is measured. Re-dogfood is a direct delta to these.
6. `RUNBOOK.md` — dogfood harness (the harness gained `boot` and `eval` subcommands in Sprint 30 — those carry over)
7. ADRs 099 (on-demand playbook block — wiring under test), 086 (skill enumeration block — wiring under test), 063 (default-on summon + default-off developer doctrine — both relevant), 020 (5-step redline doctrine — being re-scoped), 085 (three-layer playbook architecture — context for why Layer 2 needs doctrine to be useful), 092 (Tools section — visual right-pane wiring)

After cold-start: `git log --oneline -15` to see what's landed since Sprint 30; `ls ~/.config/oscar/state/` on lq-vps to confirm host state.

## Three pieces, in priority order

### Piece 1 — Doctrine in the matter system prompt (load-bearing)

The Sprint 30 finding: the Commercial system prompt has a rich
section on the redline tools — what they do, when to use them,
parameter shapes, the 5-step doctrine. Redline tools get invoked
confidently. The other three affordances are present in tool schemas
with bare descriptions and never get invoked. The wiring isn't the
gap; the doctrine is.

Write a "when to use this" paragraph for each of the three
affordances. Mirror the redline section's shape: bounded triggers,
explicit conditionals, negative guards. The on-demand playbook block
already includes a first-line hint per playbook — the doctrine can
lean on that ("the first line tells you what each playbook is for;
only read one when that line names your current task"). Same shape
for skills (use the bundled inventory's skill names as triggers) and
for `delegate` (Arturs's framing: "if the task is a batch of
independent items, delegate one subagent per item or per partition").

**Think deeply about this — over-tuned doctrine is the central risk.**
A trigger that's too fuzzy ("if applicable") matches everything; a
trigger that's too sharp ("if and only if the user names the
playbook file") matches nothing. The path: write 2-3 trigger variants
per affordance, smoke-test each manually against Sprint 30's Test 1
and Test 2 fixtures (don't change the fixtures — the comparison only
holds if the test surface is identical), pick the variant where reads
fire on the relevant test AND don't fire on the irrelevant test.

Negative guards alongside positive ones. "Do NOT read playbooks
whose first-line topic doesn't match your current task." Negative
instructions are weaker than positive ones in LLM training but they
mark the boundary and give the smoke check something concrete to
verify.

Cheap discovery before commitment is an option worth trying. Instead
of "read the playbook", say "if you're unsure whether a playbook
applies, read its first heading first — only proceed to the full
read if the heading matches your task." That gives the model a
50-token discovery step before a 2,000-token commit.

### Piece 2 — Small fixes (sweep-up)

Three patches surfaced by Sprint 30 that don't need a sprint of
their own. Each ~1 hour of work. Land each with its own ADR if it
introduces a structural change; bundle if related.

- **`developer` exposure**. Sprint 18 ADR-063 doctrine says
  default-off for in-house lawyers; Sprint 30 found `developer`
  enabled in matter sessions (the agent used `write` in Test 2 Turn
  3). Investigate why the Sprint 18 filter doesn't take effect and
  close the leak. Likely a single-edit fix once root-caused — could
  be the filter (`enabledPlatformExtensions.ts`), could be the
  recipe builder bypassing it, could be `config.yaml` carrying it
  forward. **Find before fixing.**

- **"Always read before you redline" re-scope**. Sprint 9 ADR-020
  doctrine bled into Test 2's triage task — each NDA read twice
  (outline + full) when only triage was asked. Condition the
  doctrine on redline intent: the double-read should fire when the
  ask is "redline this", not when the ask is "review these". This
  is a rewording in the Commercial system prompt, not a structural
  change to ADR-020.

- **Zip-build adeu venv parity**. `prepare-oscar-bundle.js` should
  create the adeu venv at bundle time (mirroring the .deb's
  postinst step), so dogfood on zip binaries works first-time
  without manual remediation. Sprint 30 hit this on Test 1's
  redline turn and had to remediate manually mid-sprint.

### Piece 3 — Manual re-dogfood validation

Replay Sprint 30 Test 1 (Pemberton RFQ) and Test 2 (10 NDAs)
against the patched system prompt. **Same fixtures, same persona,
same matter shapes.** Don't expand the test surface — the goal is
direct comparison to the Sprint 30 baseline.

Cost ~$0.50-$1 per re-dogfood cycle. Plan for 2-3 cycles to land a
doctrine variant that works. If the first cycle's noise rate is
high (reads-on-irrelevant-turns lifted), revert the loose
phrasing, sharpen the trigger, retry.

The Sprint 30 dogfood harness handles this — `scripts/dogfood/dogfood.sh`
with the `boot` and `eval` subcommands added in that sprint. The
fixtures are at `docs/sprint-30/test-{1-rfq,2-ndas}/fixtures/`. The
extraction helper is at `docs/sprint-30/extract-transcript.py`.

## Deliverables

- Patched matter system prompt (the doctrine paragraphs). The
  Commercial-specific prompt lives at
  `ui/desktop/src/components/oscar/commercial/systemPrompt.ts`;
  the generic builder at
  `ui/desktop/src/components/oscar/recipe/buildPracticeAreaRecipe.ts`
  may need an analogous patch if the doctrine should apply to all
  13 practice areas. Decide whether to scope the doctrine to
  Commercial only (faster, narrower test) or to all areas (closer
  to the real shape).
- The three sweep-up fixes — one commit each, or bundled if related.
  Each with an ADR at decision time if structural.
- `docs/sprint-31/redogfood/` mirroring `docs/sprint-30/`'s shape —
  per-test report (lead paragraph, findings table delta vs Sprint 30
  baseline, transcript, tool-timeline, screenshots). The findings
  table should explicitly show Sprint 30 vs Sprint 31 columns
  side-by-side.
- ADR at decision time for the doctrine choice (cite ADR-101 as
  driver). Use the next free ADR number from `docs/adr/`.
- SPRINT_LOG entry + PROJECT.md Sprint Index row.

## Out of scope

- **The N=20 eval substrate.** That's Sprint 32. Manual smoke check
  is enough for Sprint 31's measurement; building infrastructure
  here delays the doctrine work without strengthening it.
- **Expanding the fixture set.** Sprint 30's RFQ + NDAs are the
  baseline; new fixtures change the comparison. Sprint 32 will
  expand the matrix; Sprint 31 stays on the baseline.
- **Layer 3 semantic retrieval.** Sprint 31 might surface "doctrine
  alone doesn't take"; if so, that's input to Sprint 33's scoping,
  not Sprint 31's scope. [[ADR-085]] correctly deferred Layer 3.
- **Multi-chat per matter** (Sprint 29 M7 / [[ADR-100]] deferred).
- **Matter-folder file watcher** (Sprint 30 measured low friction).
- **Editable session labels / session-delete UI** (Sprint 27 + 29
  reserved IPCs).
- **Any next-tranche Crostini feedback from Arturs that arrives
  mid-sprint.** If it does, slot it into Sprint 32 or later — don't
  absorb here. Sprint 31's scope is fixed when this brief approves.

## Open questions to think deeply about (do not pre-resolve)

- **What "reads on irrelevant turns" means precisely.** Test 1's
  RFQ task with the NDA playbook in scope: is reading the NDA
  playbook irrelevant (yes, no NDA work) or merely unhelpful (the
  playbook might have transferable NDA-style commercial guidance)?
  Be sharp about this when defining the manual smoke check — the
  acceptance threshold depends on it. Default position: an NDA
  playbook on an RFQ turn is irrelevant; the agent should not
  read it.

- **Negative-guard phrasing.** "Do NOT read playbooks that don't
  match" is a negative instruction; LLM training treats these as
  weaker than positive ones. Whether to lean on negative guards vs
  sharp positive triggers vs both is an open phrasing question.
  Likely the answer is "both, with positive trigger leading" but
  the smoke check should compare.

- **Per-affordance doctrine vs unified doctrine.** Three separate
  "when to use this" paragraphs (one per affordance) keep them
  bounded and editable. One unified "discovery doctrine" paragraph
  keeps the prompt shorter but couples the three. Trade-off in
  clarity vs prompt-token economy. Three separate is the safer
  default; collapse later if maintenance proves painful.

- **Commercial-only vs all 13 areas.** Sprint 30 measured Commercial
  only. The doctrine could land Commercial-only (mirrors the test
  surface) or in the generic `buildPracticeAreaRecipe` (applies
  everywhere). Generic is closer to the real shape; Commercial-only
  is closer to what Sprint 30 measured. Pick one and document the
  choice.

- **Developer-exposure root cause.** Could be a Sprint 18 filter
  bug, could be the recipe builder bypassing it, could be `config.yaml`
  carrying it forward. The fix size depends on where the leak is.
  Find before fixing; don't paper over.

- **Stop condition.** Three cycles is the planned ceiling. If cycle
  3 still doesn't meet acceptance, that's a structural finding —
  doctrine alone doesn't take, Layer 3 is the right work, raise
  with Arturs before opening cycle 4.
