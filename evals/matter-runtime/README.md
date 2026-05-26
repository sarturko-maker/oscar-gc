# Matter-runtime eval substrate

Per [[ADR-109]]. The substrate every future matter system prompt
doctrine change runs through before merging.

## What this measures

Tool-call observation on real matter sessions. Per cycle, the substrate
records whether the agent invoked each affordance (`load_skill`,
on-demand playbook reads, `delegate`, redline tool) when it should
have, and whether it invoked them with the right arguments. **Not**
legal-substance accuracy.

## Methodology

- **Multi-model required** per [[ADR-107]]. Sprint 32: MiniMax-M2.5
  (primary, N=20) + claude-haiku-4-5 (OpenRouter, N=10). GPT-5.4-mini
  cell deferred to Sprint 32b.
- **CC as judge** per [[ADR-082]]. Doctrine masked from the judge —
  rubric scores observable tool-call appropriateness, not adherence
  to known doctrine.
- **Provider switch via env** per [[ADR-106]]. Matter recipes inherit
  `GOOSE_PROVIDER`/`GOOSE_MODEL` from goosed env at session-spawn;
  substrate sets these per cell.
- **Pre-flight N=5 variance gate** mandatory before main-matrix
  spawn (see `scripts/pre-flight-n5.js`).

## Layout

| Path | Role |
|---|---|
| `RUBRIC.md` | The observable-only rubric. Single source of truth. |
| `prompts/judge-system.md` | Judge-CC system prompt; references RUBRIC; doctrine masked. |
| `prompts/scenario-meta.md` | How scenario metadata is shown to the judge. |
| `scenarios/<slug>.json` | Per-scenario metadata + prompt schedule. |
| `scripts/build-variant.sh` | Checkout SHA → pnpm bundle → snapshot binary. |
| `scripts/run-cell.js` | Phase A: spawn N cycles per (variant, model, scenario) cell. |
| `scripts/extract-cycle.js` | Per-cycle transcript + tool-timeline extraction. |
| `scripts/lib-cost-log.js` | Multi-provider cost log (extends 31A/B convention). |
| `scripts/lib-scenarios.js` | Scenario registry loader. |
| `scripts/lib-variants.js` | Variant registry (commit SHA + binary path). |
| `scripts/pre-flight-n5.js` | N=5 variance gate. |
| `scripts/aggregate-report.js` | Phase C: roll up cell summaries. |
| `binaries/variant-<X>/` | Gitignored binary cache per variant. |
| `iterations/_costs/` | Cost logs per sprint (31A, 31B, 32, ...). |
| `iterations/_sanity-check/` | Pre-flight variance results. |
| `iterations/variant-<X>/<model>/<scenario>/cycle-<NN>/` | Per-cycle artefacts. |
| `reports/sprint-32-baseline.md` | Per-sprint headline report. |

## Substrate phases (per [[ADR-082]])

- **Phase A** (unattended, Node) — `run-cell.js` per cell: launches
  bundled binary at variant SHA, drives via `dogfood-driver.mjs` IPC
  (`oscar:matters:create` + `pair-send`), captures session_id per
  cycle, extracts transcript via `extract-cycle.js`, writes
  `manifest.json` + `transcript.json` + `tool-timeline.md` per cycle.
- **Phase B** (Claude Code, in-conversation) — me reading
  tool-timelines per cell with `prompts/judge-system.md` +
  `RUBRIC.md` open, writing `judge-verdict.json` per cycle. Doctrine
  text NOT in the judge's view.
- **Phase C** (Node, structural) — `aggregate-report.js` computes
  signal-to-noise per affordance per cell, emits
  `reports/sprint-<N>-baseline.md`.

## Cost discipline

- **MiniMax** — `/root/.minimax-dev-key` (PAYG; $10/PCM self-cap).
  At Sprint 32 scale (~6,000 requests across the sprint), effectively
  unbounded within the cap. Cost log records dollar-equivalent for
  observability.
- **OpenRouter** — `/root/.openrouter-dev-key` ($19 remaining at
  Sprint 32 start). Binding cost constraint for the secondary cells.
  Cost log records actual billed dollars.

## Cold-start reading order

1. `RUBRIC.md`
2. `prompts/judge-system.md`
3. One per-cycle output under
   `iterations/variant-B/MiniMax-M2.5/30-ndas/cycle-01/` once the
   pre-flight has run
4. `reports/sprint-32-baseline.md` once it's written
5. [[ADR-109]] for methodology rationale

## Related substrates

- `evals/oscar-llp/` — Sprint 25 substrate for Oscar LLP firm-mode
  evals; structural template (Phase A/B/C shape) for this substrate,
  but does NOT iterate prompts subtractively here. Matter-runtime is
  single-pass measurement, not iterative refinement.
- `docs/sprint-30/`, `docs/sprint-31a/`, `docs/sprint-31b/` — the
  manual N=1 cycles this substrate scales.
