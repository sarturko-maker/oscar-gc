# Regulatory Legal — repackage manifest

Sprint 11 (2026-05-18). Policy: ADR-033. Source: anthropics/claude-for-legal @ 4d55f539.
Oscar GC areas served: regulatory, regulatory-disputes (overlaps with litigation-legal).

## Skill verdicts

| Skill | Verdict | Reasoning | Edits |
|---|---|---|---|
| cold-start-interview | keep | In-house oriented; "Practice setting" branch lists in-house + firm options as peer choices, not firm-only sections. No gating regex hits. | Invocation-reference fixes: replace `~/.claude/plugins/config/claude-for-legal/regulatory-legal/CLAUDE.md` → `~/.config/oscar/profile.json`; replace "Anthropic"/"Claude"/"claude-for-legal" with "in-house legal skill library"; default Outputs path → `~/Documents/Oscar/Regulatory/<Output Type>/`. |
| comments | keep | Pure in-house workflow: tracks NPRM comment-period decisions, owner notifications. No firm-only branches. Consequential-action gate is role-based (lawyer vs non-lawyer), not firm vs in-house. | Invocation-reference fixes only (paths, branding). |
| customize | keep | Practice profile editor. Lists practice setting as a tunable field but no firm-only section. | Invocation-reference fixes only. |
| gap-surfacer | keep | Reference skill for gap and comment trackers. Matter-context block defaults off for in-house and is preserved for regulatory-disputes overlap. No firm-only sections. | Invocation-reference fixes only. |
| gaps | keep | Thin wrapper that delegates to gap-surfacer. | Invocation-reference fixes only. |
| matter-workspace | keep-borderline | Skill itself is explicitly scoped to private-practice multi-client work and ships disabled by default for in-house. Documentation explicitly says "If you're in-house regulatory counsel for one company, this section is off and nothing below applies." Kept rather than dropped because regulatory-disputes overlaps with litigation-legal where matter-style isolation might legitimately surface (e.g., simultaneous unrelated agency inquiries). Orchestrator should confirm whether to expose it or leave default-disabled. | Invocation-reference fixes only; recommend Oscar default: `Enabled: ✗` and hidden from the practice-area menu unless orchestrator turns it on. |
| policy-diff | keep | Core in-house workflow: regulatory change vs internal policy library. Matter-context block defaults off for in-house. | Invocation-reference fixes only. |
| policy-redraft | keep | Produces marked-up policy redraft proposals. Pure in-house workflow. | Invocation-reference fixes only. |
| reg-feed-watcher | keep | Pulls regulatory feeds, filters by materiality. Pure in-house workflow. References a source-catalog reference file. | Invocation-reference fixes only. |

## Agent files

| File | One-line purpose |
|---|---|
| agents/reg-change-monitor.md | Scheduled agent: pulls feeds on cadence, filters by materiality, posts digest; runs gap-surfacer reminder check. |

Verdict: keep. No firm-only branches. Invocation-reference fixes only (config path, branding tokens, default tool name normalization for Slack send).

## CLAUDE.md

In-house-shaped from the start. No `if you're at a firm` branches. Heavy guardrails (work-product header by role + jurisdiction, source-tag vocabulary, retrieved-content trust, no-silent-supplement, currency trigger, severity floor, dashboard offer, large-input/large-output discipline) all carry to Oscar without edits.

Edits required at repackage time:
- Config path: `~/.claude/plugins/config/claude-for-legal/regulatory-legal/CLAUDE.md` → `~/.config/oscar/profile.json` (profile lives in JSON; section names migrate to JSON keys)
- Shared profile path: `~/.claude/plugins/config/claude-for-legal/company-profile.md` → company-profile section of `~/.config/oscar/profile.json`
- Outputs path: `~/Documents/Oscar/Regulatory/<Output Type>/` (Comment Drafts, Gap Analyses, Policy Diffs, Reg Feed Monitors, Policy Redrafts, Gap Surfacing Memos)
- Brand strings: "Anthropic"/"Claude"/"claude-for-legal" → "in-house legal skill library"
- Matter-workspace references stay but default OFF for in-house (orchestrator may surface them for regulatory-disputes if it later decides matter isolation is needed)

## Cold-start interview extraction

Source: `skills/cold-start-interview/SKILL.md`, Parts 1 (watchlist) and 4 (feed sources + comment-period tracking). The skill prompts the user to name primary regulators (and *why* each one) and to declare whether they want NPRM comment deadlines flagged for decision (which implies rulemaking-participation posture). These two — primary regulators/industry, and rulemaking-participation posture — are the load-bearing inputs for the rest of the configuration (materiality threshold, policy-library scoping, comment-tracker enablement, digest cadence).

Two priority-1 questions extracted; see `onboarding-questions.json`.

## Output Types proposed for this plugin

- Comment Drafts (NPRM responses, agency-response letters — drafted elsewhere, decisions tracked here)
- Gap Analyses (per-requirement policy gap output from policy-diff)
- Policy Diffs (full diff output from policy-diff, including bottom-line summary table)
- Reg Feed Monitors (filtered digests from reg-feed-watcher and the reg-change-monitor agent)
- Policy Redrafts (marked-up redraft proposals from policy-redraft, written to dated files)
- Gap Surfacing Memos (status reports from gap-surfacer / gaps, with overdue / due-soon / watch buckets)

All under `~/Documents/Oscar/Regulatory/<Output Type>/`. For the regulatory-disputes overlap, the orchestrator decides whether outputs route under `Regulatory/` or `Regulatory Disputes/` — recommend Regulatory by default with a per-matter override.

## Borderline / open questions for orchestrator

1. **matter-workspace exposure.** Default for in-house users is disabled. Should the skill appear in the practice-area surface at all for in-house lawyers, or only surface when regulatory-disputes triggers a multi-matter posture? Recommendation: hide from menu by default; expose only if regulatory-disputes is the active area and the user has more than one open dispute.
2. **regulatory-disputes overlap with litigation-legal.** This plugin and litigation-legal both claim regulatory-disputes per ADR-031. Confirm whether litigation-style matter isolation (litigation-legal's pattern) supersedes this plugin's matter-workspace default-off, or whether the user picks which plugin owns regulatory-disputes at onboarding.
3. **Output-Type folder split.** Gap Surfacing Memos and Gap Analyses are adjacent — Gap Analyses are the diff output, Gap Surfacing Memos are the tracker status report. Confirm whether to keep them split or fold into a single "Gap Tracker" folder.
4. **Reg-feed-watcher source catalog.** `skills/reg-feed-watcher/references/source-catalog.md` is referenced by the skill but not included in this read pass. Confirm bundling and verify it doesn't carry firm-specific framing.
5. **Verification-log and gap-tracker.yaml.** Per-plugin state files (`verification-log.md`, `gap-tracker.yaml`, `comment-tracker.yaml`) currently live under `~/.claude/plugins/config/claude-for-legal/regulatory-legal/`. Confirm new Oscar paths — recommend `~/.config/oscar/plugins/regulatory/` for state files distinct from the profile JSON.
