# IP Legal — repackage manifest

Sprint 11 (2026-05-18). Policy: ADR-033. Source: anthropics/claude-for-legal @ 4d55f539.
Oscar GC areas served: ip, ip-disputes (overlaps with litigation-legal).

## Skill verdicts

| Skill | Verdict | Reasoning | Edits required |
|---|---|---|---|
| cease-desist | keep | Send + receive C&D workflow. Routes through approval matrix from profile; in-house-shaped already (approver = GC / Head of IP). No firm-only sibling sections. | Replace `~/.claude/plugins/config/claude-for-legal/ip-legal/CLAUDE.md` (10+ refs) with `~/.config/oscar/profile.json`. Output paths (`<matter-folder>/cease-desist/...`) → `~/Documents/Oscar/Intellectual Property/Cease-Desist Letters/`. Strip narrative refs to "Claude" / "claude-for-legal". |
| clearance | keep | Trademark knockout + LoC factor analysis; first-pass, attorney-review framing fits in-house IP counsel. No firm-only branch. | Profile path swap (5+ refs). Output path → `~/Documents/Oscar/Intellectual Property/Clearance Memos/`. "Registered trademark counsel" narrative stays (it's about external specialists, not firm-only gating). |
| cold-start-interview | keep-borderline | Interview asks practice setting in Part 0 with four branches (solo/small firm, midsize/large firm, in-house, gov/clinic). Branches by setting are conditional, not firm-only sections per the regex. Onboarding pre-empts this skill for Oscar — keep as fallback but Oscar's onboarding-mcp owns first-run profile. | Trim firm/solo branches and matter-workspace toggling at orchestrator stage. Profile path swap. Drop the `/legal-builder-hub:related-skills-surfacer` reference. |
| customize | keep | Guided edits to existing profile — useful for in-house "change my watch list / escalation contact" use case. Structural; no firm gating. | Profile path swap. Strip the company-profile.md "shared across 12 plugins" framing (Oscar has one profile). |
| fto-triage | keep | Patent FTO triage — claim-chart first pass, willfulness flag, routes to patent OC named in profile. In-house counsel running FTO before launch is exactly the target workflow. | Profile path swap. Output path → `~/Documents/Oscar/Intellectual Property/FTO Opinions/`. Privileged-document language stays. |
| infringement-triage | keep | Cross-mode (TM / copyright / patent / trade secret) triage with flag list. Routes to enforcement posture from profile. No firm-only branch. | Profile path swap. Output path → `~/Documents/Oscar/Intellectual Property/Infringement Triage Memos/` (or `IP Disputes/...` if ADR routes triages to disputes area). Hand-offs to `cease-desist` / `takedown` stay. |
| invention-intake | keep | Six-screen patentability triage (novelty, obviousness, §101, bar dates, detectability, strategic value). In-house IP counsel screening inventor disclosures is the canonical use. | Profile path swap. Output path → `~/Documents/Oscar/Intellectual Property/Invention Disclosures/`. Patent-prosecution-strategy narrative stays. |
| ip-clause-review | keep | Reviews IP clauses in MSAs/SOWs/employment/contractor — heavy in-house workload. Severity-bucketed with redline language. | Profile path swap. Output path → `~/Documents/Oscar/Intellectual Property/IP Clause Reviews/`. AI-inventorship / AI-content asides stay. |
| matter-workspace | drop | Skill's own description: "Only relevant for multi-client practices (private practice — solo, small firm, large firm). If you're in-house with one client, this section is off and nothing below applies". CLAUDE.md template defaults `Enabled: ✗` for in-house. Per ADR-033 §2: firm-only after gating-strip → drop. Oscar's per-element memory scope (per Customer / per Entity) supersedes matter folders. | n/a — drop entirely. |
| oss-review | keep | OSS license compliance against deployment model. Engineering + legal collaboration is core in-house IP counsel work, especially commercial SaaS. | Profile path swap. Output path → `~/Documents/Oscar/Intellectual Property/OSS Reviews/`. Reference to `CONNECTORS.md` repo file should be removed (Oscar bundles connectors). |
| portfolio | keep | Registration + renewal tracker. Anchored on `portfolio.yaml` register; integrates with `ip-renewal-watcher`. In-house portfolio management is canonical. | Profile path + portfolio.yaml path swap → `~/.config/oscar/ip/portfolio.yaml` (or per-element scoped under the relevant store). Output path → `~/Documents/Oscar/Intellectual Property/Portfolio Reports/`. |
| takedown | keep | DMCA send / respond / counter-notice. Three modes, perjury + fair-use gates. In-house brand protection and copyright enforcement use it. | Profile path swap. Output path → `~/Documents/Oscar/Intellectual Property/Cease-Desist Letters/` (DMCA notices share the C&D output type per ADR-031 hints) or a dedicated `Takedown Notices/` subdir if the orchestrator decides to split. |

## Agent files

| File | One-line purpose |
|---|---|
| agents/ip-renewal-watcher.md | Scheduled (weekly) read of the portfolio register; posts ranked deadline report to the channel named in profile, with immediate-escalation for grace/lapsed items. Uses Anaqua/CPA/AltLegal MCPs if connected. Keep; profile + portfolio.yaml path swaps; drop hard-coded Slack tool ref or generalise to whatever notify channel the profile names. |

## CLAUDE.md

Template practice profile. Heavy. Contains:
- Shared guardrails (no-silent-supplement, currency-trigger, verify-user-stated-facts, destination-check, source-attribution, cross-skill severity floor, retrieved-content trust) — all keep; these are skill-library-wide rules.
- Outputs section with role-conditional work-product header (lawyer / patent agent USPTO / patent agent non-USPTO / non-lawyer) — keep.
- IP practice profile (practice mix, registered jurisdictions, IP management system, outside counsel roster) — keep; this is what Oscar's onboarding-mcp populates.
- Brand protection + Enforcement posture + Approval matrix — keep; in-house defaults are already the framing.
- Matter workspaces section — drop (matter-workspace skill drops).
- Proportionality + jurisdiction recognition + ad-hoc-questions sections — keep.
- References to `~/.claude/plugins/config/claude-for-legal/ip-legal/CLAUDE.md` (~30 occurrences) — rewrite to `~/.config/oscar/profile.json`.
- References to `company-profile.md` "shared across 12 plugins" — collapse; Oscar has one unified profile.
- Verification-log path → `~/.config/oscar/ip/verification-log.md`.

Keep CLAUDE.md as the IP practice profile template; orchestrator merges shared-guardrail blocks across plugins into one canonical source.

## Cold-start interview extraction

Cold-start-interview asks (Part 0–6): role, practice setting, integrations, practice-area mix (TM/patent/copyright/TS/OSS/design), volume, jurisdiction footprint (marks registered in, patents granted in, enforcement geography), practice documents (portfolio list, brand guidelines, C&D template, enforcement playbook, OSS policy), enforcement posture (aggressive/measured/conservative + triggers), approval matrix per letter type, automatic escalations, escalation routing for clearance / FTO / OSS findings, brand watch (watched marks, jurisdictions, service, cadence).

For Oscar in-house IP counsel, the two highest-leverage priority-1 questions are: (1) practice-area mix (drives which skills light up — TM-only vs. patent-only vs. full IP gets a 3-minute vs. 15-minute interview, per the interview's own branching logic); (2) product/tech focus that drives IP risk (the company's IP risk surface — what's being built, where the FTO exposure is, which marks are commercially load-bearing). Together they let the orchestrator route TM-clearance work, FTO triage, OSS reviews, and enforcement posture to the right defaults without re-asking.

Extracted to `onboarding-questions.json` in this directory.

## Output Types proposed for this plugin

Aligned to ADR-031 hints:
- FTO Opinions — `fto-triage`
- Clearance Memos — `clearance`
- Cease-Desist Letters — `cease-desist` (send drafts + receive triage memos)
- Invention Disclosures — `invention-intake` (screen memos)
- OSS Reviews — `oss-review`
- Portfolio Reports — `portfolio` (reports + audits) + `ip-renewal-watcher` (scheduled reports)
- Infringement Triage Memos — `infringement-triage` (all four modes)
- IP Clause Reviews — `ip-clause-review`

DMCA takedowns / counter-notices: route to Cease-Desist Letters per ADR-031, with optional `Takedown Notices/` subdir if the orchestrator splits.

## Borderline / open questions for orchestrator

1. **matter-workspace drop ripple.** Every kept skill has a "Matter context" preamble that conditionally branches on `## Matter workspaces`. After dropping matter-workspace, the preambles should be removed (not left as dead conditional code). Orchestrator pass: strip the matter-context block from cease-desist, clearance, fto-triage, infringement-triage, invention-intake, ip-clause-review, oss-review, takedown SKILLs at the invocation-reference-fixes stage.
2. **ip-disputes vs. ip routing.** ADR-031 routes both `ip` and `ip-disputes` here. `infringement-triage`, `cease-desist` (receive mode), and `takedown` (respond + counter modes) are dispute-shaped; `clearance`, `fto-triage`, `invention-intake`, `oss-review`, `portfolio`, `ip-clause-review` are non-dispute. Orchestrator should decide whether to surface skills by area or universally to both areas. Default recommendation: surface universally with matter-type metadata so the agent picks the right entry mode.
3. **portfolio.yaml location.** Should this live under `~/.config/oscar/ip/portfolio.yaml` (plugin-scoped) or under the per-Entity store as scoped data? Memory-MCP boundary call. Suggest plugin-scoped for now since the IP portfolio is a Company-level register; per-element memory carries per-Customer / per-Entity facts that reference it.
4. **Solve Intelligence + CourtListener + Descrybe connectors.** Bundled vs. opt-in? Onboarding mentions IP management system (Anaqua, CPA Global, PatSnap, Clarivate) — confirm Oscar's MCP bundle list before shipping the integration-check probe.
5. **cold-start-interview vs. Oscar onboarding-mcp.** Two onboarding paths exist. Recommend cold-start-interview becomes a re-run / re-tune skill (`/ip:customize` style), and Oscar's onboarding-mcp owns first-run. Orchestrator decision.
