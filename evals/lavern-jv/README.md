# Lavern-baselined eval — Sprint 23

Partner-consult eval over three CUAD JV-flavoured contracts lifted from
Lavern (`/srv/projects/lavern/evals/jv/`, Apache 2.0, commit
`7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`). Measures whether Oscar GC's
Lavern partners (Sarah Chen / M&A, Helena Voss / Privacy, Aisha Khan /
Litigation) produce partner-shaped analyses that cover the pre-registered
rubric items, and whether the Sprint 23 Ralph Loop discipline
([ADR-076](../../docs/adr/076-sprint23-ralph-loop-prompt-borne-gate.md))
measurably improves grounding behaviour over Sprint 22's advisory
verification ([ADR-077](../../docs/adr/077-sprint23-lavern-eval-baseline.md)).

**Per CLAUDE.md: Pipeline tests must NOT mock LLM calls.** Both partner
invocations AND the MiniMax-as-judge scoring use real
`MiniMax-M2.5` calls.

## Prerequisites

1. MiniMax key at `/root/.minimax-dev-key` (`chmod 600`) OR
   `MINIMAX_API_KEY` env var. Sprint 22 dev-key pattern.
2. Built `goose` binary at `/srv/projects/goose/target/release/goose`
   (or set `GOOSE_BIN`).
3. Bundled Oscar GC resources at `ui/desktop/src/resources/`:
   - 6 Tier-A MCPs (`mcps/oscar-{knowledge-base,document-reader,
     risk-pricing,baselines,grounding-verifier,document-checks}/index.js`)
   - `verification-pass.yaml` at `sub-recipes/`
   These are produced by `pnpm bundle:oscar-linux` from `ui/desktop/`.

## Run the sweep

Default — full sweep (3 partners × 3 docs × 2 configs = 18 partner runs +
18 batched judge calls, ~$1.20 + ~16 min wall-clock on a $10/PCM dev key):

```bash
node evals/lavern-jv/scripts/run-eval.js
```

Subsets (drop-order from ADR-077):

```bash
# Drop A/B (collapse to with-Ralph only, 9 runs)
node evals/lavern-jv/scripts/run-eval.js --configs with-ralph

# Reduce to 1 partner × 3 docs × 2 configs (6 runs)
node evals/lavern-jv/scripts/run-eval.js --partners sarah-chen

# Single tuple (debug)
node evals/lavern-jv/scripts/run-eval.js --partners sarah-chen --docs doc1-borrowmoney --configs with-ralph

# Skip judge (capture transcripts only)
node evals/lavern-jv/scripts/run-eval.js --skip-judge

# Re-score saved transcripts (no partner calls; useful after judge prompt edits)
node evals/lavern-jv/scripts/run-eval.js --judge-only --from-run evals/lavern-jv/runs/<TIMESTAMP>
```

Skip the eval entirely (CI-like environments without a MiniMax key):

```bash
SKIP_MINIMAX_TESTS=1 node evals/lavern-jv/scripts/run-eval.js
```

## Output

Each run creates `evals/lavern-jv/runs/<ISO-timestamp>/` with:

- `transcripts/<partner>-<doc>-<config>.log` — full partner-run stdout
  + stderr.
- `scores/<partner>-<doc>-<config>.json` — judge result (Zod-equivalent
  schema validation; `ok: false` + `error:` on parse failure).
- `manifest.json` — Lavern SHA, Sprint 22 baseline SHA (frozen for the
  without-Ralph leg), Oscar GC SHA at run time, model, wall-clock,
  pass/fail counts, CLI args.
- `REPORT.md` — collated per-tuple table + with-Ralph vs without-Ralph
  delta on grounding-touched rubric items + global axes + known coverage
  gaps + substantive Sprint 23 test verdict (Δ_grounded interpretation).

Each `runs/<ts>/` is gitignored (`runs/.gitkeep` is the lone tracked
entry). The closing report for Sprint 23 is promoted from
`runs/<ts>/REPORT.md` to `reports/sprint-23-baseline.md` at sprint close
and committed.

## Reproducibility

The without-Ralph baseline is the verbatim Sprint 22 directive frozen as
the `SPRINT_22_DIRECTIVE` constant in `scripts/lib-recipe.js` (inline
comment cites SHA `08a5381a7`). This decouples the eval from live
production prompts — future sprints can re-run the with-Ralph leg
against the same fixed without-Ralph baseline, even after the production
partner prompts have evolved further.

To reproduce the Sprint 23 closing baseline at a specific point in time:

```bash
git checkout <sprint-23-close-sha>
pnpm bundle:oscar-linux            # rebuild bundled resources
node evals/lavern-jv/scripts/run-eval.js
diff -u evals/lavern-jv/reports/sprint-23-baseline.md runs/<new-ts>/REPORT.md
```

Run-to-run delta is expected (LLM variance); the report header records
all SHAs so the diff is interpretable.

## Provenance

See [`NOTICE.lavern.md`](./NOTICE.lavern.md) for the file-by-file Lavern
attribution + the adaptation policy described in
[ADR-077](../../docs/adr/077-sprint23-lavern-eval-baseline.md).

The verbatim Lavern rubric is at `RUBRIC.lavern-original.md`. The
adapted rubric (substance preserved; pipeline-only metrics dropped; 4
Oscar-GC global axes added) is at `RUBRIC.adapted.md`.
