# ADR-055 — Re-sequenced intake: practice scope before regulatory hypothesis

Status: accepted
Date: 2026-05-19
Sprint: 16

## Context

Sprint 15 Crostini dogfood (commit `c2aa7c532`, P8) exposed a structural bug in ADR-050's intake sequence. The current rule-set fires the regulatory hypothesis at P2.5c, **before** P3 (practice scope). Without practice-area context, MiniMax defaults to its most-trained-on EU regs — the privacy stack (GDPR / UK GDPR / Irish DPA / BDSG / DSA). Arturs's industrial-cable-distribution dogfood (UK+IE+DE+FR) missed REACH, WEEE, RoHS, UKCA, Modern Slavery, Late Payment.

Arturs's verbatim direction: *"The logic is backwards, company profile, practice areas => search for regulations based on jurisdictions and profiles — think this through logically."*

Sprint 15 iter-2 already proved no prompt tweak alone fixes this — coverage went 4.83 → 4.50 while downstream-briefing only crept 2.58 → 2.92 (still FAIL at the ≥4.0 gate). The fix is a sequencing rewrite, not another iteration knob.

## Decision

Re-sequence the intake to **P1–P9**, with practice scope captured *before* the regulatory hypothesis fires. The hypothesis now runs with `industry × geography × practice_areas[]` in scope; the Tavily query template incorporates practice-area scope.

New sequence (replaces ADR-050's P1 / P2.5a-e / P3 / P3.5 / P3.99 / P4):

- **P1** Identity
- **P2** Industry depth (sector + sub-sector + business model + size-band)
- **P3** Geography (HQ + operating jurisdictions)
- **P4** Practice scope (the 13 default areas + drop/add/custom)
- **P5** Regulatory hypothesis (scoped; Tavily fires here)
- **P6** Recurring matters + stakeholders
- **P7** Risk appetite
- **P8** Per-area drilldown (skip-when-covered against the now-populated `regulatory_baseline`)
- **P9** Open notes + finalize

New Tavily query template (substituted at agent inference time, not recipe-build):
```
regulatory frameworks for a {industry_summary} operating in {jurisdictions} covering {practice_scope} 2026
```
- `{industry_summary}` = `sub_sector` || `sector`
- `{jurisdictions}` = `operating_jurisdictions[].join(' + ')`, capped at 4
- `{practice_scope}` = selected practice-area display names (incl. user-added), deduped, capped at 5

`search_depth: "basic"`, `max_results: 5`, one call per intake — unchanged.

**Data-protection-always guardrail** in P5: even when Privacy is dropped from practice scope, the agent cites UK GDPR / GDPR for any EU/UK operator processing personal data. *"Data protection regulation hits every company that processes personal data, not just companies with a dedicated Privacy practice area."*

Schema v3 (ADR-051) is unchanged. The `company_context` object fills progressively across phases; `finalize_profile` still consumes one composite object.

Carries bundled into the systemPrompt.ts rewrite (load-bearing-overlap):
- **Carry 1 (visible Tavily provenance):** P5 recap line suffixed with `(from web + my knowledge)` or `(from my knowledge)` derived from `captured_via` — schema already distinguishes these.
- **Carry 2 (recap copula bug):** P9 recap states `reports_to` as the field once, not as a copula.

## Rationale

- **Practice areas constrain regulatory hypothesis** — without scope, the LLM's training-time bias toward EU privacy regs dominates. Sprint 15 iter-1 Daniel-Okafor regulatory_baseline missed REACH/WEEE/RoHS/UKCA/Modern Slavery/Late Payment — the regs that actually matter for cable distribution.
- **Query template change is structural** — Tavily ranks snippets by query keywords; adding `covering {practice_scope}` shifts ranking toward industry-specific regs vs the generic top-of-search privacy stack.
- **Skip-when-covered now works correctly.** P8 (formerly P3.5) skip rules key on `regulatory_baseline.frameworks[]` presence; under the old sequence those were populated *after* the area-drilldown queries fired. The new order makes ADR-050 rule 6 finally fire as designed.
- **Inference-time substitution, not recipe-build.** Practice scope isn't known until P4 — too late for `company_context` injection at recipe-build time (ADR-053). The agent fills the template in its own turn.

## Consequences

- `systemPrompt.ts` rewrites under the new P1–P9 numbering. The Sprint 15 prompt's operating rules (budget, signal density, batching, hard stops) carry forward; rule 4 (one Tavily call) is unchanged. Rules 6 (skip-when-covered) and 8 (state-tracking) re-number to reference the new phase IDs.
- Eval rubric needs a parallel rework (ADR-056) — Sprint 15's coverage axis counted framework presence and missed industry-fit failures.
- ADR-052's Tavily query template reference becomes stale; ADR-052's amendment ADR (ADR-057) will note the new template.
- Per-area drilldown depth unchanged from ADR-050 (hard cap 1 question per area).

## Supersedes

Amends ADR-050 (intake rule-set: new sequence + new Tavily query template + data-protection-always guardrail). Per ADR rules, ADR-050's text is unchanged; this ADR is the new decision-of-record for the sequence.
