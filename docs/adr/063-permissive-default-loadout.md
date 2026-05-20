# ADR-063 — Permissive default extension loadout for in-house lawyers

Status: accepted
Date: 2026-05-20
Sprint: 18

## Context

Upstream Goose ships an extension-default doctrine built for developers: `developer` (shell + filesystem-write) is on; `chatrecall`, `memory`, `autovisualiser`, `tutorial`, `computercontroller` are off. Arturs's verbatim direction on Sprint 17b dogfood: *"Everything is currently off and I can see Oscar FS and redline as 'On' (which is good). However, our default should be permissive save for things lawyers don't need."*

CLAUDE.md's "Inverting upstream UX defaults" doctrine already covers per-decision inversions (no telemetry prompt — ADR-028; bypassed recipe-trust dialog — ADR-029). The extension-default loadout is the same shape of decision: lawyers don't opt into Memory / Top of Mind / Apps / Auto Visualiser; they expect them on. They *do* opt out of Developer (which exposes shell). This ADR formalises the inverted doctrine for every platform extension at once, rather than litigating each one piecemeal.

ADR-041 already excludes Developer from practice-area session recipes ("Recipe loadout is a security decision"). This ADR is the wider-floor companion: every other platform extension flips to *permissive-default*.

## Decision

**Default ON** (in-house lawyers benefit; safe under ADR-041 access-model scoping):
Memory, Top of Mind, Chat Recall, Apps, Todo, Summon, Extension Manager, Auto Visualiser, plus Web search (Tavily — see ADR-064). `analyze` and `skills` (upstream-default-on) stay on. `oscar-fs` (every recipe) and `redline` (Commercial recipe) are unchanged.

**Default OFF**: Developer (shell + filesystem write), Computer Controller, Tutorial, Code Mode. The escape-hatch set.

**Implementation surfaces**:

- `bundled-extensions.json` (UI sync seed) — flips `memory.enabled` and `autovisualiser.enabled` to `true`; `computercontroller`, `tutorial` stay `false`.
- `crates/goose/src/agents/platform_extensions/mod.rs` (Rust migration seed) — two-line touch: `chatrecall.default_enabled` flips `false → true`; `developer.default_enabled` flips `true → false`. Independent lines, near-zero merge-conflict surface. Rust core touch justified per the same "absolute necessity" framing that allowed ADRs 028 / 029 / 058 — there is no fork-clean alternative for migration-seeded defaults that doesn't reintroduce a stateful post-migration override path.

**Forge differs (ADR scope-stub)**: Forge's recipe loadout always includes `code_execution` and `extensionmanager` regardless of user toggles — its purpose is wiring new agents and managing extensions, and these capabilities are load-bearing. Implementation lives in `forgeRecipe.ts` alongside [[ADR-065]]'s recipe-builder thread-through.

## Rationale

- **Permissive-default is honest for our audience.** A lawyer who never opens the Extensions Settings page should still get the agent's full lawyer-relevant tool surface.
- **Named-exclusion list is small and stable.** The four off-by-default extensions are the escape hatches; no future expansion of platform extensions changes this list by accident.
- **One ADR, not eight.** Litigating each platform extension separately would yield the same end-state slower. Single decision-of-record is easier to audit.
- **Per-extension toggle still works.** The user can flip any default on the Extensions Settings page; ADR-065 makes the toggle take effect for the next matter session.

## Consequences

- Sprint 18 ships the flips together with ADR-064 (Tavily visibility) and ADR-065 (recipe builders consume config.yaml platforms) — these three ADRs are coupled; the brief's exit criterion fails if any one is dropped.
- Upstream merges that add new platform extensions to `PLATFORM_EXTENSIONS` arrive with their `default_enabled` honoured — by upstream convention these tend toward "on" for things lawyers won't mind. If an upstream addition is escape-hatch-shaped, it joins the off-by-default list in a future ADR.
- A future upstream PR could lift the `developer:false / chatrecall:true` flips into a per-distribution config (e.g., a `GOOSE_DEFAULT_EXTENSION_OVERRIDES` env table). Until then, the two-line Rust touch is the maintenance cost.

## Supersedes

None. Companion to ADR-041 (recipe loadout scope-down); coupled with [[ADR-064]] and [[ADR-065]].
