# Canonical Output Types — orchestrator harmonisation

Sprint 11 (2026-05-18). Per ADR-034 output-path convention.

Skill-generated work product lands at:

```
~/Documents/Oscar/<Practice Area Name>/<Output Type>/<file>
```

`<Practice Area Name>` is the Title Case sidebar label
(`PRACTICE_AREAS[i].name` in `ui/desktop/src/components/oscar/practiceAreas.ts`).
`<Output Type>` is the Title Case plural enumerated below.

When the same Output Type appears in multiple practice areas, the path
differentiates by area (e.g. "Gap Analyses" exist for Privacy, Regulatory,
AI Governance — each lives under its own area folder).

Disputes-spine skills (sourced from litigation-legal) write under the active
disputes practice area (Commercial Disputes / Employment Disputes / IP Disputes
/ Regulatory Disputes), not under a "Litigation" parent.

## Per-area canonical Output Types

### Commercial / Commercial Disputes
- Redlines (vendor-agreement-review, saas-msa-review)
- NDA Reviews (nda-review)
- MSA Reviews (vendor-agreement-review, saas-msa-review)
- Renewal Trackers (renewal-tracker; persistent register)
- Escalation Memos (escalation-flagger)
- Stakeholder Summaries (stakeholder-summary)
- Amendment Histories (amendment-history)

### Corporate / CoSec
Both areas read from corporate-legal until/unless a dedicated cosec plugin
lands. cosec-aligned outputs route to the active area's folder.
- Board Minutes (board-minutes — cosec-aligned)
- Diligence Memos (diligence-issue-extraction, deal-team-summary)
- Closing Checklists (closing-checklist)
- Material Contract Schedules (material-contract-schedule)
- Written Consents (written-consent — cosec-aligned)
- Entity Compliance Reports (entity-compliance — cosec-aligned)
- Tabular Reviews (tabular-review — diligence rollups)

### Employment / Employment Disputes
- Investigation Memos (investigation-* skills; disputes area)
- Hiring Reviews (hiring-review)
- Termination Reviews (termination-review)
- Handbook Updates (handbook-updates)
- Policy Drafts (policy-drafting)
- Wage-Hour Memos (wage-hour-qa)
- Leave Logs (leave-tracker, log-leave; persistent register)
- Worker Classification Memos (worker-classification)
- Expansion Trackers (expansion-kickoff, expansion-update; per-country)

### IP / IP Disputes
- FTO Opinions (fto-triage)
- Clearance Memos (clearance)
- Cease-Desist Letters (cease-desist; outbound)
- Invention Disclosures (invention-intake)
- OSS Reviews (oss-review)
- Portfolio Reports (portfolio; ip-renewal-watcher agent)
- Infringement Triage Memos (infringement-triage)
- IP Clause Reviews (ip-clause-review)
- Takedown Notices (takedown; DMCA outbound + counter-notice)

### Disputes-spine (litigation-legal; writes under active disputes area)
- Demand Letters (demand-draft; demand-intake pre-step)
- Brief Sections (brief-section-drafter) — borderline; outside-counsel-leaning
- Claim Charts (claim-chart)
- Chronologies (chronology)
- Deposition Prep Memos (deposition-prep) — borderline; outside-counsel-leaning
- Legal Hold Notices (legal-hold)
- Privilege Log Reviews (privilege-log-review)
- Matter Status Reports (matter-briefing, matter-update)
- OC Status Reports (oc-status; weekly portfolio sweep)
- Portfolio Status Reports (portfolio-status)
- Inbound Triage Memos (demand-received, subpoena-triage)

### Privacy
- DPAs (dpa-review)
- DSAR Responses (dsar-response)
- PIA Reports (pia-generation)
- Policy Monitors (privacy-legal__policy-monitor — renamed; see COLLISIONS.md)
- Gap Analyses (privacy-legal__reg-gap-analysis — renamed)
- Use-Case Triage Memos (privacy-legal__use-case-triage — renamed)

### Product
- Launch Reviews (launch-review)
- Marketing Claims Reviews (marketing-claims-review)
- Feature Risk Assessments (feature-risk-assessment)
- Issue Triage Memos (is-this-a-problem)

### Regulatory / Regulatory Disputes
- Comment Drafts (comments — NPRM responses)
- Gap Analyses (gaps, policy-diff)
- Policy Diffs (policy-diff)
- Reg Feed Monitors (reg-feed-watcher; reg-change-monitor agent)
- Policy Redrafts (policy-redraft)
- Gap Surfacing Memos (gap-surfacer)

### AI Governance
- AI Inventories (ai-inventory; per-system register exports)
- Impact Assessments (aia-generation)
- Policy Memos (policy-starter; ai-governance-legal__policy-monitor — renamed)
- Vendor AI Reviews (vendor-ai-review)
- Gap Analyses (ai-governance-legal__reg-gap-analysis — renamed)
- Use-Case Triage Memos (ai-governance-legal__use-case-triage — renamed)

## Cross-cutting notes

- **State files** (e.g. `renewal-register.yaml`, `gap-tracker.yaml`,
  `leave-register.yaml`, `comment-tracker.yaml`) are kept under
  `~/.config/oscar/state/<plugin>/` (per the ADR-033 invocation-reference
  pass). Output Types listed above describe lawyer-facing deliverables
  under `~/Documents/`, not the agent's persistent state.
- **Disputes-area routing.** Skills shared between a substantive area and
  its disputes counterpart (e.g. commercial + commercial-disputes; ip +
  ip-disputes) route to the active practice area's folder. The active
  area context is provided by the recipe at runtime (Sprint 11 wires this
  via the recipe system prompt; Sprint 12 Matters layer formalises it).
- **Borderline Output Types** flagged for Sprint 11 dogfood: Brief Sections
  and Deposition Prep Memos are outside-counsel-leaning. Kept by default;
  dogfood validates whether the in-house lawyer actually invokes them.
