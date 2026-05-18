# Commercial Legal — repackage manifest

Sprint 11 (2026-05-18). Policy: ADR-033. Source: anthropics/claude-for-legal @ 4d55f539.
Oscar GC areas served: commercial, commercial-disputes (overlaps with litigation-legal).

The plugin is already in-house-oriented end-to-end — voice, escalation, work-product header, audience. No firm-branch sections (`if you're at a law firm`, `firm context`, `outside counsel as the user`) were found in any of the 12 SKILL.md files, 3 agent files, CLAUDE.md, or README.md. The strip regex from ADR-033 produces no matches; only invocation-reference fixes apply. The `matter-workspace` skill is explicitly self-disabling for in-house users and is kept on that basis.

## Skill verdicts

| Skill | Verdict | Reasoning | Edits required |
|---|---|---|---|
| amendment-history | keep | In-house contract-evolution trace; no firm branches. | Path swap + narrative fixes |
| cold-start-interview | keep (onboarding) | Onboarding only — questions extracted; downstream replaces with Oscar onboarding flow. | None (out of scope for this manifest; orchestrator drops) |
| customize | keep | In-house profile-editor; no firm branches. | Path swap + narrative fixes |
| escalation-flagger | keep | Pure in-house escalation-matrix lookup. | Path swap + narrative fixes |
| matter-workspace | keep-borderline | Designed for multi-client firms; self-disables for in-house. Kept because the skill explicitly handles the disabled state cleanly and Oscar may surface it for the rare in-house team running matter-scoped work (M&A side-letters, dispute-by-dispute). | Path swap + narrative fixes |
| nda-review | keep | In-house NDA triage with side-aware playbook. | Path swap + narrative fixes; output-folder swap |
| renewal-tracker | keep | In-house renewal-register skill; no firm branches. | Path swap + narrative fixes; register path swap |
| review | keep | Router skill — loads side-aware playbook from profile. | Path swap + narrative fixes |
| review-proposals | keep | Drives playbook-monitor outputs; in-house only. | Path swap + narrative fixes |
| saas-msa-review | keep | In-house SaaS overlay on vendor review. | Path swap + narrative fixes; output-folder swap |
| stakeholder-summary | keep | In-house business-translation skill; no firm framing. | Path swap + narrative fixes; output-folder swap |
| vendor-agreement-review | keep | In-house vendor-side review core. | Path swap + narrative fixes; output-folder swap |

## Agent files (inert until Sprint 12 Forge)

| File | One-line purpose |
|---|---|
| agents/deal-debrief.md | Weekly sweep of recently signed agreements; logs playbook deviations to `deviation-log.yaml`. |
| agents/playbook-monitor.md | Data-triggered proposal of playbook updates when a clause has been overridden 5+ times in 12 months. |
| agents/renewal-watcher.md | Weekly post of upcoming cancel-by windows from the renewal register. |

All three agents are in-house-shaped and use the same invocation-reference paths as the skills. Same path-swap and narrative-fix edits apply.

## CLAUDE.md (per-plugin practice profile template)

Superseded by Oscar's unified profile (`~/.config/oscar/profile.json`) per ADR-031. Orchestrator should drop the per-plugin CLAUDE.md template after the manifest pass: every section it carries — Who we are, Active integrations, Playbook (sales/purchasing/AI-training), Escalation, House style, Outputs (work-product header), Review preferences, NDA triage preferences, Playbook monitor settings — maps into Oscar's unified profile or is owned by Oscar's branding/telemetry/redactor layers. The cold-start interview's two priority-1 questions surface in Oscar's onboarding (below); the rest of the interview content is deferred to optional deep-setup later.

## Cold-start interview extraction

The upstream interview asks ~20 questions across role, integrations, practice setting, team size, volume, playbook side, full playbook positions (LoL, indemnity, DPA, term, governing law, AI/ML training), escalation matrix, house style, and seed documents. For Oscar's in-house counsel audience, two facts are load-bearing: which side they sit on most often (sales vs. purchasing — flips nearly every playbook position) and the one term that lands on the desk and triggers an automatic escalation regardless of dollar value (the deal-breaker / one-thing). Everything else can come from Oscar's shared company profile or be tuned later via /customize.

## Output Types proposed for this plugin

- Redlines (vendor-agreement-review, saas-msa-review)
- NDA Reviews (nda-review)
- MSA Reviews (vendor-agreement-review, saas-msa-review)
- Renewal Trackers (renewal-tracker, renewal-watcher)
- Escalation Memos (escalation-flagger)
- Stakeholder Summaries (stakeholder-summary)
- Amendment Histories (amendment-history) — proposing this as an addition to the ADR-031 list; it's a distinct output shape from the six above.

Output folder convention per ADR-033: `~/Documents/Oscar/Commercial/<Output Type>/`. The commercial-disputes overlap (escalation memos arising from contract disputes, amendment histories pulled in litigation context) writes under `~/Documents/Oscar/Commercial Disputes/<Output Type>/` when the active area is commercial-disputes.

## Borderline / open questions for orchestrator

- **renewal-register.yaml location.** Upstream stores at `~/.claude/plugins/config/claude-for-legal/commercial-legal/renewal-register.yaml`. Oscar needs a canonical equivalent — either inside the profile dir or under a dedicated state dir (`~/.config/oscar/state/commercial/renewal-register.yaml` is the obvious shape). Same question for `deviation-log.yaml`, `playbook-proposals.md`, `playbook-monitor-log.yaml`, and `verification-log.md`. These are state files, not profile config — flag for the state-layer ADR if one doesn't exist yet.
- **matter-workspace.** Upstream's design assumes a private-practice user. Oscar is in-house. The skill self-disables cleanly, so kept — but if Oscar never plans to expose multi-matter workflows, the orchestrator may want to drop it entirely rather than ship a permanently-disabled skill. Defer to ADR call.
- **DPA-by-reference handoff to privacy-legal.** vendor-agreement-review offers to hand a referenced DPA to `/privacy-legal:dpa-review`. That cross-plugin handoff needs to survive the rename; orchestrator should confirm the privacy-legal plugin's invocation surface before the path-fix pass.
- **Commercial-disputes overlap.** ADR-031 lists this plugin as serving both commercial and commercial-disputes. The natural overlap is amendment-history (tracing what a contract said when a dispute arose) and escalation-flagger (routing a dispute-flavored escalation). No edits needed to make this work — the skills are area-agnostic — but the bundle pipeline (sprint task #10) needs to know which area is active when picking the output folder.
- **AI/ML training rights section** in saas-msa-review and the CLAUDE.md template is a seven-dimension sub-playbook. Onboarding deep-setup should eventually capture all seven, but is not load-bearing for the priority-1 questions.
