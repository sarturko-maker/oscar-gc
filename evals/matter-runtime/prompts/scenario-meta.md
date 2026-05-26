# Scenario metadata shape

Each scenario at `evals/matter-runtime/scenarios/<slug>.json` declares
what the judge expects per affordance. The shape is consumed by both
`scripts/run-cell.js` (Phase A — drives the matter session per the
prompt schedule) and `prompts/judge-system.md` (Phase B — the judge
reads this for the per-cycle expectations).

```json
{
  "slug": "<scenario-slug>",
  "label": "<one-line human-readable label>",
  "fixture_dir": "<absolute path to fixture corpus, e.g. docs/sprint-30/test-2-ndas/fixtures/>",
  "matter_shape": {
    "practice_area": "commercial",
    "subject_kind": "<one of commercial subject_types>",
    "subject_label": "<descriptive label for matter.md>",
    "counterparty": null | { "role": "<role>", "name": "<name>" },
    "playbooks_present": ["<filename1.md>", "<filename2.md>"],
    "always_on_playbooks": []
  },
  "prompt_schedule": [
    { "turn": 1, "text": "<Turn 1 prompt>" },
    { "turn": 2, "text": "<Turn 2 prompt>" },
    { "turn": 3, "text": "<Turn 3 prompt; null if scenario stops at turn 2>" }
  ],
  "expectations": {
    "playbook": {
      "should_fire": "<filename.md>|null",
      "should_not_fire": ["<filename.md>", "..."],
      "fire_on_turn": 1
    },
    "skill": {
      "should_fire": true|false,
      "canonical_slug": "<expected-slug>|null",
      "not_applicable_slugs": ["<slug>", "..."]
    },
    "delegate": {
      "should_fire": true|false,
      "min_count_when_applicable": 1,
      "rationale": "<one-line: why this scenario does/doesn't trigger delegate>"
    },
    "redline": {
      "should_be_invoked": true|false,
      "invoked_on_turn": 5|null
    }
  },
  "notes": "<free text: provenance, source fixture, known caveats>"
}
```

## Conventions

- `slug` is kebab-case. Used as a directory name under
  `iterations/variant-<X>/<model>/`.
- `fixture_dir` is read by `run-cell.js` to populate the matter's
  working directory before sending Turn 1.
- `prompt_schedule` is sent verbatim by `pair-send`; turns are sent
  one at a time, with a wait between turns for the previous
  assistant message to complete.
- `expectations.*.should_fire` drives the relevant_uptake denominator
  in Phase C aggregation; `*.should_not_fire` (where applicable)
  drives the noise denominator.
- `canonical_slug` is the **exact** string `load_skill(name=…)` must
  pass to score `skill_arg_correct.fired: true`. The slugs are from
  the scope of the matter's practice area (Commercial in Sprint 32).

## Sprint 32 scenarios

- `30-rfq.json` — Sprint 30 Pemberton RFQ pack. RFQ playbook should
  fire; NDA playbook should not; no skill triggers; no delegate;
  redline batch on Turn 5.
- `30-ndas.json` — Sprint 30 10-NDA triage. NDA playbook should
  fire; RFQ playbook should not; `nda-review` skill should fire;
  delegate should fire (10 independent items); no redline.
- `negative-control.json` — generic "draft me a confidentiality
  clause for a Series B term sheet". No playbook should fire; no
  skill should fire; no delegate; no redline. Pure noise
  denominator.
- `playbook-mismatch.json` — RFQ matter, prompt "draft a generic
  NDA template". RFQ playbook present but irrelevant; NDA playbook
  absent. Agent should read NEITHER playbook. Negative-guard
  discrimination test.
