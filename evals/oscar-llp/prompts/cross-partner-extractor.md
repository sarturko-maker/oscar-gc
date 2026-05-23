# Phase 2 — Cross-partner pattern extraction (Sprint 24-C)

You have just observed three partners (Sarah Chen / M&A; Diana Park / Privacy; Aisha Khan / Tech Tx) undergo 3-4 iteration cycles each. For each partner, you saw:

- The iter-0 baseline prompt
- 20 transcripts per cycle, judged COVERED / PARTIAL / MISSED / WRONG
- The cycle's distribution summary and lowest-performing slice
- The subtractive removals proposed (with unified diffs)
- iter-k prompts after each removal

Your task: identify recurring failure-mode → fix patterns that appeared in **≥2 of the 3 partners**.

## What you ARE looking for

**Methodological patterns** — the *kind* of removal, not the specific words:

- "Partners over-cite when the prompt enumerates a long Framework section — removing items 4-7 of the Framework consistently raised recall."
- "When the verification-gate language requires verbatim quoting before delivery, grounded_citations drops because the partner constructs the quote earlier and loses thread on substantive citations."
- "Over-long preambles before the analysis section cause the partner to deliver the preamble instead of the analysis."

These patterns generalise across legal specialisms (the partner-prompt structure problem is partner-invariant).

## What you are NOT looking for

**Partner-specific findings**:

- "Sarah missed indemnification baskets on instance #4." (Sarah-only, not transferable.)
- "Diana confused CCPA and GDPR opt-out semantics." (Diana-only.)
- "Aisha missed source-code escrow as an option." (Aisha-only.)

These are partner-specific defects; they belong in per-partner follow-up, not in cross-partner extraction.

## Output schema

```json
{
  "patterns": [
    {
      "id": "P1",
      "name": "<short pattern name>",
      "partners_observed": ["sarah-chen", "diana-park"],
      "failure_mode_evidence": [
        {"partner": "sarah-chen", "iter": 1, "instance_ids": ["maud-12", "maud-19"], "quote_or_summary": "..."},
        {"partner": "diana-park", "iter": 2, "instance_ids": ["cuad-priv-7"], "quote_or_summary": "..."}
      ],
      "fix_evidence": [
        {"partner": "sarah-chen", "iter": 1, "removal": {"start": 1234, "end": 1287}, "effect": "recall +12pp on next cycle"},
        {"partner": "diana-park", "iter": 2, "removal": {"start": 1198, "end": 1245}, "effect": "grounded_citations +0.15"}
      ],
      "transferability": {
        "marcus-webb": "high|medium|low",
        "daniel-reeves": "high|medium|low",
        "priya-patel": "high|medium|low",
        "james-okafor": "high|medium|low",
        "helena-voss": "high|medium|low",
        "robert-sinclair": "high|medium|low",
        "thomas-schmidt": "high|medium|low"
      },
      "proposed_subtractive_fix": {
        "applies_to": "verificationGateBlock" | "<partner-specific-file>" | "all-10-partners",
        "removal_summary": "<one paragraph describing what to cut and why>"
      }
    }
  ],
  "negative_finding": null
}
```

If you find fewer than 2 cross-partner patterns, output:

```json
{
  "patterns": [],
  "negative_finding": {
    "explanation": "<what you observed across the 3 partners>",
    "what_was_tried": "<which subtractive directions failed to generalise>",
    "speculation": "<honest assessment — are patterns partner-specific by nature, or did 3 cycles fail to surface common patterns?>"
  }
}
```

**Negative results are valid Sprint 24-C deliverables.** If subtractive iteration doesn't surface cross-partner patterns after 3 cycles × 3 partners, that's substantive methodology evidence — document it; do not invent patterns to fill the slot.

## Phase 2 framing constraint

Patterns rated `transferability: high` for the 7 non-trio partners are more likely to be methodologically real. Patterns rated `transferability: low` are benchmark-overfit (specific to MAUD/CUAD/LegalBench artefact-shape rather than the partner-prompt-structure problem). Use transferability as your honesty signal — high-transferability patterns are the substantive Sprint 24-C output; low-transferability patterns are interesting but partner-specific.

The closing report cites Phase 2's `proposed_subtractive_fix` patterns rated `transferability: high` for adoption into `verificationGateBlock.ts` (per the Hybrid 2 architecture in ADR-081). Low-transferability patterns go into per-partner follow-up tickets for Sprint 25+.
