# ADR-062 — Per-integration egress disclosure (amends ADR-042)

Status: accepted
Date: 2026-05-19
Sprint: 17

## Context

ADR-042 established three-layer network-egress discipline:

1. **Per-MCP audit**: every bundled MCP is grep-audited at build time; zero outbound calls allowed; declared in `BUNDLE.json`.
2. **Goosed → provider**: locked to MiniMax (ADR-012).
3. **Electron renderer**: CSP-tightened; `webRequest` blocks non-localhost outbound.

The audit-as-floor model assumes "every MCP that ships in the binary is known and reviewed at build time". Sprint 16 amended this for the Tavily extension (ADR-052 → ADR-057) with a `runtime_egress_optional[]` block in `BUNDLE.json` declaring `mcp.tavily.com` as an approved-but-runtime-key-gated outbound endpoint.

Sprint 17's Integrations surface (ADR-059, ADR-060) breaks this model further: lawyers can now *install community-tier MCPs at runtime*, each opening a new outbound endpoint to a third-party service the user explicitly consented to. None of these are reviewed at Oscar GC's build time — they're vendored by Anthropic (`.mcp.json`) but selected and activated by the end user.

OS-level egress enforcement (bubblewrap / network namespaces) remains deferred to Sprint 15+ per ADR-042 (still open in TODO.md). Until that lands, the structural floor must be a *runtime disclosure* model: per-install consent + auditable record + visibility for support.

## Decision

**Audit-and-disclose at runtime; no enforcement.** The ADR-042 three-layer model is extended with a fourth runtime layer:

4. **Per-integration runtime egress**: each entry in `installed_integrations.json` (ADR-061) implicitly widens the egress envelope to the entry's `service_endpoint_host` (from the overlay — ADR-059). The consent gate (ADR-060) is the install-time disclosure; the disk-level `trust_acknowledged: true` is the durable record.

**Three concrete mechanisms**:

- **Trust-prompt copy carries the hostname.** "Talks to: mcp.na1.ironcladapp.com (over HTTPS)" appears verbatim in the community-tier prompt. No install path bypasses the disclosure.
- **Startup egress envelope log.** `main.ts` startup-time logging walks all `~/.config/oscar/state/<area-id>/installed_integrations.json` files; resolves each `id` against the registry overlay; logs a one-shot enumeration of `{hostname, area-ids[]}` pairs to the existing structured logger. Useful for support: "this user has 3 installed integrations across 2 areas, talking to N hostnames." Stays on stderr per CLAUDE.md.
- **Documentation surface.** `BUNDLE.json`'s `runtime_egress_optional[]` (build-time, fixed) and the per-user `installed_integrations.json` files (runtime, variable) are the two artefacts. ADR-042's `BUNDLE.json` audit floor stays untouched; this ADR records the runtime artefact and its disclosure semantics.

**No runtime enforcement.** No firewall rule; no `setProxy` filter mutation; no network-layer block. The renderer's `webRequest` filter (ADR-042 layer 3) continues to limit *renderer-initiated* outbound to the LLM provider host — but MCP outbound runs in goosed, which is unrestricted. Enforcement lands when bubblewrap-class work picks up Sprint 15+.

## Rationale

- **Honest framing.** The structural floor available today is consent + audit, not enforcement. Calling out the absence of sandboxing in the trust prompt is the inversion of upstream-default "click-through dialogs" that CLAUDE.md mandates.
- **Per-user variability is unavoidable.** The brief explicitly enables lawyer-driven Add. Build-time-only egress audits would force every supportable MCP into the bundled tier — the opposite of "see and add".
- **Visibility for support.** When Arturs's pilot users say "agent is slow / behaving oddly", the startup egress log makes the question "which extensions are widening the surface?" answerable from a log dump alone — no profile.json snooping.
- **No premature enforcement.** Building enforcement before bubblewrap means inventing per-process firewall logic in Electron — fragile, easy to bypass, and orthogonal to the eventual OS-level mechanism. Sprint 17 plants the disclosure substrate; Sprint 15+ replaces this ADR with a hardened one.

## Consequences

- ADR-042's "no third-party data egress beyond the configured LLM provider" framing is structurally limited to *Oscar's own components*; lawyer-added MCPs explicitly widen outbound under recorded consent. The ADR-042 text is unchanged (per ADR rules); this ADR is the new decision-of-record for the runtime egress envelope.
- `INTEGRATIONS_OVERLAY` (ADR-059) requires `service_endpoint_host: string | null` per entry. Bundled stdio MCPs (oscar-fs) use `null`. The loader rejects non-stdio entries with missing host.
- Startup log line shape (one-shot at app launch, before goosed spawn): `egress envelope: 3 integrations across 2 areas → mcp.courtlistener.com, mcp.na1.ironcladapp.com, slack.com`. Hostnames only, no entry ids, no credentials.
- Bubblewrap revisit (ADR-042 TODO.md carry) is now load-bearing for the community tier — when it lands, the trust-prompt copy's "real sandboxing is planned in a later release" line gets a definite tense.
- `redactRecipeForLog` (ADR-052) is preserved as defence-in-depth for any future recipe-serialisation path; URIs may carry `${KEY}` tokens, not literal credentials.

## Supersedes

Amends ADR-042 (network-egress discipline). ADR-042 text unchanged; this ADR is the decision-of-record for runtime egress disclosure semantics. Will be superseded when bubblewrap-class enforcement lands (Sprint 15+ candidate).
