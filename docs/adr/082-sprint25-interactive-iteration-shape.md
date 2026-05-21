# ADR-082 — Sprint 25 interactive iteration shape

Status: accepted
Date: 2026-05-21
Sprint: 25

## Context

Sprint 24-C built an eval-harness substrate at `evals/oscar-llp/` whose Claude-side iteration runs through `@anthropic-ai/sdk` — `scripts/lib-claude.js` (217 LOC) calls `client.messages.create()` with cached system prompts; `package.json` pins `@anthropic-ai/sdk@0.40.1`; `lib-cost-log.js` ships an `ANTHROPIC_PRICING` table. The 24-C brief said "iteration via Max subscription"; that was misread as "SDK calls, billed against Max headroom." Max subscriptions cover Claude Code (interactive), not API access — flagged as a pre-execution gate ("requires pay-as-you-go Anthropic API key"). User pushback at sprint hand-off: *"what is the reason you cannot iterate on a max subscription — you have all the tools that are needed."* The SDK wrapper duplicates what Read / Edit / Bash already do per conversation turn. Iterating the broken language on the verification gate ([[ADR-081]]'s target) does not require batched-SDK calls; it requires Claude-the-judge to read 20 transcripts and propose one subtractive edit — that is one (or two) conversation turns, not an unattended script.

## Decision

**Interactive iteration shape.** Each iteration cycle is split across three layers by who/what executes:

- **Phase A (unattended-in-turn, Node)** — `evals/oscar-llp/scripts/run-partner-cycle.js` (trimmed from `run-iteration.js`) spawns 20 `goose run --recipe <yaml> --no-session` invocations serially per partner-cycle, writes transcripts + manifest, emits `READY-FOR-JUDGE` marker.
- **Phase B (Claude Code, in-conversation)** — me reading the 20 transcripts + gold labels, judging per `prompts/judge-rubric.md`, writing `scores.json` + `proposal.json` directly via Edit / Write. No SDK call. Re-read judge-rubric + subtractive-system prompts at the start of every Phase B turn to anchor against judging drift.
- **Phase C (Node, structural)** — `evals/oscar-llp/scripts/apply-proposal.js` (new, ~80 LOC) validates the proposal via `lib-subtractive.validateRemovals` + `strictSubsetCheck`, applies removals via `applyRemovals`, writes `iter-<k+1>/prompt.txt`, emits unified diff. Layer-B structural validator unchanged from 24-C; Layer-A subtractive-system prompt unchanged; Layer-C human-eyeball diff unchanged.

## Rationale

The Max subscription already covers the Claude-side intelligence (me running). The SDK wrapper buys: (a) batched-call consistency across 20 transcripts → mitigated by re-reading judge-rubric + closed COVERED/PARTIAL/MISSED/WRONG taxonomy; (b) cache discounting → not applicable since judging happens in conversation context where caching is automatic for me; (c) unattended runs → only Phase A is unattended; Phase B *should* be in-conversation because the proposal is load-bearing intelligence. Trade-off: wall-clock longer (~6 hours across multiple sessions vs 2-3 unattended); spend ~$40 lower (~$12 MiniMax-only vs ~$52 mixed). Acceptable: Claude Code's natural cadence is conversational turns, not unattended scripts; substrate matches the cadence.

## Alternatives rejected

- **Keep the SDK wrapper, ship Anthropic API key on host** — duplicates Claude Code's native capability; requires a second Anthropic billing surface beyond Max; substrate complexity for no judging-quality gain.
- **Hybrid (SDK for cross-partner Phase 4, interactive for per-cycle Phase B)** — two judging shapes is worse than one; Phase 4 patterns appearing in ≥2 partners are equally readable by me in-conversation.
- **Sub-agent (Agent tool with Explore/general-purpose) does the judging** — sub-agents read excerpts, paraphrase, and miss load-bearing visual evidence ([[MEMORY: feedback_visual_decisions_read_source]]); judging needs full transcripts in my own context, not a delegate's summary.

## Consequences

- Deleted: `evals/oscar-llp/scripts/lib-claude.js`, `evals/oscar-llp/package.json`. Anthropic-side pricing + costForAnthropicCall removed from `lib-cost-log.js`.
- Renamed: `run-iteration.js` → `run-partner-cycle.js`; trimmed from 394 LOC (Phase A + B + C + Phase 2 in one script) to ~150 LOC (Phase A only).
- New: `apply-proposal.js` (~80 LOC). Lifts the Phase C structural validation out of the orchestrator into a standalone CLI invoked once per cycle.
- Unchanged: iteration target ([[ADR-081]]'s `verificationGateBlock.ts`); subtractive constraint ([[lib-subtractive.js]] Layer-B validator + Layer-A `prompts/subtractive-system.md` + Layer-C unified diff); partner-recipe builder (`lib-recipe24.js`); sanity-check gate (`sanity-check.js`); judge rubric (`prompts/judge-rubric.md`); cross-partner extractor schema (`prompts/cross-partner-extractor.md`, read by me at Phase 4 — the prompt file survives; only the SDK-side `extractCrossPartnerPatterns` function in `lib-claude.js` goes).
- Removed pre-execution gate: Anthropic API key. Remaining gates: MiniMax dev key, Sprint 23 sanity check PASS, benchmark files populated, Sprint 22 smoke 3/3 PASS.
- Phase 4 cross-partner pattern extraction stays in scope; executed by me reading 12 iteration histories directly at sprint close.

## Supersedes

None. Companion to [[ADR-081]] (the iteration target, unchanged) and [[ADR-077]] (Sprint 23 eval baseline + frozen `SPRINT_22_DIRECTIVE` / `RALPH_DIRECTIVE` constants under `evals/lavern-jv/`). Architectural shift here is about *execution shape* of the iteration loop, not about *what* iteration edits.
