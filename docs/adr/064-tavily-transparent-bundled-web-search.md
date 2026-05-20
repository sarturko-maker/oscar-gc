# ADR-064 — Tavily as transparent bundled web search

Status: accepted
Date: 2026-05-20
Sprint: 18

## Context

Tavily is wired (ADR-052, ADR-057) as a hosted streamable_http extension attached unconditionally to every practice-area recipe via `buildTavilyExtension()`. Key resolution is env-then-keyring; absent key degrades silently to LLM-only hypothesis-confirm.

Visibility is the gap. Tavily exists only in recipe code today: it never surfaces on the Extensions Settings page, and it has no entry in the Integrations registry (ADR-059). A lawyer cannot see that the agent's tool surface includes web search — and that web queries leave the device to `mcp.tavily.com` under Tavily's TOS. Sprint 17 (ADR-060) makes "honest labelling" a doctrine; Tavily's invisibility breaches it.

Arturs's brief, verbatim: *"surface its name in the extension card honestly ('queries go to [provider]'). User can swap."* Plus the prompt-injection-from-content caveat for `tavily-extract`: agent-driven fetch of arbitrary URLs can pull external content into the conversation; honest-labelling at install time is sufficient for prototype, revisit if it becomes an issue.

## Decision

**Tavily appears on both visibility surfaces, honestly labelled, with the provider's hostname.**

1. **Extensions Settings page** — new entry in `bundled-extensions.json`:
   - `type: streamable_http`, `enabled: true`, `bundled: true`
   - `display_name: "Web search (Tavily)"`
   - `description: "Web search via Tavily. Queries (and any URLs the agent fetches via tavily-extract) go to mcp.tavily.com."`
   - `uri: "https://mcp.tavily.com/mcp/?tavilyApiKey=${TAVILY_API_KEY}"`
   - `env_keys: ["TAVILY_API_KEY"]`
   - `ExtensionList.getSubtitle` already renders the URI as the visible command line (`ExtensionList.tsx:155-162`); no card-component change.

2. **Integrations registry** — new `Tavily` entry in `INTEGRATIONS_OVERLAY`:
   - `security_tier: 'bundled'` — Always-on badge in `IntegrationCard`, no Add button (matches `oscar-fs`'s treatment per ADR-060)
   - `service_endpoint_host: 'mcp.tavily.com'` — `HostTag` renders "talks to: mcp.tavily.com"
   - `subscription_type: 'free'` (free tier; key user-provided)
   - `license: 'proprietary'` (Tavily-managed wrapper)
   - `facts_note` calls out the egress and the `tavily-extract` fetch caveat

3. **Recipe-time behaviour unchanged.** `buildTavilyExtension()` still injects the same recipe entry at session-spawn; ADR-008 means recipe extensions override config.yaml during sessions, so no double-spawn.

**Per-area scope (Integrations side)**: Tavily applies to all 13 practice areas. The loader treats `security_tier: 'bundled'` as universal scope (same as `oscar-fs`) — no per-entry `relevant_areas` derivation needed.

## Rationale

- **Reuse over rebuild** — both surfaces' card components already render the right shape for streamable_http with hostname / URI; the cost is two declarations, not new UI.
- **Honest naming on both surfaces** — a lawyer who opens Extensions Settings sees the URI; a lawyer who opens Integrations sees the hostname tag. Either entry point is sufficient.
- **Bundled tier is honest tiering** — Tavily is Oscar-curated (we picked it, we ship the wiring) but the SaaS itself is Tavily-managed. Same posture as oscar-fs's "Oscar GC bundled, Always-on, listed for transparency". The trust-prompt friction of community tier is wrong for a build-time-curated choice.
- **No double-spawn risk** — `resolve_extensions_for_new_session` (extensions.rs:169) returns recipe extensions only when a recipe is in play. Tavily in config.yaml is for visibility only; the recipe entry is what actually loads.

## Consequences

- The `INTEGRATIONS_OVERLAY` per-area scope mechanism (Sprint 17 `bundled_skill_sources` inversion) needs a small carve-out for "applies to all areas regardless of plugin membership" — Tavily is the second such entry after `oscar-fs`. `loadRegistry.ts` likely already handles this via `oscar-fs`'s precedent; if not, the addition is a one-liner.
- `BUNDLE.json` `runtime_egress_optional[]` (ADR-052 / ADR-062) already lists `mcp.tavily.com`. No further egress declaration needed.
- Future provider swap (Exa, Brave, etc.) is a two-file change: swap the URI in `bundled-extensions.json` and the overlay entry in `registry.ts`. Recipe code (`buildTavilyExtension`) absorbs the provider abstraction if/when needed.
- `tavily-extract` fetch caveat lives in copy (extension card description + Integrations `facts_note`) — honest at install time, sufficient for prototype per the brief.

## Supersedes

None. Builds on ADR-052 (Tavily SSE wiring), ADR-057 (env_keys + keyring), ADR-059 (Integrations registry), ADR-060 (trust tiering). Coupled with [[ADR-063]] and [[ADR-065]].
