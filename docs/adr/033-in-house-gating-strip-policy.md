# ADR-033 — In-house gating strip policy for vendored skills

Status: accepted
Date: 2026-05-18
Sprint: 11

## Context

Anthropic's `claude-for-legal` (Apache 2.0) targets both in-house counsel and private-practice (law firm) workflows. Many SKILL.md files inside the 9 in-house plugins still carry firm-side branches — typically labelled "If you're at a firm:" / "If you're in-house:" — because upstream wants one library to serve both audiences.

Oscar GC's CLAUDE.md "inverting upstream UX defaults" doctrine, applied first in Sprint 10 (telemetry, recipe-trust, branding), extends to skill content. Oscar GC is in-house counsel by definition; no runtime branch on audience. The vendored skill library should not carry firm-branch noise.

Sprint 11 dispatches 9 per-plugin Plan agents (one per kept plugin) to repackage their content. Each needs a deterministic, written policy so the 9 agents land at the same answer for the same input.

## Decision

Each per-plugin agent applies these rules to every non-onboarding SKILL.md and agent file inside its plugin:

1. **Both branches present** → strip the firm branch. Markdown sections whose heading or first sentence matches `/^(##+ )?(if you'?re at (a|an?) (law )?firm|firm (lawyers|counsel|associates)|outside counsel|external counsel|firm context|in private practice)\b/i` are removed up to (but not including) the next sibling heading at the same or higher level. Code blocks inside a firm section go with the section. Inline parentheticals like `(if at a firm: …)` stripped at parenthesis bounds. The in-house counterpart heading (matching `/^(##+ )?(if you'?re in[- ]house|in-?house (counsel|lawyers|context))\b/i`) loses its qualifier and becomes the default narrative.
2. **Only firm branches present** (no in-house equivalent) → drop the skill. MANIFEST entry: `{verdict: "drop", reason: "firm-only after gating-strip"}`.
3. **Only in-house branches present** → keep, apply invocation-reference fixes only.
4. **Ambiguous** (the agent cannot confidently classify) → keep, mark `{verdict: "keep-borderline", reason: "<one sentence>"}` in MANIFEST.md. Orchestrator agent reviews borderlines as a batch.

**Invocation-reference fixes** applied to every kept skill regardless of gating verdict:

- Replace references to upstream's per-plugin practice profile (`~/.claude/plugins/config/claude-for-legal/<plugin>/CLAUDE.md`) with the unified profile at `~/.config/oscar/profile.json`.
- Replace upstream output paths with the ADR-034 convention.
- Replace any reference to "Anthropic", "Claude", "claude-for-legal" in user-facing narrative text with the neutral "in-house legal skill library". Top-of-file attribution comments (`<!-- Sourced from anthropics/claude-for-legal/<plugin> @ <sha>; Apache 2.0 -->`) stay.

Each per-plugin agent writes its decisions to `skills/in-house-legal/<plugin>/MANIFEST.md` with one row per skill: name, verdict (keep/drop/keep-borderline/rewrite), reasoning, edits applied.

## Rationale

- **Regex anchors are deterministic.** The 9 parallel agents need to land at the same answer on identical inputs. The heading-pattern regex is mechanical enough that two independent agent runs converge. Ambiguity routes into `keep-borderline` rather than into divergent verdicts.
- **Default-keep posture matches the sprint brief.** "Default keep when in doubt." Drops only happen for clearly firm-only content; borderlines stay in the library.
- **Single policy file = reproducibility.** Future upstream re-vendoring re-runs the same policy; reviewers can spot deviations easily.
- **Invocation-reference fixes are surgical.** No body rewrites beyond gating-strip + reference fixes. Preserves Anthropic's work product faithfully.

## Consequences

- Every kept SKILL.md carries a top-of-file attribution comment (per ADR-035) and one or more in-house-only references that were previously gated. Diff against upstream is mechanical, not creative.
- Borderline skills surface in SPRINT_LOG. Orchestrator-agent verdict is final; if dogfood surfaces a borderline that misclassified, the next sprint corrects with a one-line MANIFEST edit.
- Drops are documented but the source remains under `skills/in-house-legal/<plugin>/skills/<skill>/`. The orchestrator deletes only after the MANIFEST is committed.
- "Anthropic" / "Claude" leakage into user-visible narrative is neutralised; metadata comments preserve attribution.
- Re-vendoring on future upstream pulls re-applies this policy. The MANIFESTs become regression baselines: a previously-kept skill that suddenly fails the policy on the new upstream pull is a signal worth investigating.

## Supersedes

None. First ADR on in-house gating for vendored content.
