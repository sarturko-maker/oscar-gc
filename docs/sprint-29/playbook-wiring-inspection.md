# Sprint 29 — Playbook wiring inspection

## What was inspected

Per the Sprint 29 brief's Issue 5 — three-layer playbook architecture
defined in [[ADR-085]]:

| Layer | Mechanism | Status pre-Sprint-29 |
|---|---|---|
| 1 — always-on | Renderer extracts text; injects `## Playbooks in scope` block in recipe instructions; 8 K char cap. | Wired and working. Lawyer toggles always-on in the Playbooks section → next matter-open carries the text. |
| 2 — on-demand | `oscar-fs` allowed-directories includes `~/.config/oscar/playbooks/`; computercontroller exposes `pdf_tool` / `docx_tool`. Agent *can* read on request. | Wired but invisible. The system prompt did not enumerate available playbooks; agent could only discover via `oscar-fs__list_directory`, which it had no instruction to perform. |
| 3 — semantic retrieval | Deferred per [[ADR-085]]. | Not built. Out of Sprint 29 scope. |

## The gap (and what got patched)

Lawyer's mental model (verbatim from Crostini dogfood 2026-05-25):

> If I upload a playbook, the agent will have a choice to use it...
> you may have 10 playbooks uploaded — NDA review, MSA — and the agent
> needs to pick the right one.

Real behaviour pre-patch: agent never knows the playbooks exist
unless the lawyer pastes the filename into a prompt. Layer 2 reachable
in principle, blind in practice.

Patch (Sprint 29 M6, [[ADR-099]]): a second discovery block lands in
the recipe instructions alongside Layer 1's always-on block:

```
## On-demand playbooks

These playbooks live in `~/.config/oscar/playbooks/`. They are NOT
auto-injected; load any that apply to the question via
`oscar-fs__read_file` (text formats) or computercontroller's
`pdf_tool` / `docx_tool` (binary formats). Filenames are the
load-bearing signal — pick by purpose.

- `_global/nda-redline-playbook.md` (global, 4 KB) — Standard NDA…
- `commercial/msa-checklist.md` (this area, 8 KB) — MSA negotiation…
- `_global/vendor-onboarding.pdf` (global, 245 KB)
```

For text formats the renderer peeks the first non-blank line (≤80
chars) as a purpose hint; for binary formats the filename + size
carry the signal alone.

## What this patch is NOT

The patch closes the **visibility gap** (does the agent know the
playbook exists). It does not solve the **selection problem** at
scale (with 10+ playbooks, can the agent pick the right one
reliably). That is Layer 3 territory — semantic retrieval — which
[[ADR-085]] correctly deferred. The "10 NDA-shaped playbooks" case
likely still needs Layer 3 to be reliable at scale; this patch
buys discoverability for the 1–5-playbook small-team case.

## What was verified structurally

- `oscar:playbooks:render-on-demand-block` IPC returns the expected
  markdown for a seeded matter with two text-format on-demand
  playbooks (filename + scope + size + first-line hint).
- When one of the same files is flipped always-on, the IPC drops it
  from the on-demand block (it now belongs to Layer 1) — exercised
  in `capture-sprint29-m6.js`.
- `buildPracticeAreaRecipe` composes the new block between Layer 1's
  always-on block and the skills block; absent any on-demand
  playbooks the slot returns `null` and the builder skips it.

## What carries to Crostini dogfood

- Real MiniMax pass: open a Commercial matter with one always-on
  playbook and three on-demand. Ask "redline this against our NDA
  playbook." Observe whether the agent invokes `oscar-fs__read_file`
  on the named on-demand playbook now that the block enumerates it.
  Pre-patch the agent would either ignore or hallucinate.
- Selection-at-scale (Layer 3 question) is best deferred to a future
  sprint with proper retrieval scaffolding; flag if dogfood reveals
  the on-demand block becomes noise above ~10 entries.

## Files touched

- `ui/desktop/src/components/oscar/playbooks/playbookStore.ts`
  (`renderOnDemandPlaybooksBlock` + first-line peek helper).
- `ui/desktop/src/main.ts` (`oscar:playbooks:render-on-demand-block`
  IPC handler).
- `ui/desktop/src/preload.ts` (bridge method).
- `ui/desktop/src/components/oscar/recipe/renderPlaybooksBlock.ts`
  (renderer wrapper).
- `ui/desktop/src/components/oscar/recipe/buildPracticeAreaRecipe.ts`
  (compose into instructions stack).
- `docs/adr/099-on-demand-playbook-discovery-block.md` (decision).
- `docs/screenshots/sprint-29-m6/` (probe results).
