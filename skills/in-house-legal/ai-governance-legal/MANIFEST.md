# AI Governance Legal — repackage manifest

Sprint 11 (2026-05-18). Policy: ADR-033. Source: anthropics/claude-for-legal @ 4d55f539.
Oscar GC area served: ai-governance.

## Skill verdicts

| Skill | Verdict | Reasoning | Edits required |
|---|---|---|---|
| ai-inventory | keep | EU AI Act per-system register; in-house-shaped throughout (deployer/provider as a single org). | Config path → `~/.config/oscar/profile.json`; rename `ai-systems.yaml` path under Oscar profile dir; rebrand `/ai-governance-legal:` invocations as Oscar-native. |
| aia-generation | keep | Generic AIA workflow; no firm branches. | Config path; output path → `~/Documents/Oscar/AI Governance/Impact Assessments/`; "Anthropic/Claude/claude-for-legal" → "in-house legal skill library" in narrative. |
| cold-start-interview | keep-borderline | Skill stays for re-runs/`--check-integrations`, but Oscar's own onboarding handles first-run setup. Part 0 (Practice setting) has firm/in-house branching that needs stripping. | Strip Practice-setting options 1, 2, 4 ("Solo/small firm", "Midsize/large firm", "Government/legal aid/clinic") and "Practices that don't fit the boxes" paragraph; remove firm-branching paragraph after Practice setting question; remove matter-workspace prompts; collapse `/ai-governance-legal:` invocations; rewrite to read from `~/.config/oscar/profile.json`; align with Oscar onboarding contract. |
| customize | keep | Generic profile editor; no firm branches. | Config path; remove `matter workspace paths` bullet from customizable map; rebrand invocations. |
| matter-workspace | drop | Firm-only after gating-strip — skill's own first instruction is "If `Enabled` is `✗` (the default for in-house users)... matter machinery is invisible"; entire purpose is multi-client isolation Oscar GC users never need. | n/a |
| policy-monitor | keep | Generic drift sweep + direct-query; no firm branches. | Config path; output path → `~/Documents/Oscar/AI Governance/Policy Memos/`; remove matter-context block (none present — verify) and `/ai-governance-legal:` rebrand. |
| policy-starter | keep | Generic policy drafter; "firm or company-wide" framing applies to both audiences; the model-policy table is jurisdiction-driven, not firm-driven. | Config path; strip the matter-context block at top; remove "(a) law firm" deployment context option, keep (b) in-house and adapt (c)/(d); output path → `~/Documents/Oscar/AI Governance/Policy Memos/`; rebrand invocations. |
| reg-gap-analysis | keep | Generic regulatory diff; no firm branches. | Config path; output path → `~/Documents/Oscar/AI Governance/Gap Analyses/`; rebrand invocations. |
| use-case-triage | keep | Generic triage workflow; no firm branches. | Config path; strip matter-context block; rebrand invocations; output path → `~/Documents/Oscar/AI Governance/AI Inventories/` for registry suggestions. |
| vendor-ai-review | keep | Generic vendor review; no firm branches. | Config path; strip matter-context block; output path → `~/Documents/Oscar/AI Governance/Vendor AI Reviews/`; rebrand invocations. |

## Agent files

None (no `agents/` directory in source plugin). Inert until Sprint 12 Forge.

## CLAUDE.md (per-plugin practice profile template)

Superseded by unified `~/.config/oscar/profile.json` per ADR-031. The plugin's CLAUDE.md is a per-plugin practice-profile template — Oscar GC carries one unified profile across all practice areas. Orchestrator drops this file after the manifest pass; the AI-Governance-specific sections (use case registry, AI policy commitments, vendor AI governance positions, AI system inventory) get folded into the unified profile schema under the `ai-governance` namespace. The references/currency-watch.md file should travel with the plugin (load-bearing for `## Currency watch` reads).

## Cold-start interview extraction

Two priority-1 questions extracted, both speaking peer-to-peer with in-house AI governance counsel: one captures the AI footprint (build/deploy/consume + EU nexus) — the load-bearing question the source interview calls "the single most important context"; the other captures use-case red lines, which the source identifies as driving the entire triage system. Dropped from priority-1: the practice-setting branch (Oscar GC is in-house by construction), the integrations probe (Oscar handles at platform level), the seed-doc upload (better handled post-onboarding when a real matter triggers it), and the regulatory footprint question (better derived from operating jurisdictions captured at company-profile level, not re-asked per plugin).

## Output Types proposed for this plugin

Per ADR-034 `~/Documents/Oscar/AI Governance/<Type>/`:
- AI Inventories (per-system register exports)
- Impact Assessments (AIA outputs from aia-generation)
- Policy Memos (policy-starter drafts, policy-monitor sweep reports, direct-query results)
- Vendor AI Reviews (vendor-ai-review outputs)
- Gap Analyses (reg-gap-analysis outputs)
- Use Case Triage (triage results — borderline between own type and Impact Assessments; orchestrator decides)

## Borderline / open questions for orchestrator

- **Use Case Triage as its own Output Type vs. folded under Impact Assessments**: triage is upstream of AIA in the source workflow and produces standalone artifacts. Recommend its own folder, but defer to orchestrator's cross-plugin Output Type harmonisation.
- **AI system inventory storage**: source plugin stores `ai-systems.yaml` next to CLAUDE.md (config-adjacent). Under Oscar's unified profile, this becomes a structured field in `~/.config/oscar/profile.json` or a sibling file. Flag for memory-MCP scoping decision.
- **Provisional-mode** appears in use-case-triage and vendor-ai-review (run with generic defaults if profile missing). Oscar GC guarantees a populated profile at first launch, so provisional branches are dead code — recommend stripping in step (e), but flag because it's a pattern likely repeated across plugins.
- **policy-starter's "law firm" option** in deployment-context selector should be removed wholesale (not just stripped) since Oscar GC's audience is in-house. Surface for orchestrator's awareness of where firm-context UI selectors hide inside otherwise-neutral skills.
