# Eval Rubric — Lavern JV (adapted for Oscar GC partner consultation)

**Adapted from** Lavern's `RUBRIC.md` at upstream commit
`7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd` (Apache License, Version 2.0).
The verbatim original is preserved at `RUBRIC.lavern-original.md`. The
adaptation policy is captured in [ADR-077](../../docs/adr/077-sprint23-lavern-eval-baseline.md).

**What stays vs. what changes vs. what is added:**

| Element | Status in adapted rubric |
|---|---|
| Per-doc risk items (29 total — Doc 1: 12, Doc 2: 10, Doc 3: 7) | **Verbatim** from Lavern. Substantive content of the rubric. |
| Recall / Precision / Hallucination definitions | **Rescoped** from "Reader's findings" to "partner findings". |
| Watchman accuracy axis | **Dropped.** Oscar GC has no Watchman; partner is invoked directly. |
| Per-doc "Expected Watchman" subsections | **Dropped.** Lavern-pipeline-specific. |
| "Expected reader template" | **Dropped.** Lavern-pipeline-specific. |
| "What I'm specifically watching for" section (precedent-board compounding, JV-vocabulary firing, etc.) | **Dropped.** All Lavern-pipeline-specific. |
| 4 Oscar-GC global axes (grounded citations, verification-pass cited, revision behaviour, partner-tone fit) | **Added.** Sprint 23 measurement of Ralph Loop behaviour ([ADR-076](../../docs/adr/076-sprint23-ralph-loop-prompt-borne-gate.md)). |
| Doc 3 `overproduction_flag` | **Added.** Lavern's qualitative note ("a junior would flag every word; a senior would flag 2-3 things") promoted to a measurable axis. |

**Pre-registration discipline preserved.** Lavern's rubric was authored
before its eval ran; Oscar GC adopts the same discipline by treating
this adapted rubric as fixed during the Sprint 23 sweep. Future
revisions live as new files (`RUBRIC.adapted.v2.md`, etc.), not edits.

