# Employment Legal — repackage manifest

Sprint 11 (2026-05-18). Policy: ADR-033. Source: anthropics/claude-for-legal @ 4d55f539.
Oscar GC areas served: employment, employment-disputes (overlaps with litigation-legal).

## Skill verdicts

| Skill | Verdict | Reasoning | Edits required |
|---|---|---|---|
| cold-start-interview | onboarding-extract | Setup flow; questions extracted to onboarding-questions.json per ADR-032. Not bundled as a skill. | n/a — questions migrate to oscar-onboarding-mcp |
| customize | keep | In-house plugin-maintenance skill; no firm branches; mutates the practice profile. | Replace `~/.claude/plugins/config/claude-for-legal/employment-legal/CLAUDE.md` with `~/.config/oscar/profile.json`. Drop the slash-command names from invocation references. |
| expansion-kickoff | keep | International hiring kickoff; no firm branches; produces tracker artifact. | Profile path swap. Output path: `~/Documents/Oscar/Employment/Worker Classification Memos/` for tracker (closest match) or new `Expansion Trackers/` subfolder. Slash-command reference fix. |
| expansion-update | keep | Companion to expansion-kickoff; updates persistent tracker. | Profile path swap. Tracker output path same as kickoff. Slash-command reference fix. |
| handbook-updates | keep | In-house handbook diff/ripple skill; no firm branches. | Profile path swap. Output path: `~/Documents/Oscar/Employment/Handbook Updates/`. |
| hiring-review | keep | Offer-letter/restrictive-covenant review; no firm branches; in-house framing throughout (`When legal reviews hires`, "loop in GC"). | Profile path swap. Output path: `~/Documents/Oscar/Employment/Hiring Reviews/`. Anthropic/Claude narrative references not present. |
| internal-investigation | keep | Reference skill (`user-invocable: false`) carrying investigation framework; no firm branches. | Profile path swap (multiple). Output path for memo/log: `~/Documents/Oscar/Employment Disputes/Investigation Memos/` (investigation-* skills route here). |
| international-expansion | keep | Reference skill (`user-invocable: false`) for expansion framework; routes everything through outside counsel briefing — that is the in-house pattern, not a firm pattern. | Profile path swap. Tracker output path matches expansion-kickoff. |
| investigation-add | keep | Adds data to investigation; loader for internal-investigation Mode 2; no firm branches. | Profile path swap. Slash-command reference fix. |
| investigation-memo | keep | Drafts/updates investigation memo; loader for Mode 4. | Profile path swap. Output path: `~/Documents/Oscar/Employment Disputes/Investigation Memos/`. |
| investigation-open | keep | Opens investigation matter; loader for Mode 1. | Profile path swap. Output path same as memo. |
| investigation-query | keep | Q&A against investigation log; loader for Mode 3. | Profile path swap. |
| investigation-summary | keep | Audience-specific summary; loader for Mode 5. | Profile path swap. Output path same as memo. |
| leave-tracker | keep | Weekly tracker for leaves with statutory deadlines; in-house-coded throughout (HRIS, legal access). | Profile path swap. Output/register paths: `~/Documents/Oscar/Employment/Leave Logs/leave-register.yaml`. Reference to leave-tracker AGENT file (see Agent files below). |
| log-leave | keep | Single-entry leave logger feeding the tracker. | Profile path swap. Register path same as leave-tracker. |
| matter-workspace | keep-borderline | In-house default is `Enabled: ✗` (per its own logic); skill exits with a "you don't need this" message for in-house users. Keep for the corner case where in-house counsel actually tracks per-matter (e.g., per-investigation isolation) — but bundle as deferred/optional. | Profile path swap. Matters root: `~/Documents/Oscar/Employment/Matters/` (only if Enabled). Orchestrator may choose to drop entirely if in-house never trips Enabled=✓. |
| policy-drafting | keep | Multi-jurisdiction policy drafter; no firm branches; in-house-coded. | Profile path swap. Output path: `~/Documents/Oscar/Employment/Policy Drafts/`. |
| termination-review | keep | Termination memo with risk-flag scan; in-house throughout (`When legal reviews terminations`, "GC + outside counsel" for RIFs). | Profile path swap. Output path: `~/Documents/Oscar/Employment/Termination Reviews/`. |
| wage-hour-qa | keep | Jurisdiction-aware wage/hour Q&A with FLSA regular-rate scaffold; no firm branches. | Profile path swap. Output path: `~/Documents/Oscar/Employment/Wage-Hour Memos/`. |
| worker-classification | keep | Prospective-only classification with hard gate; no firm branches; in-house escalation pattern. | Profile path swap. Output path: `~/Documents/Oscar/Employment/Worker Classification Memos/`. |

## Agent files

| File | One-line purpose |
|---|---|
| agents/leave-tracker.md | Weekly scheduled monitor of open employee leaves with statutory deadlines (FMLA, state PFL, USERRA, ADA accommodation); fires decision-point alerts before deadlines lapse. Keep; profile path + register path swap; slash-command reference fix. |

