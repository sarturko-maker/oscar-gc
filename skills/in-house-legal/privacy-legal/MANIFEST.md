# Privacy Legal — repackage manifest

Sprint 11 (2026-05-18). Policy: ADR-033. Source: anthropics/claude-for-legal @ 4d55f539.
Oscar GC area served: privacy.

## Skill verdicts

| Skill | Verdict | Reasoning | Edits |
|---|---|---|---|
| cold-start-interview | keep-borderline | Practice-setting prompt enumerates Solo/Small-firm/Midsize-firm/In-house/Gov-clinic as user-selectable options and reshapes downstream questions per branch. No heading matches the ADR-033 gating regex, so policy rule 3 applies; flagged for orchestrator since the multi-setting branching is wider than other plugins and onboarding extraction supersedes most of it. | Invocation-reference fixes; onboarding questions extracted separately (see onboarding-questions.json). |
| customize | keep | In-house-shaped throughout. Single "outside counsel" mention is a routing target in the People section, not a firm branch. | Invocation-reference fixes. |
| dpa-review | keep | Pure in-house counsel workflow (processor/controller posture from configured profile; escalates to GC). No firm gating. | Invocation-reference fixes; output path -> ~/Documents/Oscar/Privacy/DPAs/. |
| dsar-response | keep | Internal DSAR workflow against systems list configured at company level. No firm gating. | Invocation-reference fixes; output path -> ~/Documents/Oscar/Privacy/DSAR Responses/. |
| matter-workspace | keep-borderline | Explicitly self-disables when Enabled=✗ (in-house default per upstream). Skill is dead-code under Oscar GC's single-tenant in-house assumption but documents that state cleanly. Orchestrator should decide whether to drop entirely or retain as inert. | Invocation-reference fixes; flagged for orchestrator. |
| pia-generation | keep | In-house PIA workflow against configured privacy program. No firm gating. | Invocation-reference fixes; output path -> ~/Documents/Oscar/Privacy/PIA Reports/. |
| policy-monitor | keep | Practice-drift sweep across configured outputs folder; in-house posture throughout. No firm gating. | Invocation-reference fixes; output path -> ~/Documents/Oscar/Privacy/Policy Monitors/. |
| reg-gap-analysis | keep | In-house reg-diff workflow against configured policy commitments. Single "Suggest outside counsel" line is a routing target, not a firm branch. | Invocation-reference fixes; output path -> ~/Documents/Oscar/Privacy/Gap Analyses/. |
| use-case-triage | keep | In-house triage workflow; "provisional mode" fallback when profile not configured is consistent with Oscar GC's onboarding flow. No firm gating. | Invocation-reference fixes; output path -> ~/Documents/Oscar/Privacy/Use-Case Triage Memos/. |

## Agent files

None. No `agents/` directory in upstream plugin.

## CLAUDE.md

In-house posture throughout; configuration template referenced at upstream cache/config paths needs path-fix to `~/.config/oscar/profile.json`. No firm gating to strip. Replace "Anthropic" / "Claude" / "claude-for-legal" wording in user-visible narrative with "in-house legal skill library". Top-of-file attribution comment per ADR-035. Many references to `/privacy-legal:<skill>` invocations across the file — keep slash invocations (Oscar GC uses upstream's slash-command surface) but update underlying config paths.

## Cold-start interview extraction

Upstream's cold-start-interview asks ~30 questions across Parts 0-5 (role, practice setting, integrations, business model, regulatory footprint, team, DPA positions, PIA house style, DSAR process, seed documents, outputs). Under Oscar GC's per-area onboarding model (ADR-032), the two highest-leverage priority-1 questions for in-house Privacy counsel are jurisdictional regulatory footprint and processor/controller posture — every downstream skill (DPA review, DSAR response, PIA generation, use-case triage, policy monitor, reg-gap analysis) gates on these two facts and gives degraded output without them. See `onboarding-questions.json`.

## Output Types proposed for this plugin

- DPAs (dpa-review)
- DSAR Responses (dsar-response)
- PIA Reports (pia-generation)
- Policy Monitors (policy-monitor sweep + direct-query)
- Gap Analyses (reg-gap-analysis)
- Use-Case Triage Memos (use-case-triage)

Matches ADR-031 hints exactly.

## Borderline / open questions for orchestrator

1. **cold-start-interview** — Oscar GC replaces upstream's interview with the per-area onboarding MCP. The skill becomes redundant once `onboarding-questions.json` is wired into oscar-onboarding-mcp. Drop after orchestrator confirms the MCP path is canonical, or retain as `--redo` fallback?
2. **matter-workspace** — Oscar GC's in-house single-tenant assumption makes matter workspaces inert (Enabled=✗ permanently). Drop entirely (skill never runs) or retain as documentation of the disabled state for future multi-entity tenants? Default-keep posture says retain; user impact is zero either way.
3. **customize** — Overlaps with Oscar GC's settings UI for the unified profile at `~/.config/oscar/profile.json`. Keep both (skill is text-driven, settings UI is form-driven) or drop in favour of UI-only? Recommend keep — text-driven edits remain useful for power users.
4. **Slash invocations** — Upstream uses `/privacy-legal:<skill>` everywhere. Oscar GC inherits Goose's slash surface; confirm slash namespace stays as `privacy-legal` or shifts to a flatter `privacy:<skill>` form.
