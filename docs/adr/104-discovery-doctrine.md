# ADR-104: Discovery doctrine in matter system prompts

Sprint 31 (2026-05-26). Status: Accepted. Closes Sprint 30 findings ([[ADR-101]] items 1-3) and answers the doctrine candidate ADR-101 §B. Cites [[ADR-020]], [[ADR-063]], [[ADR-086]], [[ADR-099]].

## Context

Sprint 30 ([[ADR-101]]) measured whether MiniMax-M2.5 used the three
discovery surfaces our recipes already wire up:

- On-demand playbook block ([[ADR-099]], Sprint 29 M6) — enumerates
  every non-always-on playbook in the recipe instructions with
  filename, scope, size, and a first-line hint per text-format file.
- Skill enumeration block ([[ADR-086]], Sprint 20 M5) — enumerates
  every in-scope skill slug with the `## Skills available in this
  area` heading and an `Ignore any other skills you may discover.`
  footer.
- `delegate` tool ([[ADR-063]], Sprint 18 default-on `summon`) —
  exposed via the platform extension; no doctrine in the system
  prompt.

The Sprint 30 finding was uniformly negative on all three: agent
ignored both playbooks despite enumeration; agent never invoked any
named `commercial-legal` skill; agent processed 10 NDAs serially with
no `delegate` calls. The wiring isn't the gap — the doctrine is.

The bespoke Commercial prompt has a rich section on the redline tools
("Always read before you redline", a five-step doctrine, explicit
conditionals, negative guards), and redline gets invoked confidently.
The three discovery surfaces ship with bare enumerations and never
get used.

Arturs's brief flagged the central risk: **over-tuning**. A doctrine
that fires on every turn is worse than the Sprint 30 baseline, not
better. Signal-to-noise is the measurement.

## Decision

A `discoveryDoctrine.ts` module exports a `DISCOVERY_DOCTRINE` string
constant. Three paragraphs, one per affordance, mirroring the Commercial
redline-doctrine shape: bounded positive trigger + concrete example
pairs + explicit negative guard + scope cap.

Both system-prompt code paths include the constant via template-string
interpolation:

- `commercial/systemPrompt.ts` — inserts after the `# Voice` section,
  before `# Your tool surface`.
- `recipe/buildPracticeAreaRecipe.ts:defaultSystemPrompt` — inserts
  after the "Top of Mind" paragraph, before the closing
  plain-English-and-cite-facts paragraph. All 12 non-Commercial areas
  reach this path.

### Per-affordance trigger shape

**On-demand playbook** — positive trigger: filename's first-line hint
names the current task ("NDA Review Playbook" when the ask is NDA
triage; "RFQ Review Playbook" when the ask is an incoming RFQ pack).
Cheap discovery: the hint is enough — don't open the file to check.
Negative guard: don't open a playbook whose hint doesn't name the
task ("NDA playbook on an RFQ task adds noise without signal").
Scope cap: at most one playbook per task; first turn is the commit
point.

**Named skill** — positive trigger: slug names the current task at
the level it actually is (`nda-review` for "triage these NDAs";
`vendor-agreement-review` for "review this supplier MSA"). Negative
guard: don't invoke a skill whose slug doesn't name the task — listed
skills are task-scoped procedures, not background reading. Sharpens
"a generic slug like `review` is rarely the right call when a more
specific slug applies."

**`delegate`** — positive trigger: lawyer's ask names a quantity of
independent items ("10 NDAs", "these 5 vendors"). Pattern: one
subagent per item or per 3-5-item partition. Timing: Turn 1, before
serial reads. Negative guard: skip when items must be read together
(MSA + GTC + SLA), single-item asks, follow-ups that already analysed
the items in-context.

## Smoke check against Sprint 30 fixtures

Per the brief's signal-to-noise framing, each affordance is checked
against both tests' starting state. Pass = doctrine fires on the
relevant test AND doesn't fire on the irrelevant one. Test 1's
playbooks dir contains both `rfq-review-playbook.md` and
`nda-review-playbook.md` (matter started with both visible).

| Affordance | Test 1 (RFQ task) — expected | Test 2 (NDA task) — expected |
|---|---|---|
| Playbook | Read rfq-review-playbook (hint matches). Do NOT read nda-review-playbook (hint doesn't name RFQ task). | Read nda-review-playbook (hint matches). Do NOT read rfq-review-playbook. |
| Skill | Invoke `vendor-agreement-review` OR `review-proposals` OR `saas-msa-review` (slug matches task at its actual level). Do NOT invoke `nda-review`. | Invoke `nda-review`. Do NOT invoke other slugs. |
| `delegate` | Skip — the 7-doc RFQ pack is non-independent (MSA + GTC + SLA + ...) and falls under the explicit skip case. | Fire — 10 independent NDAs, named quantity, Turn 1. |

This is the manual smoke shape Sprint 31 Piece 3 will validate. If
cycle 1 fires the doctrine asymmetrically (e.g. reads the wrong
playbook on Test 1), revert the loose phrasing and retry. If three
cycles can't produce the asymmetry, that's the structural finding to
escalate to Sprint 33 ([[ADR-085]] Layer 3 candidate).

## Alternatives rejected

- **Unified discovery doctrine paragraph** (one paragraph covering
  all three). Shorter prompt; couples the three. Three separate
  paragraphs are bounded and individually editable — if one
  over-fires, sharpen that one without touching the others.
- **Auto-promote one matching-named playbook to always-on at
  matter-open time.** Higher-cost discovery — every matter open
  re-scans + re-extracts. Doesn't answer the multi-playbook case
  (which one matches?). Layer 3 work, deferred per [[ADR-085]].
- **Fold top-3 bundled skill bodies into recipe instructions
  (Layer 1).** Cost: ~1.5 KB per skill × 3 = ~4.5 KB added to every
  matter open even when the skills don't apply. Worse signal-to-noise
  than the slug-trigger doctrine — the slug is the cue, not the
  body.
- **Commercial-only scope.** Sprint 30 measured Commercial; Sprint 31
  re-dogfoods Commercial. But the three affordances are wired
  identically across all 13 areas — the doctrine costs nothing extra
  to land everywhere, and 12 future areas get the same uplift at no
  extra dogfood cost.

## Caveats

- Variant choice is committed *before* the smoke check. If the smoke
  check fails, the doctrine is the variable; the fixtures are the
  fixed reference. Up to 3 doctrine cycles per [[ADR-101]] item 4
  before escalating structural.
- Over-tuning risk lives in the negative guards. A negative guard
  too loose ("don't invoke if not relevant") matches everything; too
  sharp ("only invoke when the slug is verbatim in the user's
  message") matches nothing. Sprint 31 cycle 1 is the first measure.

Cites: [[ADR-020]], [[ADR-063]], [[ADR-086]], [[ADR-099]], [[ADR-101]].