## CLAUDE.md

The plugin CLAUDE.md is in-house-coded throughout: matter workspaces default `✗` for in-house, "loop in GC" escalation language, HRIS integrations, leave register at the config path. No firm-vs-in-house branches present — nothing to strip under §1 of the policy. Edits required at integration time:

- Replace every `~/.claude/plugins/config/claude-for-legal/employment-legal/CLAUDE.md` invocation with `~/.config/oscar/profile.json` (Oscar profile path).
- Replace every `~/.claude/plugins/config/claude-for-legal/company-profile.md` reference with the Oscar profile path (Oscar consolidates company + practice profile in one file).
- Rewrite the `## Available integrations` table: HRIS / document storage / Slack rows do not match Oscar's MCP set; replace with adeu (Commercial) and oscar-memory-mcp connectivity probes scoped to the employment context (this should be done at orchestrator time, not per-skill).
- Replace cache-path forward-migration logic (§4 of the template comment) with a no-op — Oscar has no plugin-cache versioning concept.
- Branding: "claude-for-legal" / "Claude" / "Anthropic" do not appear in narrative text in this CLAUDE.md (only in paths). Path-only replacements suffice.

## Cold-start interview extraction

Two priority-1 onboarding questions extracted from cold-start-interview Parts 0–1 — see `onboarding-questions.json`. These map to ADR-032's per-area onboarding flow. The full 10–15 minute interview (Parts 2–3: hiring/termination review triggers, handbook seed docs, jurisdiction escalation table) is **not** migrated into onboarding-mcp at this stage; it stays as a deferred deep-configure step that the orchestrator can surface later once the user has the area active.

## Output Types proposed for this plugin

Per ADR-031, Oscar GC Output Types for the employment + employment-disputes areas:

- **Investigation Memos** — `~/Documents/Oscar/Employment Disputes/Investigation Memos/` (investigation-* skills, primary; shared with litigation-legal per ADR-031)
- **Hiring Reviews** — `~/Documents/Oscar/Employment/Hiring Reviews/` (hiring-review)
- **Termination Reviews** — `~/Documents/Oscar/Employment/Termination Reviews/` (termination-review)
- **Handbook Updates** — `~/Documents/Oscar/Employment/Handbook Updates/` (handbook-updates)
- **Policy Drafts** — `~/Documents/Oscar/Employment/Policy Drafts/` (policy-drafting)
- **Wage-Hour Memos** — `~/Documents/Oscar/Employment/Wage-Hour Memos/` (wage-hour-qa)
- **Leave Logs** — `~/Documents/Oscar/Employment/Leave Logs/` (leave-tracker, log-leave; persistent register `leave-register.yaml`)
- **Worker Classification Memos** — `~/Documents/Oscar/Employment/Worker Classification Memos/` (worker-classification)
- **Expansion Trackers** (proposed addition not in ADR-031) — `~/Documents/Oscar/Employment/Expansion Trackers/` (expansion-kickoff, expansion-update; persistent tracker per country)

## Borderline / open questions for orchestrator

1. **matter-workspace bundling.** In-house default is Enabled=✗, and the skill itself routes users away from it. Two options: (a) bundle it for the rare in-house counsel who genuinely wants per-investigation isolation, or (b) drop it entirely since Oscar's element-scoping (per-Employee / per-Matter) is owned by oscar-memory-mcp, not by per-skill matters folders. Recommend (b) — drop it; Oscar's memory scoping makes this redundant and the skill's own logic admits it's off for in-house. Flagged for orchestrator decision.
2. **Expansion Tracker output type** not in ADR-031's list. Needs orchestrator to either add it to the area's Output Types list or route trackers into Worker Classification Memos (closest existing match, but semantically wrong). Recommend adding.
3. **Reference skills (`user-invocable: false`).** `internal-investigation` and `international-expansion` are loaded by other skills but not directly invoked. Bundle as-is — they're part of the dependency graph and the loader skills already point at them by name.
4. **Investigation-* sub-flow.** Six skills (open, add, query, memo, summary, plus reference internal-investigation) form a coherent workflow around the privileged log. Treat as a unit in the practice-area config — turning on one without the others leaves the dependency graph incomplete.
5. **Hooks file is empty.** `hooks/hooks.json` contains `{"hooks": {}}` — nothing to migrate.
6. **Role-gating (lawyer vs. non-lawyer) is preserved as-is.** The work-product header logic and consequential-action gates are in-house-appropriate and should not be stripped — they're orthogonal to the firm-vs-in-house gating in ADR-033.
7. **OWBPA / jurisdiction-research patterns.** Termination-review, hiring-review, wage-hour-qa, worker-classification all defer to runtime research rather than stored statutory rules. This is a load-bearing pattern for the in-house-counsel UX and depends on legal-research connectors being present (Westlaw / CourtListener) — orchestrator should surface a "no research connector → degraded mode" warning, possibly via a follow-on practice-area onboarding question.
