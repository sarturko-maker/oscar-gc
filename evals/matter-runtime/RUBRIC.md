# Matter-runtime rubric — observable-only tool-call scoring

Per [[ADR-109]]. The judge reads each cycle's `tool-timeline.md` +
`scenario.json` (the scenario metadata, NOT the doctrine the agent
ran with) and emits one `judge-verdict.json` per cycle.

## Scoring principle

**Score what the agent did, not whether it followed a doctrine.** The
judge does not have access to the doctrine text the agent ran with —
that mask is what keeps verdicts honest against the judge's own
priors (since the same Claude Code session that authored doctrine
also runs judging).

The rubric scores tool-call **appropriateness against per-scenario
expectations**. Each scenario JSON declares:

- Which affordances **should** fire (relevant_uptake denominator).
- Which affordances **should NOT** fire (noise_uptake denominator).
- The canonical skill slugs / playbook filenames available in scope.

## Per-cycle verdict JSON

```json
{
  "cycle_id": "<variant>-<model>-<scenario>-cycle-<NN>",
  "session_id": "<goosed session id>",

  "playbook_read_on_relevant_turn":   { "fired": bool, "which": "<filename>|null" },
  "playbook_read_on_irrelevant_turn": { "fired": bool, "which": "<filename>|null" },

  "skill_invoked_when_applicable":     { "fired": bool, "which": "<slug>|null" },
  "skill_invoked_when_not_applicable": { "fired": bool, "which": "<slug>|null" },
  "skill_arg_correct":                 { "fired": bool, "passed_arg": "<string>|null", "canonical_slug": "<expected-slug>|null" },

  "delegate_used_when_applicable":     { "fired": bool, "count": int, "scope_per": "<one-line description>" },
  "delegate_used_when_not_applicable": { "fired": bool, "count": int },
  "delegate_strategy":                 "one_per_item|partition|none",

  "redline_invoked_when_asked":        bool,
  "redline_succeeded_when_invoked":    "bool|null",

  "extra_observations": "<≤300 chars; flag any pattern the structured fields miss>"
}
```

### Field definitions

**`playbook_read_on_relevant_turn`** — `oscar-fs__read_file` invoked
against a playbook filename whose noun matches the scenario's task
noun, on or before the turn where the analysis would use it. `which`
captures the playbook filename actually read; `null` if not fired.

**`playbook_read_on_irrelevant_turn`** — same shape, but for a
playbook whose noun does NOT match the task noun. **Noise signal.**

**`skill_invoked_when_applicable`** — `load_skill` invoked with any
argument, when the scenario expects a named skill to apply.

**`skill_invoked_when_not_applicable`** — `load_skill` invoked when
the scenario expects no skill should fire. **Noise signal.**

**`skill_arg_correct`** — distinguishes "invoked" from "invoked
correctly". `fired: true` only if `passed_arg` matches the canonical
slug in the scenario. GPT-5.4-mini's Sprint 31A
`load_skill(name="commercial/rfq-review-playbook.md")` would score
`fired: false, passed_arg: "commercial/rfq-review-playbook.md"`.
Sprint 31B's `load_skill(name="nda-review")` scores `fired: true`.

**`delegate_used_when_applicable`** — `delegate` (via `summon`
extension) invoked one or more times, when the scenario names a
batch of independent items. `count` is the number of `delegate`
calls; `scope_per` is a one-line description of what each subagent
was asked to do.

**`delegate_used_when_not_applicable`** — same, but on a scenario
where items must be read together (RFQ pack) or where the ask is a
single item. **Noise signal.**

**`delegate_strategy`** — enum capturing how the agent partitioned
work. `one_per_item` (Sprint 31A Claude: 7 subagents for 10 NDAs +
3 in-context); `partition` (Sprint 31B Claude: 4 subagents for 10
NDAs partitioned); `none` (no `delegate` calls).

**`redline_invoked_when_asked`** — `redline__process_document_batch`
invoked when the scenario's prompt schedule explicitly asks for a
redline (Sprint 30 RFQ Turn 5).

**`redline_succeeded_when_invoked`** — `true` if the batch tool
returned success; `false` if content-match rejected (Sprint 31A/B
MiniMax's failure mode); `null` if not invoked.

**`extra_observations`** — free-text. Cap at 300 chars. Use to flag
patterns the structured fields miss (e.g., "agent loaded the skill
but then ignored its output"; "agent invoked `delegate` but with
overlapping scopes").

## Per-cell aggregation (Phase C)

For each (variant, model, scenario) cell with N cycles:

```
signal_to_noise[affordance] =
  count(fired_when_applicable_TRUE) /
  (count(fired_when_applicable_TRUE) + count(fired_when_not_applicable_TRUE))
```

Plus per-fix verdict (ADR-108 fix 1 = `skill_arg_correct.fired` rate;
fix 2 = `delegate_used_when_applicable.fired` rate; fix 3 =
`redline_invoked_when_asked` rate on `30-rfq` Turn 5).

## What this rubric explicitly does NOT score

- Legal substance (is the RFQ analysis correct? does the redline
  preserve qualifiers?) — different problem; different judge.
- Doctrine adherence (did the agent recite the discovery protocol?)
  — by design; doctrine is masked.
- Wall-clock or token efficiency (Sprint 31B saw a 62% cost drop on
  GPT after doctrine refinement, but that's not a rubric axis here
  — the cost log captures it for observability).
