# Corporate Legal — repackage manifest

Sprint 11 (2026-05-18). Policy: ADR-033. Source: anthropics/claude-for-legal @ 4d55f539.
Oscar GC areas served: corporate (1:1), cosec (weak fit — see notes).

## Skill verdicts

| Skill | Verdict | Cosec alignment | Reasoning | Edits |
|---|---|---|---|---|
| ai-tool-handoff | keep | corp-aligned | Manages Luminance/Kira bulk-extraction handoff for diligence; no firm/in-house branches; assumes in-house diligence context (the AI tool config sits in practice profile). | Replace `~/.claude/plugins/config/claude-for-legal/corporate-legal/CLAUDE.md` references with `~/.config/oscar/profile.json`; rewrite VDR/deal output paths to `~/Documents/Oscar/Corporate/<Output Type>/`. |
| board-minutes | keep | cosec-aligned | Drafts board/committee meeting minutes in house format, calendar-detection, written-consent handoff. Core corporate-secretary work. No firm branches; non-lawyer gate is role-based, not audience-based. | Path replacements as above; "Anthropic"/"Claude"/"claude-for-legal" → "in-house legal skill library" wherever in user narrative. |
| closing-checklist | keep | corp-aligned | Maintains the deal closing checklist; ingests from diligence, schedule builds, deal-team summary; mode 4 = blocking-status output. M&A-only — no cosec hook. | Path replacements; YAML store paths rewritten to `~/Documents/Oscar/Corporate/Closing Checklists/`. |
| cold-start-interview | keep (onboarding — gating-strip policy N/A) | both | The plugin's setup interview. Covers all four upstream modules (M&A / Board & Secretary / Public Company / Entity Management); we extract two priority-1 questions below. ADR-033 explicitly carves onboarding out of gating-strip — this file is read for question extraction only. | No content edits in this sprint — questions extracted, file otherwise left as-is. Future sprint will refactor for Oscar's onboarding-mcp flow. |
| customize | keep | both | One-thing-at-a-time profile editor. Module-agnostic — touches risk posture, escalation, materiality thresholds, consent format, entity table, etc. No branched content. | Path replacements; "company-profile.md" reference rewritten to Oscar's profile path. |
| deal-team-summary | keep | corp-aligned | Tiered diligence brief (board/exec / deal lead / working team). Firmly M&A — "deal lead" framing is buy/sell-side counsel. | Path replacements; output path → `~/Documents/Oscar/Corporate/Diligence Memos/`. |
| diligence-issue-extraction | keep | corp-aligned | The diligence engine — reads VDR docs, applies materiality filter, extracts issues in house memo format, hands off consents to closing checklist. Pure M&A diligence. No branches. | Path replacements; output path → `~/Documents/Oscar/Corporate/Diligence Memos/`. |
| entity-compliance | keep | cosec-aligned | Subsidiary compliance tracker: annual reports, franchise taxes, SOIs, foreign qualification. Classic entity-management / corporate-secretary territory. Delaware entity-type discipline is the signal. | Path replacements; tracker path → `~/Documents/Oscar/Corporate/Entity Compliance Reports/`. |
| integration-management | keep | corp-aligned | Post-closing integration tracker — phased workplan, required-consents follow-up, contract assignment at scale. Tightly coupled to M&A pipeline. | Path replacements; tracker path → `~/Documents/Oscar/Corporate/Closing Checklists/`. |
| material-contract-schedule | keep | corp-aligned | Builds the Material Contracts disclosure schedule from diligence findings, applying the PA's Material Contract definition. M&A artifact. | Path replacements; output path → `~/Documents/Oscar/Corporate/Material Contract Schedules/`. |
| matter-workspace | keep-borderline | both | Per-matter context isolation. Upstream documents this as "off by default for in-house" — the toggle is exactly the kind of "private practice vs. in-house" framing ADR-033 targets, but it's a runtime toggle, not a firm-only section to strip. The skill is still readable as a no-op-when-disabled file for in-house users. Worth orchestrator review: do we keep it as a future enabler if a tenant runs a discrete deal as an isolated workspace, or drop it as conceptually misaligned with the "one company, scoped per element" Oscar model? | If kept: path replacements only; do not strip the matter-machinery sections (they're already gated by the Enabled flag). If dropped by orchestrator: source remains under `skills/`, MANIFEST entry preserved for re-vendoring traceability. |
| tabular-review | keep | corp-aligned | Spreadsheet-output review of a document set against a typed column schema. Built for M&A diligence (the references/ subdir has `ma-diligence-columns.md`), but usable for any batch review. | Path replacements; output path → `~/Documents/Oscar/Corporate/Diligence Memos/`. Keep `references/` subdir; rewrite any path examples there. |
| written-consent | keep | cosec-aligned | Unanimous written consent drafting with precedent search from a consents repository. Same-day-major-action hard stop and no-precedent hard stop are load-bearing. Core corporate-secretary skill (and the M&A overlap is where consents authorise the deal). | Path replacements; output path → `~/Documents/Oscar/Corporate/Written Consents/`; preserve scope warnings verbatim. |

