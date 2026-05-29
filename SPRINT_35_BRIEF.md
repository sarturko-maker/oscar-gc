# Sprint 35 — Brief (DRAFT for Arturs's review)

Sprint 34 ([[ADR-111]], [[ADR-112]], [[ADR-113]]) built Tabular Review **headless**:
a new sibling MCP `oscar/mcps/tabular` owns the grid schema, a deterministic
merge, a zero-LLM grounding gate, and atomic per-review persistence in the matter
folder; the agent fans out one clean-context reader per document via Goose Summon's
structured-recipe path (no Rust-core change); the extractor recipe and the
orchestration doctrine are wired into every matter recipe. The spine is verified at
the unit + MCP-client level (`pnpm run smoke` green; `tsc` clean).

But **no lawyer can see any of it yet.** The review exists only as `manifest.json`
on disk. Sprint 35 is the sprint that makes Tabular Review *real*: the native
surface where a lawyer watches the grid fill, drills a cell to its highlighted
clause, and talks to the agent — and, before any of that, the first end-to-end run
of the engine on a live model, which has never happened.

This is a **UI sprint** and an **integration sprint**. Two things have to be true by
close: (1) the headless engine actually works end-to-end on a real provider, and
(2) there is a native React surface that renders the result and lets the lawyer work
the grid and the agent at once.

## What Arturs said (verbatim)

(2026-05-28, the Tabular Review brief)

> I want an agent to generate tabular review when the user asks it to and it be
> available persistently. It needs to be better than the incumbent legal-AI tools
> thats the goal. Deal?

(2026-05-28, on the render decision)

> Lawyers though need to interact with both the grid and the agent.

(2026-05-28, on prior art and framing)

> what the users see and what they can do. The [citations], highlighting, showing
> documents. BUT we are reusing Goose to the extent we can.

> Are you reusing some of the work LQ.AI has already done?

These are the load-bearing framings. The render decision they forced — **native
React split, not an MCP App** — is recorded in [[ADR-113]] and is settled; Sprint 35
executes it, it does not re-litigate it. "Reuse Goose to the extent we can" and
"reuse LQ.AI's functional work" are the standing instructions: reuse LQ-Grid's React
grid, its `SourceView`/highlight code, its citation model, and the matter chat
surface — do not rebuild what exists. "Better than the incumbents" is the bar,
but the *measurement* of that claim is Phase 5's launch gate, not Sprint 35's — do
not make external comparative claims off an unmeasured surface.

## The goal (load-bearing)

A lawyer opens a matter, asks in plain English for a review across many documents,
and **sees a grid populate, drills a cell to the exact highlighted clause in the
source, and asks the agent follow-up questions — all on one screen.** Persistent:
close and reopen, it's still there. That is the whole Sprint 35 outcome.

Two stages, and the first gates the second:

- **Stage A — prove the engine end-to-end (headless, real provider).** Sprint 34
  verified the MCP tools in isolation; it never ran a live agent through
  create_review → wave-delegate → load → ingest → finalize. Do that first, on a
  real matter with a handful of documents, then at portfolio scale. If the agent
  doesn't actually drive the fan-out and the structured-recipe output doesn't come
  back validated, the UI has nothing real to render — so this is the gating risk,
  not a formality.
- **Stage B — the native surface.** Once the manifest is reliably correct on disk,
  build the React surface that renders it and couples it to the agent.

## Stage A — prove the engine (do this before building UI)

The detailed architecture and file map live in
`/root/.claude/plans/here-is-the-brief-prancy-allen.md` (the approved plan) and the
three ADRs. Stage A is the plan's "Phase 2 runtime validation," which Sprint 34
deferred. Directionally:

- Wire the one missing integration piece: the extractor recipe must reach Summon's
  discovery path (`~/.config/goose/recipes/`) at launch. Decide in plan-mode whether
  to wire the launch-time copy properly now (mirrors the bundled-skills symlink) or
  place it manually for a dev run — but Stage A cannot run until the recipe is
  discoverable.
- Run on a real provider (MiniMax in dev) — this is a **pipeline test, so it must
  not mock the model** (CLAUDE.md). Start with ~5 documents, then the 50-contract
  portfolio that motivates the whole feature.
- Confirm the load-bearing properties on disk: the manifest fills wave by wave;
  every `complete` cell carries a grounded verbatim quote; ungrounded answers land
  as `flagged`; nothing fails silently. Watch the wall-clock — 50 docs is ~10
  sequential waves at the default background-task cap; decide whether that's
  acceptable for v1 or whether the cap is tuned via env (never in core).
- Watch for the known risks the plan flags: provider conformance to the response
  schema (validate-and-mark-failed, don't drop), char-offset unreliability (the
  grounding gate is authoritative), and oversized documents.

Stage A's exit: a real 50-document manifest on disk, correct and grounded, produced
by the agent from a natural-language ask — captured in the SPRINT_LOG with the
transcript reference, the way prior dogfood sprints recorded their runs.

## Stage B — the native surface

