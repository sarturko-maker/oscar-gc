# ADR-052 — Tavily as hosted SSE web-search extension + key handling

Status: accepted
Date: 2026-05-19
Sprint: 15

## Context

ADR-050's rule 4 (hypothesis-confirm via Tavily) needs a real web-search capability — Arturs's verbatim direction was *"We need Web Access. Goose already has it built in. The reason for it is because targeted search is needed to ensure regs are up to date. Model knowledge can become obsolete. The web search needs to be high level just pulling regulatory frameworks to update model training (which is still being relied on)."* Goose documents [Tavily](https://goose-docs.ai/docs/mcp/tavily-mcp/) as its canonical web-search MCP, available both as local stdio (`npx -y tavily-mcp@0.1.3`) and as hosted MCP at `https://mcp.tavily.com/mcp/?tavilyApiKey=<KEY>` over HTTP+SSE (per [Tavily MCP docs](https://docs.tavily.com/documentation/mcp), confirmed via WebFetch during Sprint 15 plan-mode).

ADR-042 locked Oscar GC's egress to goosed→provider + filesystem-only bundled MCPs. Adding a web-search extension is a structural change to that posture.

## Decision

**Hosted SSE, not local stdio.** Goose's `ExtensionConfig` natively supports `type: 'sse'` (`ui/desktop/src/api/types.gen.ts:369`). No subprocess to bundle, no `tavily-mcp` npm dep, no Rust core change. Tools exposed: `tavily-search` + `tavily-extract`.

**User-provided runtime key — never in the release.** Resolution at session-spawn time, in order:
1. `TAVILY_API_KEY` env var (dev / CI / launcher-wrapper).
2. `~/.config/oscar/secrets/tavily.json` (`{"api_key": "..."}`, 0600 perms).
3. Absent → omit the Tavily extension from the recipe entirely; ADR-050 rule-4 fallback runs.

Implementation:
- `ipcMain.handle('oscar:resolve-tavily-key', …)` in `main.ts` reads env then file; returns `{apiKey, source}` or null.
- `resolveTavilyKey()` (renderer wrapper) + `buildTavilyExtension(key)` (recipe shape).
- `buildOnboardingRecipe` + `buildPracticeAreaRecipe` + `buildCommercialRecipe` all take `tavily: TavilyKey | null` and conditionally include the SSE extension.
- `redactRecipeForLog(recipe)` (utility) replaces any `tavilyApiKey=<...>` substring with `tavilyApiKey=REDACTED`; used at any future logging/serialisation boundary.

**.gitignore patterns** added at root + `ui/desktop/` to lock down secrets paths (`**/secrets/tavily.json`, `.env.tavily`, `*.tavily.key`, `*.tavily.url`).

**ADR-042 amendment** (no edit to that file, per ADR rules): `mcp.tavily.com` added to goosed's runtime egress envelope when the user has configured a key. Declared in `BUNDLE.json` under a new `runtime_egress_optional[]` section by `prepare-oscar-bundle.js`. `GOOSE_ALLOWLIST` does not need extension — Tavily is not installed via Goose's Extensions UI; it's wired into the recipe by Oscar code.

**Settings UI deferred to Sprint 16.** Sprint 15 ships env-var + file-resolution; CC self-eval (Stage 1) uses the dev key in the secrets file; Arturs's Stage 2 dogfood uses env var or pre-populated secrets file at install time. Future end-users get a Settings affordance.

## Rationale

- **Hosted SSE > local stdio.** No bundling cost; no npm-package upgrade tax; no Node subprocess spawn at intake start. Goose's SSE support is first-class.
- **User-provided key over shipped credential.** Free-tier dev keys (1000 req/mo) are sufficient for Sprint 15 self-eval; production keys are user-owned; the release artefact contains no credential.
- **Graceful absence path** preserves the intake's "5 minutes tops" promise when web access is unavailable — Tavily is an *enhancement* to hypothesis-confirm, not a hard requirement (per ADR-050 rule 4).
- **Redaction utility lives next to the recipe builders** so any future code path that serialises a Recipe (e.g. session export, debug log) has the discipline at hand.

## Consequences

- New egress to `mcp.tavily.com` when key configured; documented in `BUNDLE.json` runtime_egress_optional.
- Practice-area agents also gain web-search when configured — improves regulatory-currency checks mid-matter, not just at intake.
- If Tavily's free-tier quota exhausts during eval, intake degrades silently to LLM-only hypothesis (rule 4 fallback).
- Sprint 16 picks up: Settings UI for end-user key entry; possible upgrade to OAuth `mcp_auth_default` flow per Tavily docs.

## Supersedes

None. Amends ADR-042 (network egress discipline) without editing it.