## Agent files

| File | One-line purpose |
|---|---|
| agents/dataroom-watcher.md | Scheduled agent that polls the VDR for new uploads, maps them to request-list categories, posts a Slack briefing on cadence; runs closing-checklist Mode 4 on briefing day. |

## CLAUDE.md

The plugin-level CLAUDE.md is a comprehensive practice-profile template plus shared guardrails (work-product header by role, source-attribution tag vocabulary, dashboard offer, retrieved-content trust, jurisdiction recognition, large-input/output discipline). It is the canonical statement of plugin behavior — keep, apply invocation-reference fixes (replace upstream config/cache paths with `~/.config/oscar/profile.json`, replace upstream output paths with Oscar's `~/Documents/Oscar/Corporate/<Output Type>/` convention). No gating-strip applies — no firm/in-house branch markers were found; the practice-setting question in cold-start handles audience by selecting "In-house" rather than by branched content. The `## Matter workspaces` section ships defaulted to disabled for in-house users — that defaulting is the right Oscar behavior and the section can stay as documentation of the toggle.

## CoSec fit assessment

ADR-031's "weak cosec fit" call is borne out by reading the bundle. Three skills are unambiguously cosec-aligned (board-minutes, written-consent, entity-compliance) and one onboarding module (Board & Secretary) is directly cosec-shaped — but the rest of the plugin (diligence-issue-extraction, closing-checklist, material-contract-schedule, deal-team-summary, integration-management, tabular-review, ai-tool-handoff) is firmly M&A/transactional corporate work, not corporate-secretary work. There is no skill for: routine secretarial duties (share register maintenance, statutory book updates, beneficial-ownership filings, director-appointment letters), AGM/EGM preparation distinct from board-minutes, regulatory officer filings (e.g., PSC/UBO registers), or share-issuance documentation. A cosec-only user would activate only the Board & Secretary and Entity Management modules and have roughly half the bundle's surface area lit up — usable but thin. Sprint 11 dogfood with a cosec-leaning tenant will likely surface gaps around statutory registers, AGM preparation, and jurisdiction-specific officer filings (the bundle is US-default with jurisdiction-recognition guardrails but no UK Companies House / EU equivalent equivalents wired in). Orchestrator should expect the cosec gap to become a Sprint 12+ candidate for either a dedicated cosec plugin or a cosec-specific extension within corporate-legal.

## Cold-start interview extraction

The cold-start covers four modules (M&A / Board & Secretary / Public Company / Entity Management) plus practice-setting (in-house is one option among solo/firm/government). We extracted two priority-1 questions that together establish whether corporate or cosec sensibilities dominate this tenant: one captures the entity portfolio (cosec/entity-management signal), the other captures the active workstreams (corporate vs. cosec signal via module mix). Both feed Oscar's per-element memory (entity portfolio is a corporate-element scope) and the practice-area UI scoping decision the orchestrator makes later.

## Output Types proposed for this plugin

Per ADR-031 / ADR-034:
- Board Minutes (cosec)
- Diligence Memos (corporate)
- Closing Checklists (corporate)
- Material Contract Schedules (corporate)
- Written Consents (cosec)
- Entity Compliance Reports (cosec)

All written to `~/Documents/Oscar/Corporate/<Output Type>/` (the practice area is "Corporate" in the Oscar UI; cosec-aligned outputs remain under Corporate until/unless a dedicated cosec practice area is stood up).

## Borderline / open questions for orchestrator

1. **matter-workspace** — kept as borderline. In-house defaults to disabled, so it's a no-op in the field, but the skill's "private practice" framing is exactly the kind of audience-coded scaffolding ADR-033 targets at the gating-strip level. Decide whether to keep it as a latent feature (for tenants who want per-deal isolation as a workspace concept) or drop it as conceptually misaligned with Oscar's one-tenant model.
2. **cosec gap** — no dedicated cosec plugin in the vendored bundle; the three cosec-aligned skills here are the only coverage. Orchestrator should flag whether Sprint 12 needs to commission a cosec-specific extension or stand up a separate plugin.
3. **Public Company module is documented but its skills are not in the bundle** ("coming in next release" per upstream README). Cold-start still asks Public Company questions. We should either suppress those onboarding questions in Oscar (no skills to power the answers) or note the gap so a future plugin lights up when added.
4. **Practice-setting question in cold-start defaults to a multi-choice selector** that includes solo/firm/government — Oscar is in-house-only by definition. The orchestrator's onboarding-mcp should hard-code in-house rather than asking; the upstream cold-start question goes away.
