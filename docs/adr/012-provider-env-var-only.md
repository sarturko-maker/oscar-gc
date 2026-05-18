# ADR-012 — Provider configuration in Sprint 6: env-var-only

Status: accepted
Date: 2026-05-18
Sprint: 6

## Context

The brief's "Provider configuration" requirement reads: "Detect `MINIMAX_API_KEY` if set; the agent confirms — 'It looks like you've already set a MiniMax key in your environment. Want to use that, or set a different one?' If unset, the agent asks for a paste."

Implementing the paste path means the MCP server (or some other component) writes the user's pasted secret somewhere Goose will read on the next session. The natural target is `~/.config/goose/secrets.yaml` — but that ties `oscar-onboarding-mcp` to Goose's secret-file format, which is internal to Goose and not part of any stable API. Goose's secret precedence is documented (env > keyring > secrets.yaml per `crates/goose/src/config/base.rs:780-785`) but the file format itself isn't a public contract.

Two paths considered:

1. **Sprint 6: env-var-only.** Agent confirms `MINIMAX_API_KEY` is set in the shell environment. If not, the agent's wrap message asks the user to set the env var and restart; `finalize_profile` is never called; next launch re-runs onboarding. No paste capture.
2. **Sprint 6: paste capture into `~/.config/goose/secrets.yaml`.** MCP server writes the file. Provides full functionality but couples our server to Goose's internal format. If upstream changes the format (e.g. moves to a different keyring backend, encrypts at rest), our server breaks.

## Decision

Sprint 6 is env-var-only. The dev VPS always has `MINIMAX_API_KEY` in `/srv/projects/lq-ai-agentic/.env`; the onboarding agent's recipe sets `goose_provider: minimax`, `goose_model: MiniMax-M2.5`; the agent's voice confirms the key is set; the lawyer continues.

Failure mode: env var absent. The agent's wrap message becomes "I don't see a MiniMax key set in your environment. Please set `MINIMAX_API_KEY` in your shell and restart Oscar GC — we'll pick up here." `finalize_profile` is **not** called. Profile is not written. Next launch reroutes to onboarding (no profile = guard fires).

This is reasonable for Sprint 6 because the only known users (dev environments, Arturs) always have the env var set. Production / pilot users will hit this gap; a later sprint addresses it.

## Rationale

- The secret-storage seam is its own architectural decision. Conflating "first-launch onboarding flow" with "secret-storage redesign" inflates Sprint 6 scope and creates a tangled rollback story if either piece needs revision.
- The brief explicitly permits scope cuts: "Schema first, UI second." Schema captures `provider.kind` and `provider.model`; the key is orthogonal. The schema doesn't change when paste capture lands.
- Production users matter, but Sprint 6 is pre-pilot. The dev surface is where we learn whether the conversation works at all. Adding secret-paste-handling now would mean designing a UI affordance (paste field), wire encryption, deal with keyring availability on Linux (often missing on headless hosts), and decide on a secrets-rotation story. Each of those is its own decision.

## Consequences

- The onboarding agent's system prompt (ADR-010) is shorter — no paste capture branch, simpler P4. Less LLM scope for the agent to mishandle.
- Production users who launch without an env var will see a graceful failure message and re-run onboarding after setting the var. Not great UX, but well-defined.
- The pasted-key flow is on the Sprint 7+ carry-forward list. The future ADR will choose between:
  - Writing to `~/.config/goose/secrets.yaml` directly (tighter coupling, simpler code).
  - Writing to our own `~/.config/oscar/credentials.json` and adding an electron-main shim that exports it to `goosed` as an env var on session creation.
  - Using a keyring API (libsecret on Linux, Keychain on macOS, Credential Manager on Windows) through Goose's existing secret path.

## Supersedes

None.
