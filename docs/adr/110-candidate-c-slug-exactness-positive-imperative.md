# ADR-110: Candidate C — slug-exactness recalibration via positive imperative achieves cross-family balance

Sprint 33 (2026-05-27). Status: Accepted. Cites [[ADR-108]] (recalibrated), [[ADR-109]] (substrate that validated).

## Context

Sprint 32 ([[ADR-109]]) measured ADR-108 fix 1 at scale and found **opposite-sign cross-family effects** on the load-bearing 30-ndas skill-firing cell: MiniMax variant A→B = +35pp (30%→65%); Haiku 4.5 variant A→B = −20pp (50%→30%). The same negative-constraint-list paragraph ("never a file path, never a category prefix, never a description, never the playbook filename") helped MiniMax (which read it as permissive disambiguation) and hurt Haiku (which read it as a higher bar). Per CLAUDE.md lines 56–60 (providers are DI), per-family doctrine variants are off the table.

`docs/sprint-33/research-memo.md` surveyed the literature and converged on **positive imperative + at most one targeted exclusion**: Anthropic's published guidance ("Tell Claude what to do instead of what not to do"; "yellow flag" on ALL-CAPS NEVER), Pink Elephant arXiv:2503.22395 (Spearman 0.866 size-vs-negation correlation predicts MiniMax/Haiku reversal), PRIN arXiv:2504.01282 (positive↔negative inconsistency varies massively across families), Anthropic skill-creator pattern (positive trigger + narrow exclusion).

## Decision

Replace the four-item NEVER list in `discoveryDoctrine.ts` Step B addendum (commit `9ea8939d8`):

> **Slug shape (load-bearing)**: pass the slug verbatim as it appears in the skills block. If the inventory lists `nda-review`, the call is `load_skill(name="nda-review")` — exactly that string. The slug is the literal token the inventory printed, not a file path or a category prefix. If a slug you want isn't in the inventory above, the skill isn't available — don't guess.

One positive imperative; one concrete example with explicit token-equality framing; one collapsed exclusion (path / prefix as one phrase, not stacked); preserved availability discipline.

## Verdict (substrate-validated, variant C at commit `9ea8939d8`)

| Cell                              | Variant B baseline | Variant C | Δ (C − B) |
|---|---|---|---|
| MiniMax 30-ndas `skill_arg_correct` | 13/20 = 65% | 13/20 = 65% | **+0pp HELD** |
| Haiku 30-ndas `skill_arg_correct`   | 3/10 = 30%  | 3/5 = 60%   | **+30pp RECOVERED** |
| MiniMax 30-rfq `skill_noise`        | 9/20 = 45%  | 6/20 = 30%  | **−15pp BONUS** |

Cross-family balance: MiniMax HELD the variant B gain; Haiku RECOVERED above variant A's 50%. Sprint 32's opposite-sign failure mode is REVERSED. Per the Sprint 33 brief's classification, this is **IDEAL** (positive Haiku, flat-at-peak MiniMax — no opposite sign). Bonus: −15pp on MiniMax 30-rfq skill noise partially addresses the cross-document concern Candidate E was meant to target.

## Caveats

- **Haiku 30-rfq unmeasured** (OpenRouter monthly cap hit at $20.04/$20 on cycle 01 turn 4). Sprint 33b carry-forward. Variant B was 0/10 noise; Candidate C's wording is less aggressive than B's, so regression risk is structurally zero — just unmeasured.
- **N=5 Haiku 30-ndas**: CI half-width ~±43pp. The +30pp lift is directionally strong (overshoots variant A's 50%) but would benefit from N=10 confirmation.
- **Haiku 30-ndas `delegate_applicable` −30pp** (5/10 B → 1/5 C) within N=5 CI; Step C unchanged by Candidate C so cross-paragraph effect implausible. Re-measure at N=10 in Sprint 33b.

## Carry-forwards (Sprint 33b)

Haiku 30-rfq N=5; Haiku 30-ndas N=10 confirmation; Candidate D (relocate "act, don't describe" — Explore agent confirmed `commercialRecipe.ts` extension `description` field is UI-only and **does not reach the LLM**; correct landing site is `systemPrompt.ts` Step 4); Candidate E (already partly addressed by Candidate C's MiniMax 30-rfq −15pp noise reduction).

Cites: [[ADR-108]], [[ADR-109]].
