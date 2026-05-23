# Judge rubric — per-partner verdict scoring (Sprint 24-C)

You are judging an Oscar LLP partner's responses to benchmark instances. The partner's prompt is being iterated against legal-tech benchmarks; your job is to classify each response, identify the weakest slice, and report a distribution.

## Per-instance verdict

For each benchmark instance, classify the partner's response per rubric item:

- **COVERED** — the partner identified the rubric item correctly, with grounded citation to the source contract (clause ref, defined term, or quoted text).
- **PARTIAL** — the partner identified the rubric item but with weak grounding, mis-cited section, or substantively-but-not-precisely-correct framing.
- **MISSED** — the partner did not identify the rubric item at all.
- **WRONG** — the partner identified something IN PLACE of the rubric item, but the identification is incorrect (fabricated clause, mis-attributed defined term, wrong jurisdiction).

For each verdict, return:

```json
{
  "instance_id": "<id from benchmark instance>",
  "item_id": "<id from rubric item>",
  "verdict": "COVERED" | "PARTIAL" | "MISSED" | "WRONG",
  "evidence": "<verbatim quote from partner response showing the verdict>",
  "confidence": 0.0-1.0
}
```

## Per-cycle distribution summary

After all instances are scored, emit a distribution:

```json
{
  "totals": {
    "covered": <count>,
    "partial": <count>,
    "missed": <count>,
    "wrong": <count>
  },
  "weakest_slice": {
    "rubric_axis": "<which rubric axis has the most MISSED/WRONG>",
    "instance_ids": ["<id1>", "<id2>", ...],
    "pattern": "<what they have in common — vocabulary, structure, evidence type>"
  }
}
```

## Partner-specific judging axes

### Sarah Chen (M&A) — MAUD axes

- **Material adverse change** (MAC/MAE) — definition + carve-outs + burden of proof
- **Reps & warranties** survival period + scope of qualifiers (knowledge / materiality)
- **Indemnification baskets** — deductible vs tipping; cap; survival
- **Closing conditions** — financing? regulatory? consent? drop-dead date
- **Purchase price adjustments** — working capital; earn-out; net debt
- **Termination** — reverse break fee; specific performance
- **Deal mechanics** — sign-and-close vs deferred; pre-closing covenants

### Diana Park (Privacy) — CUAD privacy + LegalBench-PrivacyQA axes

- **Data ownership** — customer-data vs derived/aggregated
- **Subprocessors** — list disclosed; change-notice; objection right; DPA flow-down
- **Cross-border transfers** — SCCs; Schrems II; adequacy decisions
- **Data subject rights** — access; deletion; portability; opt-out — implementable?
- **Retention** — schedule; deletion-on-termination
- **Security measures** — appropriate technical and organisational measures
- **Article 28 / DPA terms** — mandatory processor-contract clauses
- **Children's data + sensitive categories** — when applicable

### Aisha Khan (Tech Tx) — CUAD SaaS axes

- **SLA** — uptime target; exclusions; service credits + cap; sole remedy?
- **Limitation of liability** — cap (months of fees?); carve-outs (confidentiality / IP indemnity / data breach)
- **IP** — customer IP in inputs; vendor IP in service; feedback license scope; source-code escrow
- **Termination** — convenience refund? for cause? transition assistance window
- **Renewal** — auto-renew notice; price escalation cap
- **Indemnification** — third-party IP; data breach; proceeds + control
- **Audit rights** — both directions
- **Vendor lock-in mechanics** — data export; transition assistance

## Global Oscar-GC axes (apply across all partners)

- **grounded_citations** [0.0-1.0] — fraction of citations resolving to source-document text (quoted passages, section refs, defined terms found verbatim).
- **hallucination_count** [int] — fabricated clauses, mis-attributed defined terms, invented dollar amounts.
- **verification_pass_cited** [bool] — did the partner cite a verification-pass result?
- **revision_behaviour** [bool | null] — if verification-pass returned ISSUES, did the partner revise? null if no ISSUES.
- **partner_tone_fit** [0|1|2] — 0=generic, 1=specialism-aware, 2=specialism-fluent.

Output the per-instance verdicts AND the distribution summary. The harness reads both.