**Grader bias note (from Lavern's original, applicable here too).** The
same model (MiniMax-M2.5 in Oscar GC's case) is doing both the
running and the grading. Pre-registration of the rubric is the only
bias control available without an independent reviewer. Read with that
in mind.

---

## Scoring

Per (partner × document × config), score:

- **Recall** = % of rubric items the partner's findings cover (any
  defensible match counts).
- **Precision** = % of partner findings that map to a rubric item OR
  are defensible additional concerns.
- **Hallucination count** = findings that reference text not in the doc
  OR invent dollar amounts / clause refs that aren't there.
- **Qualitative** = does the synthesis read like a senior partner
  first-pass, or like a junior trying to sound thorough?

Per (partner × document × config), score four additional Oscar-GC
global axes:

| Axis | Range | Definition |
|---|---|---|
| `grounded_citations` | 0.0 – 1.0 | Fraction of partner's clause/quote citations that resolve to actual passages in the source doc. Default 1.0 if no citations made. |
| `verification_pass_cited` | boolean | Did the partner cite a verification-pass result (PASS or ISSUES + what was checked) in its final response? |
| `revision_behaviour` | boolean \| null | Does the transcript show the partner revising in response to verification-pass ISSUES? null if the partner never invoked verification-pass or it returned PASS. |
| `partner_tone_fit` | 0 \| 1 \| 2 | 0 generic, 1 specialism-aware, 2 specialism-fluent in {M&A, Privacy, Litigation} respectively. |

Doc 3 (Veoneer) only:

| Axis | Range | Definition |
|---|---|---|
| `overproduction_flag` | boolean | true if the partner raised more than 6 distinct risks on Doc 3 (Lavern's rubric notes: "Synthesis should be SHORT because the doc is narrow — overproducing concerns on a wind-down is a sign of generic blather. A junior would flag every word; a senior would flag 2-3 things."). |

---

## Doc 1 — BorrowMoney.com × JVLS (Vaccines2Go) JV Agreement

**File:** `docs/borrowmoneycom_06_11_2020.txt` (21,454 chars, ~67 clauses)
**Type:** Substantive 2-member JV, FL law, IT development + medical services
**What a competent partner should catch (in rough priority order):**

| # | Risk | Severity | Where |
|---|---|---|---|
| 1 | **Joint & several liability for breach-caused harm** — broad, no cap | RED | cl 32-33 |
| 2 | **Unanimous consent for Additional Capital** — creates deadlock risk if one party refuses | major | cl 19 |
| 3 | **Asymmetric capital economics**: no interest on contributions (cl 22), but interest IS payable on Member advances at majority-set rate (cl 20) | major | cl 20 vs 22 |
| 4 | **Confidentiality survives only 1 year** after termination — short for a JV | major | cl 46 |
| 5 | **Force Majeure ridiculously broad** — "any other unforeseen and uncontrollable event" | major | cl 43 |
| 6 | **No Reserved Matters / supermajority list** — only "majority vote of Members" for major issues | major | cl 11 |
| 7 | **Involuntary Withdrawal triggers indemnity by the defaulting Member** — broad, no cap | major | cl 33 |
| 8 | **No dilution formula** for Members who don't fund additional capital | major | implicit |
| 9 | **Mediation rules unspecified** — "statutory rules of mediation" — vague | minor | cl 55-56 |
| 10 | **Severability with judicial reformation** — court may rewrite, not just strike | minor | cl 64 |
| 11 | **Bankruptcy / Operation of Law triggers Involuntary Withdrawal** | minor | cl 34 |
| 12 | **Conflict-of-interest disclosure with majority consent only** | minor | cl 44 |

**Expected qualitative tone:** should reference operator/non-operator dynamics
(but this JV is symmetrical, no operator), capital calls, deadlock,
reserved matters.

---

## Doc 2 — Bravatek × Sibannac Strategic Alliance Agreement

**File:** `docs/sibannac_12_04_2017.txt` (8,380 chars, ~12 clauses)
**Type:** Non-exclusive commission-based sales channel partnership, TX law
**Note:** this is labelled "Strategic Alliance" but is effectively a
commission/referral agreement.

**What a competent partner should catch:**

| # | Risk | Severity | Where |
|---|---|---|---|
| 1 | **Commission unilaterally set by COMPANY in 10-20% range** — Bravatek has no certainty on fee | RED | cl 4 |
| 2 | **NET 30 from CLIENT payment received** — Bravatek bears credit/collection risk | major | cl 4 |
| 3 | **Termination on 90 days notice by either party** — convenience kill switch, no ramp-down protection | major | cl 7 |
| 4 | **Non-exclusive arrangement** — leads not protected, Bravatek can be cut out | major | cl 1 |
| 5 | **No minimum performance / no exclusivity protections either way** | major | implicit |
| 6 | **Mutual indemnification limited to negligence + intentional misconduct + breach** — narrow | minor | cl 10 |
| 7 | **No IP ownership clause** for materials created during cooperation | minor | implicit |
| 8 | **Auto-renewal with 90-day opt-out** — modest dark-pattern risk | minor | cl 7 |
| 9 | **No specification of how leads are tracked / disputed** | minor | implicit |
| 10 | **Texas governing law + no venue clause** — could be ambiguous for non-TX parties | minor | cl 9 |

---

## Doc 3 — Veoneer × Nissin JV Amendment & Termination

**File:** `docs/veoneer_02_21_2020.txt` (8,259 chars, ~6 articles)
**Type:** Wind-down amendment to an existing JV — terminates Veoneer parties'
involvement in two JVs (VNBJ, VNBZ), preserves Autoliv AB's role in ANRA
**Note:** this is a JV-related document but not a fresh JV.

**What a competent partner should catch:**

| # | Risk | Severity | Where |
|---|---|---|---|
| 1 | **No general release of pre-closing claims** — Veoneer parties cease to be parties but liability for pre-closing breach SURVIVES | RED | Article 1.d |
| 2 | **Conditional effectiveness on TWO closings (VNBJ + VNBZ)** — what if only one closes? Document is ambiguous | major | Article 3 |
| 3 | **ANRA wind-down obligations continue indefinitely** for Nissin + Autoliv AB | major | (D), Article 1.c |
| 4 | **D&O indemnification carve-out continues** but only for pre-closing liabilities | minor | Article 1 (last para) |
| 5 | **No governing law in the Amendment itself** — inherits from underlying JV which is not attached | minor | implicit |
| 6 | **Tail liability for representations + warranties + covenants** — pre-closing only, narrow | minor | Article 1.d |
| 7 | **No specified mechanism for resolving disputes about whether a breach was pre- or post-closing** | minor | implicit |

**Expected qualitative tone:** should flag survival of pre-closing liability
as the single biggest risk. Synthesis should be SHORT because the doc is
narrow — overproducing concerns on a wind-down is a sign of generic blather.
A junior would flag every word; a senior would flag 2-3 things. This
behaviour is operationalized as the `overproduction_flag` global axis on
Doc 3 (true if partner raised >6 distinct risks).
