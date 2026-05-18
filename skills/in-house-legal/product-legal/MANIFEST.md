# Product Legal — repackage manifest

Sprint 11 (2026-05-18). Policy: ADR-033. Source: anthropics/claude-for-legal @ 4d55f539.
Oscar GC area served: product.

## Skill verdicts

| Skill | Verdict | Reasoning | Edits |
|---|---|---|---|
| cold-start-interview | keep-both-branches | Branches on practice setting (Solo/small firm | Midsize/large firm | In-house | Gov). In-house branch fully formed (escalation matrix, GC/CLO routing, business handoff). Firm/solo branches strip. | Strip "Solo / small firm" and "Midsize / large firm" branch text in Part 0 → Practice setting; remove "Practices that don't fit the boxes" alt-paths to private practice; collapse Matter workspaces preamble to in-house default. Invocation-reference fixes throughout. |
| customize | keep | Generic profile editor; no firm gating. Lists sections customizable across both settings. | Invocation-reference fixes (config path, plugin paths, Anthropic→in-house legal skill library). |
| feature-risk-assessment | keep | Deep risk assessment skill. In-house-coded (talks to GC, leadership, regulator escalation). Matter-context block is gated on Enabled=✗ default for in-house. | Invocation-reference fixes; matter-context block becomes inert under in-house default. |
| is-this-a-problem | keep | Fast triage for PM Slack questions. Pure in-house workflow (PMs, calibration table, escalation up to GC). | Invocation-reference fixes. |
| launch-review | keep | Core in-house product counsel deliverable. Full launch review against framework + calibration. No firm-specific branch. | Invocation-reference fixes; matter-context block inert under in-house default; output path → ~/Documents/Oscar/Product/Launch Reviews/. |
| marketing-claims-review | keep | Claim-by-claim review skill. Generic + applies to in-house marketing function. | Invocation-reference fixes; output path → ~/Documents/Oscar/Product/Marketing Claims Reviews/. |
| matter-workspace | drop | Skill is explicitly private-practice-only. Header: "Default state is off. In-house users never see this." Skill body explains the disabled state and routes user to re-run cold-start for private-practice setting. Firm-only after gating-strip. | n/a — drop. Oscar GC's per-Stream memory scope replaces this. |

## Agent files (inert until Sprint 12 Forge)

| File | One-line purpose |
|---|---|
| agents/launch-watcher.md | Daily scan of launch tracker (Jira/Linear) flagging upcoming launches that match calibration patterns or trigger keywords (privacy, AI, children, vendors). |

## CLAUDE.md

Plugin-level CLAUDE.md (398 lines) contains: configuration-location preamble, practice profile template with `[PLACEHOLDER]` markers, work-product header policy (jurisdiction-aware), reviewer-note format, quiet-mode rules for client/board-facing deliverables, next-steps decision tree, dashboard offer for data-heavy outputs, shared guardrails (no-silent-supplement, currency trigger, fact-verification, statute-text rule, pre-flight check, source-attribution tags, tag vocabulary, destination check, cross-skill severity floor, file-access failure, verification log), scaffolding-not-blinders rule, ad-hoc-questions handler, proportionality sort, jurisdiction recognition, retrieved-content trust, large-input/large-output discipline, currency watch pointer, matter-workspaces block (off for in-house — inert), launch review process placeholders, review framework placeholders, risk calibration tables, marketing claims placeholders, escalation matrix, connected systems, seed reviews.

Edits required at apply phase: redirect config path to `~/.config/oscar/profile.json`; rewrite output paths to `~/Documents/Oscar/Product/<Output Type>/`; replace "claude-for-legal"/"Anthropic"/"Claude" references with "in-house legal skill library"; collapse the matter-workspaces block to a single inert line (in-house default).

## Cold-start interview extraction

Two priority-1 onboarding questions extracted for in-house Product counsel:

1. **Product portfolio + launch cadence** — what the company ships, who it ships to (consumer/B2B/regulated), and how launches reach legal (tracker, lead time, sign-off type). This is the load-bearing context that calibrates every downstream review.
2. **Risk axes that fire here** — which product-touching regimes the team treats as live (privacy/data, AI governance, children/minors, financial, health, IP, marketing-claims substantiation) and what counts as a P0 blocker versus an FYI. This is the risk-calibration table seed.

Other interview questions from cold-start-interview/SKILL.md (review framework categories, escalation contacts, marketing posture, seed launch reviews, integrations) are deferred to area-deepening passes after Sprint 11 minimum.

## Output Types proposed for this plugin

- Launch Reviews
- Marketing Claims Reviews
- Feature Risk Assessments
- Issue Triage Memos

Output path pattern: `~/Documents/Oscar/Product/<Output Type>/`.

## Borderline / open questions for orchestrator

- **cold-start-interview shared company profile**: skill reads `company-profile.md` one level up (shared across all 12 plugins). Oscar GC's profile.json supersedes — confirm orchestrator collapses the two-tier read into a single profile.json read.
- **launch-watcher agent** depends on Jira/Linear MCP and Slack MCP. Bundled distribution shape (per CLAUDE.md "Distribution shape") means external MCPs cannot ship in the binary. Defer to Sprint 12 Forge — agent file inert in Sprint 11.
- **matter-workspace skill dropped**: confirm Oscar GC's per-Stream memory scope (per CLAUDE.md "Memory model") is the replacement, and that no other skill in product-legal calls `/product-legal:matter-workspace` for a flow that needs rewiring.
- **Handoffs to other plugins** (`/ai-governance-legal:use-case-triage`, `/privacy-legal:pia-generation`, `/ai-governance-legal:vendor-ai-review`) — these cross-plugin slash-command invocations appear in launch-review, feature-risk-assessment, is-this-a-problem. Orchestrator decides whether to keep as documentation (deferred capability) or rewrite as in-Oscar tool calls.
