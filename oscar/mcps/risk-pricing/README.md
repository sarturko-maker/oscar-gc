# oscar-risk-pricing-mcp

Clause-risk benchmarking MCP for Oscar GC's Lavern partners.

Two tools:

- `assess_clause_risk` — given a clause type and the clause text, returns the benchmark band the clause falls into, its percentile relative to the bundled distribution, and a structured set of risk flags + recommendations.
- `list_clause_benchmarks` — list all clause types the MCP can benchmark, with the underlying distribution stats.

## Origin

**Net-new (NOT a lift).** Lavern's `src/mcp/tools/risk-pricing.ts` is an orchestration scaffold (`request_risk_assessment` emits a "now dispatch the risk-pricer subagent" prompt; `record_risk_assessment` records what the subagent returned). It does not contain risk-pricing logic itself. Sprint 22 needed substantive risk pricing per the Sprint 22 brief's dogfood walk step 4 ("Spot-check risk-pricing on a clause: returns benchmark band + percentile"), so this MCP is Oscar-GC-native.

Raw Lavern source preserved at `src/_lavern-original/risk-pricing.ts` for reference. ADR-075 documents the deviation.

The benchmark table is a small hardcoded distribution covering common mid-market US clause shapes (liability cap, indemnity basket/cap, termination cure period, survival of reps, etc.). This is Sprint 22 placeholder; production-grade benchmarks would draw on a larger curated corpus.

## Sprint provenance

Sprint 22 of Oscar GC. See [ADR-075](../oscar-gc-lavern/docs/adr/075-sprint22-lavern-mcp-lift-policy.md).

## Development

```
pnpm install
pnpm build
pnpm smoke
pnpm test
```
