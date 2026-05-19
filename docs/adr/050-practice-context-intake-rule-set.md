# ADR-050 — Practice-context intake rule-set

Status: accepted
Date: 2026-05-19
Sprint: 15

## Context

Sprint 14 dogfood (commit `c034b4e2f`) confirmed the existing onboarding agent (Sprint 6 unified + Sprint 11 P3.5 per-area mini-interview) captures identity + corporate-fields + practice-area selection + ≤2 area-specific questions. Arturs's verbatim feedback: *"The initial set up looks good, but it is fairly thin. Questions don't go deep enough to understand the client, its issues, industries and jurisdictions."* Five company-level dimensions are absent: jurisdictions, regulatory baseline, recurring matter shapes, stakeholder/escalation context, open notes. Downstream practice-area agents therefore lack the context to give a *briefed first response* — they must re-ask basics every session.

## Decision

Replace the existing P2 (industry + size-band) with a richer **P2.5 — Company context block**. Modify P3.5's per-area drilldown to skip questions already covered at company level (hard cap reduced 2 → 1 per area). The intake agent operates by **goal + rules**, not script.

Goal: produce a `company_context` object (ADR-051) such that practice-area agents are briefed at turn 1.

Rules (full prose in `ui/desktop/src/components/oscar/onboarding/systemPrompt.ts`):

1. **Budget** — ≤5 min wall-time, ~14 visible turns. Drop drilldown depth before dropping any required field.
2. **Signal density** → branch (dense = capture & move; sparse = drill once; off-topic = redirect).
3. **Batch aggressively** — name+role+company; industry+sub-sector+business-model; HQ+ops jurisdictions; reports-to+escalation-threshold.
4. **Hypothesis-confirm via Tavily** (compression primitive). After industry + ≥1 jurisdiction captured, form a 4–8 item regulatory hypothesis from `tavily-search` + LLM knowledge; surface for confirm/correct. Capture provenance: `user-confirmed | tavily+user-confirmed | llm-hypothesis-only`. Silent fallback if Tavily absent/fails.
5. **Always-open final question** (mandatory): *"Anything else I should know before I hand you off to the practice-area agents — biggest legal challenge right now, a recent change in the business, or anything specific I haven't asked about?"* → `open_notes`.
6. **P3.5 skip-when-covered** — concrete skip table in systemPrompt.ts; hard cap 1 question per area.
7. **Hard stops preserved** (ADR-010): no invent, no re-ask, no narration, no feature-prop.
8. **State-tracking** — agent self-tracks filled vs null fields; P2.5 closes only when all required fields are at least probed once.

## Rationale

- **Goal+rules over script.** Lawyers reject 30-question form-fills. Rules let the agent compress when info is dense and drill when sparse — matches in-house lawyer interview style ([BarkerGilmore](https://barkergilmore.com/blog/why_you_need_a_legal_department_assessment/), [LSC needs-assessment](https://www.lsc.gov/i-am-grantee/model-practices-innovations/plan-strategically/comprehensive-needs-assessment-priority-setting)).
- **Company-level baseline is foundational for in-house.** Per-area drilldown without it forces every area agent to re-ask jurisdiction/regulatory basics. CLOC Core 12 + ACC Maturity Model frame the in-house function as a competency grid, not matter-shaped — the intake captures grid position.
- **Tavily hypothesis-confirm beats enumeration.** A 4-line agent turn ("I'd expect GDPR, DSA, AI Act…") gets confirm/correct in one beat; an enumeration approach is 10+ turns. Web-search currency grounds MiniMax's training-time regulatory knowledge against 2026 reality (per Arturs: *"high level just pulling regulatory frameworks to update model training"*).
- **Always-open final question** surfaces upcoming projects + heightened risk that fixed questions miss — directly drawn from in-house legal-ops needs-assessment practice.
- **Budget discipline is load-bearing.** "5 minutes tops" was the user's hard constraint. Drop drilldown depth, never required fields.

## Consequences

- `systemPrompt.ts` becomes more load-bearing; treated as code (PR-reviewed, ADR-pinned for structural changes).
- Schema v3 follows (ADR-051) to receive the new fields.
- Tavily wiring (ADR-052) becomes load-bearing — but with graceful absence path (rule 4 fallback).
- Recipe-time `company_context` injection (ADR-053) is the load-bearing wire from intake → practice-area agents. Without it, none of this work matters.
- Eval discipline (ADR-054) is the ship gate: 6 personas × 3 axes × iteration loop until pass.
- P3.5 mini-interview total length drops from ~25 turns worst-case to ~3–7 turns typical (high skip-rate).

## Supersedes

None. Extends ADR-010 (system-prompt structure) and ADR-032 (P3.5 + schema v2).