This is the first time the design language matters. Read `/srv/projects/LQdesign/`
once for the visual system, and **read the LQ-Grid UI source directly** (not via an
agent's paraphrase — see the memory note on visual decisions) so the grid you build
carries forward what LQ-Grid's lawyers actually saw and did: the cell → "View
Source" → highlighted clause flow, the verify/flag/override controls, the
output-typed columns.

Directionally (the plan has the file-level map; don't treat the following as a
spec):

- **Reuse, don't rebuild.** LQ-Grid's grid is already React (TanStack) — port its
  components and its `SourceView`/highlight code rather than re-authoring them.
  Reuse the existing matter **chat surface** as the agent rail so it is the *same*
  agent and session that ran the review — this is what makes "interact with both the
  grid and the agent" real, and it's the win over LQ-Grid's read-only chat and
  the incumbents' separated threads/tables. Reuse the existing full-window route pattern
  and the right-pane plumbing rather than inventing new shells.
- **One source of truth.** The grid renders the matter-folder manifest the MCP
  writes; the agent mutates it through the MCP tools; the UI re-reads on a poll/watch.
  Do not introduce a second store, and do not put review state in the renderer or
  localStorage — that was LQ-Grid's mistake and ADR-111 fixes it.
- **The three zones, live at once**: grid (centre), agent rail, and the cell-drill
  citation/document view (the original PDF/DOCX with the supporting clause
  highlighted, with the offset-exact text view as the reliable fallback). All three
  visible together is the requirement; a cell whose quote didn't ground must read as
  "needs review," not as a confident answer.

Stage B's exit: the full-window split renders a real Stage-A manifest; a lawyer can
add/answer columns by talking to the rail, drill a cell to its highlighted source,
and reopen the matter to find the review intact. **Commit screenshots to
`docs/screenshots/sprint-35/` and reference them in the SPRINT_LOG entry** — per
CLAUDE.md, only a PNG proves the screen renders the way Arturs expects.

## Cold-start reading order

1. `PROJECT.md` — Sprint Index (Sprint 34 is the newest Tabular row)
2. `CLAUDE.md` — operating rules, especially "Reuse over rebuild — Goose",
   "Inverting upstream UX defaults", and "Visual verification (UI sprints)"
3. `SPRINT_LOG.md` — the Sprint 34 entry (what landed, what's carried forward)
4. `RUNBOOK.md` — the 2026-05-28 Tabular Review MCP section (dev wiring + the
   recipe-copy and bundling carry-forwards)
5. `docs/adr/111-…`, `112-…`, `113-…` — architecture, grounding gate, native render
6. `/root/.claude/plans/here-is-the-brief-prancy-allen.md` — the approved plan with
   the phase-by-phase file map (Phases 2–4 are Sprint 35's territory)
7. `oscar/mcps/tabular/` — the MCP this surface renders (schema, tools, manifest shape)
8. `oscar/recipes/tabular-cell-extractor.yaml` + `…/recipe/tabularReviewDoctrine.ts`
   — the engine the agent runs
9. LQ-Grid (`sarturko-maker/LQ-Grid`, via `gh` — read the UI source directly) and
   `/srv/projects/lq-ai-agentic/` — the prior art being reused
10. The existing matter chat surface, the full-window route pattern (Forge), and the
    right-pane section registry — the Goose/Oscar surfaces being reused
11. `/srv/projects/LQdesign/` — the visual system (read once)
12. Memory: `feedback_visual_decisions_read_source.md`, `feedback_design_pushback_workflow.md`

## Out of scope

- **Phase 5 differentiators** — "ask the whole table," accretive add-column /
  single-cell rerun beyond what Stage A needs, column-query playbooks, export, the
  cost-preview, the optional LLM-ensemble verification, and the RAG-baseline fidelity
  test. The "beats the incumbents" *measurement* is that fidelity test; Sprint 35 does
  not make the comparative claim.
- **Re-opening polish vs. the minimal launcher** — a minimal right-pane "Tabular
  Review" entry point is likely needed for reopen; decide in plan-mode whether the
  full launcher (Phase 4) lands in 35 or 36. Don't gold-plate it.
- **Packaging the .deb** — bundling the MCP + recipe into resources for the installer
  is required before ship, but a dev run is enough for Stage A/B verification;
  Crostini install validation follows the project's usual deferred-dogfood pattern.
- **Rust core, new providers, new practice areas.** None of these.

## Open questions to think deeply about (do not pre-resolve)

- **Does Stage A actually work?** This is the real unknown. The structured-recipe
  path is verified in Rust source, but no live model has produced the payload yet.
  If MiniMax under-enforces the response schema, or doesn't reliably fan out via
  `delegate`, Stage A surfaces it — and that may reshape Stage B (e.g., a heavier
  validate-and-repair step, or a self-write fallback). Treat Stage A findings as
  potentially plan-altering, and flag them rather than working around them.
- **How does the grid mount and stay coupled to the live session?** The render is
  native and the rail is the real matter chat — think hard about how the full-window
  surface holds the same session the review ran in, so the agent's writes and the
  grid's reads stay in sync without a second source of truth.
- **Wall-clock at 50 docs.** Progressive wave population is the mitigation, but is a
  multi-minute first paint acceptable, or does the cap get tuned? Decide with the
  Stage A measurement in hand, not before.
- **How much Phase 4 is unavoidable for reopen?** A review that can't be reopened
  isn't "persistent" in the sense Arturs asked for. Find the minimal re-entry that
  satisfies "close and reopen, it's still there" without building the whole launcher.
- **Is there any LQ-Grid UX worth NOT carrying forward?** The Sprint 34 audit noted
  LQ-Grid gaps (confidence collected-but-never-shown, no highlight next/prev, split
  persistence). Decide which to fix now (they're cheap and on-brand for "better than
  the incumbents") and which to defer.

## A note on sequencing

Bias toward smaller sprints (CLAUDE.md). If Stage A surfaces engine problems, it is
legitimate to close Sprint 35 on a *working, dogfooded engine + a thin first render*
and carry the polished surface to Sprint 36 — a real grid over a real manifest beats
a beautiful grid over a manifest the engine can't reliably produce. Stage A is the
load-bearing half.
