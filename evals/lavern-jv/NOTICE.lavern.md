# Lavern eval baseline — attribution

The fixtures in this directory are lifted from Lavern's `evals/jv/`
directory under the Apache License, Version 2.0.

## Upstream

- Project: Lavern by Antti Innanen
- Repository: https://github.com/AnttiHero/lavern
- License: Apache License, Version 2.0 (no modification to the licensed material)
- Upstream commit: `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`
- Upstream date:  2026-05-20 ("Update readme")
- Pull date:      2026-05-20 (Sprint 23)

## Files lifted verbatim from `/srv/projects/lavern/evals/jv/`

| Lavern path | Oscar GC path | Status |
|---|---|---|
| `borrowmoneycom_06_11_2020.txt` | `docs/borrowmoneycom_06_11_2020.txt` | Verbatim copy (21,454 bytes; plain-text OCR'd SEC filing — CUAD JV agreement) |
| `sibannac_12_04_2017.txt` | `docs/sibannac_12_04_2017.txt` | Verbatim copy (8,380 bytes; plain-text OCR'd SEC filing — commission-flavoured strategic alliance) |
| `veoneer_02_21_2020.txt` | `docs/veoneer_02_21_2020.txt` | Verbatim copy (8,259 bytes; plain-text OCR'd SEC filing — JV wind-down amendment) |
| `RUBRIC.md` | `RUBRIC.lavern-original.md` | Verbatim copy (7,517 bytes; 28-item pre-registered scoring rubric — Doc 1 has 12 items, Doc 2 has 10, Doc 3 has 7 totalling 29 distinct items across the three documents) |

## Adapted material — Oscar GC additions

The following files are Oscar GC's adaptation work (per ADR-077). They reference
the lifted material but are NOT lifted themselves:

- `RUBRIC.adapted.md` — adapted scoring rubric for partner-style consultation.
  Keeps the 29 per-doc risk items verbatim; drops Lavern-pipeline metrics
  (Watchman accuracy, precedent-board compounding, Curator portfolio framing —
  Oscar GC has no equivalent substrate); adds four Oscar-GC-specific global
  axes (grounded citations, verification-pass cited, revision behaviour,
  partner-tone fit) plus a Doc-3-specific `overproduction_flag`.
- `rubric/{doc1-borrowmoney,doc2-sibannac,doc3-veoneer}.json` — machine-readable
  structured rubrics consumed by the runner.
- `prompts/{judge-system,partner-question}.md` — judge prompt + partner
  consultation template.
- `scripts/{run-eval,lib-recipe,lib-judge,lib-report}.js` — runner + lib
  helpers (TypeScript-equivalent JS, mirroring Sprint 22's
  `test-lavern-agents.js` shape).

## Trademark notice

"Lavern" is the name of Antti Innanen's project. Per Apache License 2.0 §6,
this NOTICE file describes the origin of the lifted content; the mark is not
used to imply endorsement by Antti Innanen of Oscar GC or its eval results.

Lavern's human-baseline scores in `EVAL_REPORT_V*.md` files (not lifted; see
`/srv/projects/lavern/evals/jv/`) are recorded on `gemma2:2b` running through
Lavern's Watchman → Reader → precedent-board → Curator pipeline. Oscar GC's
eval runs on `MiniMax-M2.5` doing partner-style consultation — different model,
different role, different prompting. Direct score comparison is informational,
not authoritative.

## Reference

Top-level `/NOTICE` carries the canonical Lavern attribution entry (see ADR-035
for the attribution scheme). This file is the per-directory companion for the
specific eval-baseline content lifted in Sprint 23.
