# oscar-baselines-mcp

Quality-baseline tracker MCP for Oscar GC's Lavern partners.

Four tools:

- `record_observation` — record a measured value (e.g. an indemnity-cap percentage, a survival period, a verification-pass rate) for a given dimension. Observations accumulate into a baseline distribution.
- `list_baselines` — list all dimensions that have at least one observation, with sample size + summary stats.
- `get_baseline` — get the full distribution stats (mean, stddev, min, max, sample size) for a single dimension.
- `check_against_baseline` — compare an observed value against the dimension's baseline; flag warnings (>2σ) and regressions (>3σ).

## Origin

Adapter lift from [github.com/AnttiHero/lavern](https://github.com/AnttiHero/lavern) (Apache-2.0; commit `7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd`), `src/mcp/tools/baselines.ts`. The original tool surface (`update_baselines`, `check_against_baseline`, `get_baseline`, `get_quality_trend`) was wired to consume `SessionReportCard` files produced by Lavern's downstream report-card pipeline. Oscar GC's Sprint 22 does not lift report-card infrastructure, so this MCP is adapted to **stand alone**: agents (or downstream tools) record observations directly via `record_observation`; baselines compute on the fly.

Raw Lavern source preserved at `src/_lavern-original/baselines.ts` (excluded from build).

Persistence: if `OSCAR_BASELINES_DIR` env var is set, observations and baselines persist as JSON files under that directory. Otherwise the MCP holds state in memory for the duration of the session.

## Sprint provenance

Sprint 22 of Oscar GC. See [ADR-075](../oscar-gc-lavern/docs/adr/075-sprint22-lavern-mcp-lift-policy.md) for the adapter rationale.

## Development

```
pnpm install
pnpm build
pnpm smoke
pnpm test
```
