# ADR-017 — Capability-to-MCP binding via extension-name namespacing

Status: accepted
Date: 2026-05-18
Sprint: 9

## Context

Sprint 9 introduces adeu as a stdio MCP exposing the redline capability. The project commitment (Sprint 9 brief, "The DI principle"): the agent must not be coupled to "adeu specifically" any more than it's coupled to "MiniMax specifically." Tomorrow's swap of adeu for an alternative redline backend should be a config change, not a code change. The agent should see a capability ("you have a redline tool available"), not an implementation ("you can call `adeu__redline_docx`").

Phase 0 investigation of Goose's MCP layer (`crates/goose/src/agents/extension_manager.rs:1253-1333`, `extension.rs:151-286`) confirmed:

- Goose advertises each MCP server's tools as `{extension_name}__{tool_name}`.
- There is no native tool-name aliasing for stdio extensions. Only "platform extensions" (in-process Rust) can be `unprefixed_tools`.
- `available_tools: [...]` in the extension config can whitelist a subset by exact name but cannot rename.

Three options:

1. **Modify Goose core** to add a `tool_aliases: { old_name: new_name }` field to `ExtensionConfig::Stdio`. Violates fork hygiene (CLAUDE.md "do not modify the Rust core unless absolutely necessary"); creates an upstream-merge debt.
2. **Thin router-MCP** — sibling repo `oscar-redline-mcp` (TypeScript) that wraps adeu and re-exposes its tools under capability names. Future-proof but doubles infrastructure for a problem we may never hit.
3. **Extension-name namespacing** — register adeu in `~/.config/goose/config.yaml` with `name: redline` instead of `name: adeu`. Agent sees `redline__process_document_batch`. Swap = edit `cmd:`/`args:` in the same yaml stanza.

## Decision

Option (3). The extension is named `redline` in `~/.config/goose/config.yaml`. The agent sees `redline__process_document_batch`, `redline__read_docx`, `redline__diff_docx_files`. The string "adeu" appears only in the `description` field of the stanza and in this ADR / RUNBOOK; the agent never sees it.

The swap procedure is: edit the `cmd:`, `args:`, and (if the replacement's inner tool names differ) `available_tools:` in `~/.config/goose/config.yaml`. If a future replacement has different inner tool names, build a router-MCP at that point, not before.

## Rationale

- **The user's plan-mode prompt explicitly OK'd this**: "the abstraction may live at the registration-config level only." Config-level DI is the lightest seam.
- **Zero Rust changes.** Fork hygiene preserved.
- **The extension name IS the capability.** From the agent's perspective, `redline__*` is the capability namespace. The implementation behind it (adeu, a future router, an in-process Rust crate) is a config concern.
- Declined (1): an alias map in Rust is a load-bearing change to upstream code for a problem that can be solved in a yaml file.
- Declined (2): a router-MCP is the right answer if and when we have multiple redline backends with different tool names. Until that exists, the router is speculation.

## Consequences

- **Inner-tool-name leakage** is real. The agent sees `redline__process_document_batch` — if a future backend calls its tool `apply_redline_batch`, the agent's tool name changes from `redline__process_document_batch` to `redline__apply_redline_batch`. Mitigation: when that happens, build a router-MCP (option 2) that exposes a stable inner name.
- **System prompt references the namespace, not the implementation.** The Commercial chat system prompt (ADR-020) refers to "the redline tool" generically and to `redline__process_document_batch` for the specific call; never to "adeu".
- **The `available_tools` whitelist is the security/UX seam.** adeu exposes 11 tools; only `read_docx`, `process_document_batch`, `diff_docx_files` are whitelisted. The others (`open_local_file`, cloud auth, email, validation) are filtered at config-registration time, not in the agent's reasoning.

## Supersedes

None. First ADR on capability binding.
